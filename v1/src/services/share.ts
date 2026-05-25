import { cp, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDir, pathExists, writeFileAtomic } from '../adapters/fs.js';
import * as git from '../adapters/git.js';
import * as github from '../adapters/github.js';
import * as vercel from '../adapters/vercel.js';
import { readConfig, writeConfig } from '../shared/config.js';
import { MiradorError } from '../shared/errors.js';
import { paths } from '../shared/paths.js';
import { resolveArtifactPath } from './artifact.js';
import { resolveEmail } from './inviteResolver.js';
import { publishLanding, renderLanding } from './landingPage.js';
import { writeLinkFile } from './linkFile.js';
import { composeSeed } from './promptSeed.js';
import { installSiteChrome } from './siteChrome.js';
import { discoverPublishedSlugs, publishSiteIndex } from './siteIndex.js';
import { publishPreview, renderPreview } from './staticPreview.js';

export interface ShareInput {
  slug: string;
  withEmails: string[];
  /** Explicit GitHub handles, parallel to withEmails. */
  withHandles?: string[];
  role?: string;
  note?: string;
  keepHistory?: boolean;
  offline?: boolean;
  noPublish?: boolean;
  dryRun?: boolean;
}

export interface ShareResult {
  sharedRepo: string;
  cloneUrl: string;
  invitationSeed: string;
  landingPath: string;
  previewPath: string;
  deployedUrl?: string;
  clonePath?: string;
  dryRun?: boolean;
  plan?: string[];
}

