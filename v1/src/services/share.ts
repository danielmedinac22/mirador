import { join } from 'node:path';
import { ensureDir, pathExists, writeFileAtomic } from '../adapters/fs.js';
import * as github from '../adapters/github.js';
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
  role?: string;
  note?: string;
  keepHistory?: boolean;
  offline?: boolean; // when true, skip GitHub create + Vercel deploy
}

export interface ShareResult {
  sharedRepo: string;
  cloneUrl: string;
  invitationSeed: string;
  landingPath: string;
  previewPath: string;
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

  // 1. Create repo (offline = stub)
  const fullName = `${owner}/${input.slug}`;
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
    for (const email of input.withEmails) {
      const { handle } = await resolveEmail(email);
      await github.addCollaborator(fullName, handle).catch((err) => {
        // Non-fatal if collaborator already added
        if (!String(err).includes('422')) throw err;
      });
    }
  }

  // 2. Compose the invitation seed (used in landing + clipboard)
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

  // 3. Render + publish static preview + landing (local; deploy is offline-skipped)
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

  // 4. Replace workspace folder with .mirador-link (only the link file inside)
  // Strategy: keep the existing artifact folder intact but add the link file alongside.
  // (Full extraction to a separate shared/<slug> clone is a follow-up — see TODO below.)
  await writeLinkFile(artifactPath, {
    kind: 'mirador-link',
    artifact: input.slug,
    repo: `https://github.com/${fullName}`,
    shared_at: sent,
    shared_with: input.withEmails,
    role_for_collaborators: input.role,
    clone_path: join(paths.sharedClonesRoot(), input.slug),
  });

  // 5. Persist manifest in the artifact for VS-09 role override
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
  };
}

export async function unshareArtifact(
  slug: string,
  opts: { offline?: boolean } = {},
): Promise<void> {
  const artifactPath = await resolveArtifactPath(slug);
  // Remove link file
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
