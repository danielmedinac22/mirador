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
  await writeFileAtomic(join(dir, 'source.md'), renderSource(input));
  return { path: dir };
}

export async function resolveArtifactPath(slug: string): Promise<string> {
  validateSlug(slug);
  const dir = join(paths.workspaceClone(), 'artifacts', slug);
  if (!(await pathExists(dir))) {
    throw new MiradorError(
      'ARTIFACT_NOT_FOUND',
      `Artifact "${slug}" not found in workspace.`,
      'Run `mirador list` to see your artifacts.',
    );
  }
  // If the workspace folder is a link-only stub, follow the link to the shared clone.
  const link = await readLinkFile(dir);
  if (link?.clone_path) {
    if (!(await pathExists(link.clone_path))) {
      throw new MiradorError(
        'SHARED_CLONE_MISSING',
        `Shared artifact "${slug}" was extracted but the local clone at ${link.clone_path} is missing.`,
        `Run \`git clone ${link.repo} ${link.clone_path}\` and retry, or \`mirador unshare ${slug}\` to re-absorb if you have a backup.`,
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

/**
 * Scaffolds the markdown++ source of truth (design §7.2). Headings carry
 * explicit `{#anchor}`s from birth so they're stable diff/merge units (CV-00).
 * The `vision` frontmatter is a placeholder here; the creator's agent sharpens
 * it, and owner-gated evolution lands in CV-04.
 */
function renderSource(input: NewArtifactInput): string {
  const purpose = input.purpose || '(not specified yet — edit me)';
  const audience = input.audience || '(not specified yet — edit me)';
  return `---
vision: TODO — one line on what this artifact is converging toward
---

# ${input.slug} {#overview}

${purpose}

## Audience {#audience}

${audience}

## Notes {#notes}

Add your working notes here as you build out the artifact.
`;
}