export async function shareArtifact(input: ShareInput): Promise<ShareResult> {
  const config = await readConfig();
  if (!config) {
    throw new MiradorError('CONFIG_MISSING', 'Run `mirador init` first.');
  }

  const artifactPath = await resolveArtifactPath(input.slug);
  const owner =
    config.github.sharedReposNamespace === 'personal'
      ? config.github.handle
      : config.github.sharedReposNamespace;
  const fullName = `${owner}/${input.slug}`;
  const clonePath = join(paths.sharedClonesRoot(), input.slug);

  if (input.dryRun) {
    const plan = [
      `Would create private GitHub repo: ${fullName}`,
      ...input.withEmails.map((e) => `Would invite collaborator: ${e}`),
      `Would extract artifact files to: ${clonePath}`,
      `Would push initial commit to ${fullName}`,
      `Would render preview to: workspace/site/d/${input.slug}/index.html`,
      `Would render landing to: workspace/site/i/${input.slug}/index.html`,
      input.noPublish
        ? 'Would NOT deploy to Vercel (--no-publish)'
        : `Would deploy workspace/site/ to Vercel project: ${config.vercel.project}`,
      'Would replace workspace artifact folder with .mirador-link',
    ];
    return {
      sharedRepo: fullName,
      cloneUrl: `https://github.com/${fullName}.git`,
      invitationSeed: '(dry run — seed not generated)',
      landingPath: '(dry run)',
      previewPath: '(dry run)',
      dryRun: true,
      plan,
    };
  }

  // 1. Create repo + invite collaborators (skipped if offline)
  let cloneUrl = `https://github.com/${fullName}.git`;
  if (!input.offline) {
    const existing = await github.repoExists(fullName);
    if (!existing) {
      const repo = await github.createRepo({
        name: input.slug,
        org: owner === config.github.handle ? undefined : owner,
        private: true,
        description: `Shared via mirador: ${input.slug}`,
      });
      cloneUrl = repo.cloneUrl;
    }
    for (let i = 0; i < input.withEmails.length; i++) {
      const email = input.withEmails[i] ?? '';
      const explicit = input.withHandles?.[i];
      let handle: string;
      if (explicit) {
        handle = explicit;
      } else {
        const resolved = await resolveEmail(email);
        handle = resolved.handle;
        if (resolved.warning) {
          process.stderr.write(`⚠  ${resolved.warning}\n`);
        }
      }
      await github.addCollaborator(fullName, handle).catch((err) => {
        const msg = String(err);
        if (msg.includes('422')) return;
        if (msg.includes('404')) {
          throw new MiradorError(
            'COLLAB_HANDLE_NOT_FOUND',
            `GitHub user "${handle}" not found.`,
            `Pass \`--handle ${handle === email.split('@')[0] ? '<correct-github-handle>' : handle}\` (or comma-separated, parallel to --with) to specify directly.`,
          );
        }
        throw err;
      });
    }
  }

  // 2. Compose the invitation seed (provisional — URLs may be re-derived after first deploy)
  const sent = new Date().toISOString();
  let activeDomain = config.vercel.domain;
  const composeSeedFor = (domain: string): string => {
    const base = `https://${domain}`;
    return composeSeed({
      kind: 'invitation',
      from: `${config.github.handle} <${config.github.handle}@users.noreply.github.com>`,
      artifact: input.slug,
      repo: `https://github.com/${fullName}`,
      roleExpected: input.role,
      note: input.note,
      sent,
      preview: `${base}/d/${input.slug}/`,
      landing: `${base}/i/${input.slug}/`,
    });
  };
  let seedText = composeSeedFor(activeDomain);

  // 3. Render + publish static preview + landing locally
  const siteRoot = join(paths.workspaceClone(), 'site');
  await ensureDir(siteRoot);
  // Install shared chrome (tokens, fonts, themes, mark assets). Idempotent.
  await installSiteChrome(siteRoot);
  const previewHtml = await renderPreview(artifactPath, config.defaults.theme || 'page');
  const { localPath: previewLocal } = await publishPreview(siteRoot, input.slug, previewHtml);
  const renderLandingFor = (seed: string, domain: string): string =>
    renderLanding({
      kind: 'invitation',
      slug: input.slug,
      from: config.github.handle,
      role: input.role,
      note: input.note,
      seedText: seed,
      previewUrl: `https://${domain}/d/${input.slug}/`,
    });
  let landingLocal = (
    await publishLanding(
      siteRoot,
      input.slug,
      'invitation',
      renderLandingFor(seedText, activeDomain),
    )
  ).localPath;

  // Refresh site index to include the newly published artifact
  const indexEntries = await discoverPublishedSlugs(siteRoot);
  await publishSiteIndex(siteRoot, config.github.handle, indexEntries);

  // 3b. Deploy to Vercel (first attempt — may re-deploy if the production URL
  //     pattern differs from the configured domain)
  let deployedUrl: string | undefined;
  let redeployed = false;
  if (!input.offline && !input.noPublish) {
    try {
      const result = await vercel.deploySite(siteRoot, config.vercel.project);
      deployedUrl = result.deployedUrl;
    } catch (err) {
      const { logActivity } = await import('../shared/log.js');
      await logActivity(`share deploy-failed ${(err as Error).message}`);
    }

    // Derive the real production URL from the deploy response and compare
    // against config. If different, update config + re-render + re-deploy so
    // the landing's embedded seed points at the correct stable URL.
    if (deployedUrl) {
      const derivedProdUrl = vercel.deriveProductionUrl(deployedUrl, config.vercel.project);
      const derivedHost = (() => {
        try {
          return new URL(derivedProdUrl).host;
        } catch {
          return null;
        }
      })();
      if (derivedHost && derivedHost !== activeDomain) {
        process.stderr.write(
          `ℹ  Vercel production domain detected as "${derivedHost}" — updating config (was "${activeDomain}") and re-deploying with corrected seed URLs.\n`,
        );
        await writeConfig({ ...config, vercel: { ...config.vercel, domain: derivedHost } });
        activeDomain = derivedHost;
        seedText = composeSeedFor(activeDomain);
        landingLocal = (
          await publishLanding(
            siteRoot,
            input.slug,
            'invitation',
            renderLandingFor(seedText, activeDomain),
          )
        ).localPath;
        try {
          const result2 = await vercel.deploySite(siteRoot, config.vercel.project);
          deployedUrl = result2.deployedUrl;
          redeployed = true;
        } catch (err) {
          const { logActivity } = await import('../shared/log.js');
          await logActivity(`share redeploy-failed ${(err as Error).message}`);
        }
      }
    }
  }
  void redeployed; // retained for potential future use in result

  // 4. Extract artifact to shared clone path + push (snapshot mode only for now)
  if (input.keepHistory) {
    process.stderr.write(
      '⚠  --keep-history is not yet implemented (falls back to snapshot). Tracked as a follow-up.\n',
    );
  }
  // Re-share detection: if the workspace folder already holds a .mirador-link,
  // resolveArtifactPath followed it and artifactPath is the shared clone — not
  // the workspace folder. In that case the extract step would copy entries
  // onto themselves (EINVAL), and the replaceWithLinkOnly step would delete
  // the shared clone entirely. Both must be skipped.
  const workspaceArtifactPath = join(paths.workspaceClone(), 'artifacts', input.slug);
  const isReshare = artifactPath !== workspaceArtifactPath;

  await extractToSharedClone(artifactPath, clonePath, fullName, cloneUrl, {
    offline: input.offline,
    slug: input.slug,
    owner: config.github.handle,
    sharedWith: input.withEmails,
    role: input.role,
    sent,
  });

  // 5. Replace workspace folder contents with the link file only. Skip on
  //    re-share — the workspace already has its link file from the first share.
  if (!isReshare) {
    await replaceWithLinkOnly(artifactPath, {
      slug: input.slug,
      repoUrl: `https://github.com/${fullName}`,
      sharedAt: sent,
      sharedWith: input.withEmails,
      role: input.role,
      clonePath,
    });
  }

  return {
    sharedRepo: fullName,
    cloneUrl,
    invitationSeed: seedText,
    landingPath: landingLocal,
    previewPath: previewLocal,
    deployedUrl,
    clonePath,
  };
}

