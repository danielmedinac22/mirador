import { join } from 'node:path';
import { pathExists, readText, writeFileAtomic } from '../adapters/fs.js';
import { MiradorError } from '../shared/errors.js';
import * as document from './document/index.js';
import { readManifest } from './role.js';
import { SOURCE_FILE } from './staticPreview.js';

/**
 * The convergence anchor (design §11.1): one evolving vision statement in the
 * artifact's frontmatter — what it is converging toward. Auto-drafted by the
 * creator's agent (CV-00 scaffolds a placeholder); held by the owner; sharpened
 * by lenses. Owner-gated to set (§11.2).
 */

const PLACEHOLDER_PREFIX = 'TODO';

export async function readVision(artifactPath: string): Promise<string | undefined> {
  const sourcePath = join(artifactPath, SOURCE_FILE);
  if (!(await pathExists(sourcePath))) return undefined;
  const v = document.parse(await readText(sourcePath)).frontmatter.vision;
  return typeof v === 'string' ? v : undefined;
}

export function isPlaceholderVision(v: string | undefined): boolean {
  return !v || v.trim() === '' || v.trim().startsWith(PLACEHOLDER_PREFIX);
}

export async function setVision(artifactPath: string, text: string): Promise<void> {
  const sourcePath = join(artifactPath, SOURCE_FILE);
  if (!(await pathExists(sourcePath))) {
    throw new MiradorError('NO_MARKDOWN_SOURCE', `No ${SOURCE_FILE} to hold a vision.`);
  }
  const model = document.parse(await readText(sourcePath));
  model.frontmatter.vision = text.trim();
  await writeFileAtomic(sourcePath, document.serialize(model));
}

/**
 * Owner check for vision-setting. An unshared draft (no manifest) or one with no
 * declared owner is yours; once an owner is declared, only they may set it.
 */
export async function isOwner(artifactPath: string, viewer: string): Promise<boolean> {
  const m = await readManifest(artifactPath);
  if (!m || !m.owner) return true;
  return m.owner === viewer;
}
