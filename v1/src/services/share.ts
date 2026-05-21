import { join } from 'node:path';
import { ensureDir, pathExists, writeFileAtomic } from '../adapters/fs.js';
import * as github from '../adapters/github.js';
import * as vercel from '../adapters/vercel.js';
import { readConfig } from '../shared/config.js';
import { MiradorError } from '../shared/errors.js';
import { paths } from '../shared/paths.js';
import { resolveArtifactPath } from './artifact.js';
import { resolveEmail } from './inviteResolver.js';
import { publishLanding, renderLanding } from './landingPage.js';
import { writeLinkFile } from './linkFile.js';
import { composeSeed } from './promptSeed.js';
import { publishPreview, renderPreview } from './staticPreview.js';

export interface ShareInput {
  slug: string;
  withEmails: string[];
  /** Explicit GitHub handles, parallel to withEmails. If set, skips email→handle resolution. */
  withHandles?: string[];
  role?: string;
  note?: string;
  keepHistory?: boolean;
  offline?: boolean; // INTERNAL: skip GitHub + Vercel calls (for tests).
  noPublish?: boolean; // USER-FACING: skip Vercel deploy only (local files still rendered).
  dryRun?: boolean; // USER-FACING: print what would happen, write nothing.
}

export interface ShareResult {
  sharedRepo: string;
  cloneUrl: string;
  invitationSeed: string;
  landingPath: string;
  previewPath: string;
  deployedUrl?: string;
  dryRun?: boolean;
  plan?: string[];
}

export async function shareArtifact(input: ShareInput): Promise<ShareResult> {
  const config = await readConfig();
  if (!config) {
    throw new MiradorError('CONFIG_MISSING', 'Run `mirador-v1 init` first.');
  }

  const artifactPath = await resolveArtifactPath(input.slug);
  const owner =
    config.github.sharedReposNamespace === 'personal'
      ? config.github.handle
      : config.github.sharedReposNamespace;
  const fullName = `${owner}/${input.slug}`;

  // Dry-run: describe the plan, do nothing.
  if (input.dryRun) {
    const plan = [
      `Would create private GitHub repo: ${fullName}`,
      ...input.withEmails.map((e) => `Would invite collaborator: ${e}`),
      `Would render preview to: workspace/site/d/${input.slug}/index.html`,
      `Would render landing to: workspace/site/i/${input.slug}/index.html`,
      input.noPublish
        ? 'Would NOT deploy to Vercel (--no-publish)'
        : `Would deploy workspace/site/ to Vercel project: ${config.vercel.project}`,
      `Would replace ${input.slug}/ with .mirador-link pointing at ${fullName}`,
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
        description: `Shared via Mirador: ${input.slug}`,
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
        if (msg.includes('422')) return; // already a collaborator
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

  // 2. Compose the invitation seed
  const sent = new Date().toISOString();
  const vercelBase = `https://${config.vercel.domain}`;
  const previewUrl = `${vercelBase}/d/${input.slug}/`;
  const landingUrl = `${vercelBase}/i/${input.slug}/`;
  const seedText = composeSeed({
    kind: 'invitation',
    from: `${config.github.handle} <${config.github.handle}@users.noreply.github.com>`,
    artifact: input.slug,
    repo: `https://github.com/${fullName}`,
    roleExpected: input.role,
    note: input.note,
    sent,
    preview: previewUrl,
    landing: landingUrl,
  });

  // 3. Render + publish static preview + landing locally
  const siteRoot = join(paths.workspaceClone(), 'site');
  await ensureDir(siteRoot);
  const previewHtml = await renderPreview(artifactPath, config.defaults.theme || 'default');
  const { localPath: previewLocal } = await publishPreview(siteRoot, input.slug, previewHtml);
  const landingHtml = renderLanding({
    kind: 'invitation',
    slug: input.slug,
    from: config.github.handle,
    role: input.role,
    note: input.note,
    seedText,
    previewUrl,
  });
  const { localPath: landingLocal } = await publishLanding(
    siteRoot,
    input.slug,
    'invitation',
    landingHtml,
  );

  // 3b. Deploy to Vercel (skipped if offline or --no-publish)
  let deployedUrl: string | undefined;
  if (!input.offline && !input.noPublish) {
    try {
      const result = await vercel.deploySite(siteRoot, config.vercel.project);
      deployedUrl = result.deployedUrl;
    } catch (err) {
      // Deploy failure is logged but doesn't fail the share — local files exist.
      const { logActivity } = await import('../shared/log.js');
      await logActivity(`share deploy-failed ${(err as Error).message}`);
    }
  }

  // 4. Link file
  await writeLinkFile(artifactPath, {
    kind: 'mirador-link',
    artifact: input.slug,
    repo: `https://github.com/${fullName}`,
    shared_at: sent,
    shared_with: input.withEmails,
    role_for_collaborators: input.role,
    clone_path: join(paths.sharedClonesRoot(), input.slug),
  });

  // 5. Manifest
  const manifestDir = join(artifactPath, '.mirador');
  await ensureDir(manifestDir);
  await writeFileAtomic(
    join(manifestDir, 'manifest.json'),
    `${JSON.stringify(
      {
        slug: input.slug,
        owner: config.github.handle,
        shared_with: input.withEmails,
        role_for_collaborators: input.role,
        created_at: sent,
      },
      null,
      2,
    )}\n`,
  );

  return {
    sharedRepo: fullName,
    cloneUrl,
    invitationSeed: seedText,
    landingPath: landingLocal,
    previewPath: previewLocal,
    deployedUrl,
  };
}

export async function unshareArtifact(
  slug: string,
  opts: { offline?: boolean } = {},
): Promise<void> {
  const artifactPath = await resolveArtifactPath(slug);
  const linkPath = join(artifactPath, '.mirador-link');
  if (await pathExists(linkPath)) {
    const { rm } = await import('node:fs/promises');
    await rm(linkPath);
  }
  const manifestPath = join(artifactPath, '.mirador', 'manifest.json');
  if (await pathExists(manifestPath)) {
    const { rm } = await import('node:fs/promises');
    await rm(manifestPath);
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
