import { join } from 'node:path';
import { ensureDir, writeFileAtomic } from '../adapters/fs.js';
import * as vercel from '../adapters/vercel.js';
import { readConfig } from '../shared/config.js';
import { MiradorError } from '../shared/errors.js';
import { paths } from '../shared/paths.js';
import { createArtifact } from './artifact.js';
import { computeRequestExpiry } from './expiration.js';
import { publishLanding, renderLanding } from './landingPage.js';
import { type RequestSeed, type ResponseSeed, composeSeed } from './promptSeed.js';
import { readRegistry, upsertEntry } from './shareRegistry.js';
import { installSiteChrome } from './siteChrome.js';
import { publishSiteIndex } from './siteIndex.js';

export interface CreateRequestInput {
  title: string;
  toEmail: string;
  by?: string;
  context?: string;
  role?: string;
  offline?: boolean; // INTERNAL: skip Vercel deploy (tests).
  noPublish?: boolean; // USER-FACING: skip Vercel deploy only.
  dryRun?: boolean;
}

export interface CreateRequestResult {
  slug: string;
  seedText: string;
  landingPath: string;
  deployedUrl?: string;
  dryRun?: boolean;
  plan?: string[];
}

export async function createRequest(input: CreateRequestInput): Promise<CreateRequestResult> {
  const config = await readConfig();
  if (!config) throw new MiradorError('CONFIG_MISSING', 'Run `mirador init` first.');

  const slug = toSlug(input.title);
  const sent = new Date().toISOString();
  const expires = computeRequestExpiry(input.by);

  if (input.dryRun) {
    return {
      slug,
      seedText: '(dry run — seed not generated)',
      landingPath: '(dry run)',
      dryRun: true,
      plan: [
        `Would write outgoing-requests/${slug}.md stub`,
        `Would render landing to workspace/site/r/${slug}/index.html`,
        input.noPublish
          ? 'Would NOT deploy to Vercel (--no-publish)'
          : `Would deploy workspace/site/ to Vercel project: ${config.vercel.project}`,
        `Would copy seed text to clipboard for sending to ${input.toEmail}`,
      ],
    };
  }

  const seed: RequestSeed = {
    kind: 'request',
    from: `${config.github.handle} <${config.github.handle}@users.noreply.github.com>`,
    to: input.toEmail,
    askingFor: slug,
    by: input.by,
    roleExpected: input.role ?? 'author',
    context: input.context,
    sent,
    expires,
    landing: `https://${config.vercel.domain}/r/${slug}/`,
  };
  const seedText = composeSeed(seed);

  const stubDir = join(paths.workspaceClone(), 'outgoing-requests');
  await ensureDir(stubDir);
  await writeFileAtomic(
    join(stubDir, `${slug}.md`),
    `# Request: ${input.title}\n\nTo: ${input.toEmail}\nBy: ${input.by ?? '(unset)'}\nExpires: ${expires}\nStatus: pending\n\n${input.context ?? ''}\n`,
  );

  const siteRoot = join(paths.workspaceClone(), 'site');
  await ensureDir(siteRoot);
  // Install shared chrome (tokens, fonts, themes, mark assets). Idempotent.
  await installSiteChrome(siteRoot);
  const landingHtml = renderLanding({
    kind: 'request',
    slug,
    from: config.github.handle,
    role: input.role,
    context: input.context,
    seedText,
  });
  const { localPath } = await publishLanding(siteRoot, slug, 'request', landingHtml);

  // Record the request in the registry + refresh site index.
  await upsertEntry(siteRoot, {
    slug,
    kind: 'request',
    publishedAt: sent,
    to: input.toEmail,
    role: input.role ?? 'author',
    by: input.by,
    context: input.context,
  });
  const registry = await readRegistry(siteRoot);
  await publishSiteIndex(siteRoot, config.github.handle, registry.shares, {
    baseUrl: `https://${config.vercel.domain}`,
  });

  let deployedUrl: string | undefined;
  if (!input.offline && !input.noPublish) {
    try {
      const result = await vercel.deploySite(siteRoot, config.vercel.project);
      deployedUrl = result.deployedUrl;
    } catch (err) {
      const { logActivity } = await import('../shared/log.js');
      await logActivity(`request deploy-failed ${(err as Error).message}`);
    }
  }

  return { slug, seedText, landingPath: localPath, deployedUrl };
}

export async function acceptRequest(seed: RequestSeed): Promise<{
  artifactPath: string;
  responseSeed: string;
}> {
  const config = await readConfig();
  if (!config) throw new MiradorError('CONFIG_MISSING', 'Run `mirador init` first.');

  // Create artifact in recipient's workspace
  const { path: artifactPath } = await createArtifact({
    slug: seed.askingFor,
    purpose: `Requested by ${seed.from}: ${seed.context ?? '(no context)'}`,
    audience: '(see request)',
  });

  // Stub in incoming-requests
  const stubDir = join(paths.workspaceClone(), 'incoming-requests');
  await ensureDir(stubDir);
  await writeFileAtomic(
    join(stubDir, `${seed.askingFor}.md`),
    `# Accepted: ${seed.askingFor}\n\nFrom: ${seed.from}\nBy: ${seed.by ?? '(unset)'}\nStatus: accepted\n\n${seed.context ?? ''}\n`,
  );

  // Mark auto-invite in manifest
  const manifestDir = join(artifactPath, '.mirador');
  await ensureDir(manifestDir);
  await writeFileAtomic(
    join(manifestDir, 'manifest.json'),
    `${JSON.stringify(
      {
        slug: seed.askingFor,
        owner: config.github.handle,
        auto_invite: [seed.from],
        role_for_collaborators: seed.roleExpected ?? 'reviewer',
        created_at: new Date().toISOString(),
        origin_request: seed,
      },
      null,
      2,
    )}\n`,
  );

  // Compose response seed
  const responseSeed: ResponseSeed = {
    kind: 'response',
    from: `${config.github.handle} <${config.github.handle}@users.noreply.github.com>`,
    to: seed.from,
    reRequest: seed.askingFor,
    status: 'accepted',
    note: 'Started. Will share when ready.',
    sent: new Date().toISOString(),
  };

  return { artifactPath, responseSeed: composeSeed(responseSeed) };
}

export async function declineRequest(
  seed: RequestSeed,
  reason: string,
): Promise<{ responseSeed: string }> {
  const config = await readConfig();
  if (!config) throw new MiradorError('CONFIG_MISSING', 'Run `mirador init` first.');

  const stubDir = join(paths.workspaceClone(), 'incoming-requests');
  await ensureDir(stubDir);
  await writeFileAtomic(
    join(stubDir, `${seed.askingFor}.md`),
    `# Declined: ${seed.askingFor}\n\nFrom: ${seed.from}\nReason: ${reason}\nStatus: declined\n`,
  );

  const responseSeed: ResponseSeed = {
    kind: 'response',
    from: `${config.github.handle} <${config.github.handle}@users.noreply.github.com>`,
    to: seed.from,
    reRequest: seed.askingFor,
    status: 'declined',
    note: reason,
    sent: new Date().toISOString(),
  };

  return { responseSeed: composeSeed(responseSeed) };
}

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