interface ExtractOptions {
  offline?: boolean;
  slug: string;
  owner: string;
  sharedWith: string[];
  role?: string;
  sent: string;
}

async function extractToSharedClone(
  artifactPath: string,
  clonePath: string,
  fullName: string,
  cloneUrl: string,
  opts: ExtractOptions,
): Promise<void> {
  await ensureDir(clonePath);

  // Re-share path: when an artifact has already been shared, resolveArtifactPath
  // follows the .mirador-link and returns the shared clone itself. In that case
  // artifactPath === clonePath, the content is already in place, and copying
  // entry-by-entry onto themselves throws EINVAL. Skip the extract step.
  const isReshare = artifactPath === clonePath;
  if (!isReshare) {
    // Copy all artifact files (except .mirador-link which doesn't exist yet)
    const entries = await readdir(artifactPath);
    for (const entry of entries) {
      if (entry === '.mirador-link') continue;
      const src = join(artifactPath, entry);
      const dest = join(clonePath, entry);
      await cp(src, dest, { recursive: true });
    }
  }

  // Write/update manifest inside the shared clone
  const manifestDir = join(clonePath, '.mirador');
  await ensureDir(manifestDir);
  await writeFileAtomic(
    join(manifestDir, 'manifest.json'),
    `${JSON.stringify(
      {
        slug: opts.slug,
        owner: opts.owner,
        shared_with: opts.sharedWith,
        role_for_collaborators: opts.role,
        created_at: opts.sent,
      },
      null,
      2,
    )}\n`,
  );

  if (opts.offline) {
    // No git init/push in offline mode (tests).
    return;
  }

  // Initialise git, commit, push only if the clone isn't already a git repo
  const gitDir = join(clonePath, '.git');
  if (!(await pathExists(gitDir))) {
    await git.init(clonePath);
    await git.setMainBranch(clonePath);
    await git.add(clonePath, ['.']);
    await git.commit(clonePath, `Initial mirador snapshot of ${opts.slug}`);
    await git.setRemote(clonePath, 'origin', cloneUrl);
    await git.push(clonePath, 'main', true).catch(async (err) => {
      // Push may fail if the remote already has content (e.g., re-share of an
      // archived-then-restored repo). Log but don't fail the whole share.
      const { logActivity } = await import('../shared/log.js');
      await logActivity(`share push-failed ${(err as Error).message} repo=${fullName}`);
    });
  }
}

async function replaceWithLinkOnly(
  artifactPath: string,
  opts: {
    slug: string;
    repoUrl: string;
    sharedAt: string;
    sharedWith: string[];
    role?: string;
    clonePath: string;
  },
): Promise<void> {
  // Remove every entry inside the artifact folder
  const entries = await readdir(artifactPath);
  for (const e of entries) {
    const full = join(artifactPath, e);
    const st = await stat(full);
    if (st.isDirectory()) {
      await rm(full, { recursive: true, force: true });
    } else {
      await rm(full);
    }
  }
  // Write only the link file
  await writeLinkFile(artifactPath, {
    kind: 'mirador-link',
    artifact: opts.slug,
    repo: opts.repoUrl,
    shared_at: opts.sharedAt,
    shared_with: opts.sharedWith,
    role_for_collaborators: opts.role,
    clone_path: opts.clonePath,
  });
}

export async function unshareArtifact(
  slug: string,
  opts: { offline?: boolean } = {},
): Promise<void> {
  const artifactPath = join(paths.workspaceClone(), 'artifacts', slug);
  if (!(await pathExists(artifactPath))) {
    throw new MiradorError('ARTIFACT_NOT_FOUND', `Artifact "${slug}" not found.`);
  }

  const linkPath = join(artifactPath, '.mirador-link');
  const clonePath = join(paths.sharedClonesRoot(), slug);

  if (await pathExists(linkPath)) {
    // Copy contents from shared clone back into workspace folder
    if (await pathExists(clonePath)) {
      const entries = await readdir(clonePath);
      for (const entry of entries) {
        if (entry === '.git') continue;
        await cp(join(clonePath, entry), join(artifactPath, entry), { recursive: true });
      }
    }
    await rm(linkPath);
  }

  if (!opts.offline) {
    const config = await readConfig();
    if (config) {
      const owner =
        config.github.sharedReposNamespace === 'personal'
          ? config.github.handle
          : config.github.sharedReposNamespace;
      await github.archiveRepo(`${owner}/${slug}`).catch(() => {
        /* best-effort */
      });
    }
  }
}
