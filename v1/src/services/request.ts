import { join } from 'node:path';
import { ensureDir, writeFileAtomic } from '../adapters/fs.js';
import { readConfig } from '../shared/config.js';
import { MiradorError } from '../shared/errors.js';
import { paths } from '../shared/paths.js';
import { createArtifact } from './artifact.js';
import { computeRequestExpiry } from './expiration.js';
import { publishLanding, renderLanding } from './landingPage.js';
import { type RequestSeed, type ResponseSeed, composeSeed } from './promptSeed.js';

export interface CreateRequestInput {
  title: string; // becomes the slug after kebab-casing
  toEmail: string;
  by?: string;
  context?: string;
  role?: string;
}

export interface CreateRequestResult {
  slug: string;
  seedText: string;
  landingPath: string;
}

export async function createRequest(input: CreateRequestInput): Promise<CreateRequestResult> {
  const config = await readConfig();
  if (!config) throw new MiradorError('CONFIG_MISSING', 'Run `mirador-v1 init` first.');

  const slug = toSlug(input.title);
  const sent = new Date().toISOString();
  const expires = computeRequestExpiry(input.by);

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

  // Stub in workspace outgoing-requests
  const stubDir = join(paths.workspaceClone(), 'outgoing-requests');
  await ensureDir(stubDir);
  await writeFileAtomic(
    join(stubDir, `${slug}.md`),
    `# Request: ${input.title}\n\nTo: ${input.toEmail}\nBy: ${input.by ?? '(unset)'}\nExpires: ${expires}\nStatus: pending\n\n${input.context ?? ''}\n`,
  );

  // Landing page
  const siteRoot = join(paths.workspaceClone(), 'site');
  await ensureDir(siteRoot);
  const landingHtml = renderLanding({
    kind: 'request',
    slug,
    from: config.github.handle,
    role: input.role,
    context: input.context,
    seedText,
  });
  const { localPath } = await publishLanding(siteRoot, slug, 'request', landingHtml);

  return { slug, seedText, landingPath: localPath };
}

export async function acceptRequest(seed: RequestSeed): Promise<{
  artifactPath: string;
  responseSeed: string;
}> {
  const config = await readConfig();
  if (!config) throw new MiradorError('CONFIG_MISSING', 'Run `mirador-v1 init` first.');

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
  if (!config) throw new MiradorError('CONFIG_MISSING', 'Run `mirador-v1 init` first.');

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
