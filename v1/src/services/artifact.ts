import { join } from 'node:path';
import { ensureDir, pathExists, writeFileAtomic } from '../adapters/fs.js';
import { MiradorError } from '../shared/errors.js';
import { paths } from '../shared/paths.js';
import { readLinkFile } from './linkFile.js';

export interface NewArtifactInput {
  slug: string;
  purpose?: string;
  audience?: string;
}

export async function createArtifact(input: NewArtifactInput): Promise<{ path: string }> {
  validateSlug(input.slug);
  const dir = join(paths.workspaceClone(), 'artifacts', input.slug);
  if (await pathExists(dir)) {
    throw new MiradorError('ARTIFACT_EXISTS', `Artifact "${input.slug}" already exists.`);
  }
  await ensureDir(dir);
  await writeFileAtomic(join(dir, 'CONTEXT.md'), renderContext(input));
  return { path: dir };
}

export async function resolveArtifactPath(slug: string): Promise<string> {
  validateSlug(slug);
  const dir = join(paths.workspaceClone(), 'artifacts', slug);
  if (!(await pathExists(dir))) {
    throw new MiradorError(
      'ARTIFACT_NOT_FOUND',
      `Artifact "${slug}" not found in workspace.`,
      'Run `mirador-v1 list` to see your artifacts.',
    );
  }
  // If the workspace folder is a link-only stub, follow the link to the shared clone.
  const link = await readLinkFile(dir);
  if (link?.clone_path) {
    if (!(await pathExists(link.clone_path))) {
      throw new MiradorError(
        'SHARED_CLONE_MISSING',
        `Shared artifact "${slug}" was extracted but the local clone at ${link.clone_path} is missing.`,
        `Run \`git clone ${link.repo} ${link.clone_path}\` and retry, or \`mirador-v1 unshare ${slug}\` to re-absorb if you have a backup.`,
      );
    }
    return link.clone_path;
  }
  return dir;
}

function validateSlug(slug: string): void {
  if (!/^([a-z0-9]|[a-z0-9][a-z0-9-]{0,62}[a-z0-9])$/.test(slug)) {
    throw new MiradorError(
      'INVALID_SLUG',
      `Slug "${slug}" is invalid.`,
      'Use lowercase letters, digits, and dashes. 1–64 chars, no leading/trailing dash.',
    );
  }
}

function renderContext(input: NewArtifactInput): string {
  return `# ${input.slug}

## Purpose
${input.purpose || '(not specified yet — edit me)'}

## Audience
${input.audience || '(not specified yet — edit me)'}

## Notes
Add your working notes here as you build out the artifact.
`;
}
