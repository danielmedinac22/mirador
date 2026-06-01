import { readdir, realpath, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { repoRoot, showFileAtRef } from '../adapters/git.js';
import * as document from './document/index.js';
import type { StructuredDiff } from './document/index.js';

export interface FileChange {
  path: string;
  kind: 'added' | 'modified';
  mtime: Date;
}

export async function changesSince(
  artifactPath: string,
  sinceIso: string | null,
): Promise<FileChange[]> {
  const since = sinceIso ? new Date(sinceIso).getTime() : 0;
  const changes: FileChange[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      const st = await stat(full);
      if (st.mtimeMs > since) {
        changes.push({
          path: relative(artifactPath, full),
          kind: since === 0 || st.birthtimeMs > since ? 'added' : 'modified',
          mtime: st.mtime,
        });
      }
    }
  }

  await walk(artifactPath);
  changes.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return changes;
}

/**
 * Structured, section-level diff between two markdown++ sources (design §7.1),
 * delegating to the document seam. This is what the reader's handoff packet
 * (CV-03) consumes; `changesSince` (file-mtime) stays for the open/session
 * brief until that wiring lands.
 */
export function structuredDiff(baseSource: string, headSource: string): StructuredDiff {
  return document.diff(document.parse(baseSource), document.parse(headSource));
}

/**
 * Contents of an artifact's source file at a git `ref` (e.g. `HEAD`), or null
 * if the dir isn't a repo / the file doesn't exist at that ref / it lies outside
 * the repo. Both the repo root (from git) and the source path are resolved to
 * their real paths first, so symlinked temp dirs (macOS `/var` → `/private/var`)
 * don't poison the repo-relative path. This is the `mirador diff` base lookup.
 */
export async function sourceAtRef(
  artifactPath: string,
  sourceFile: string,
  ref: string,
): Promise<string | null> {
  const root = await repoRoot(artifactPath);
  if (!root) return null;
  let realSource: string;
  try {
    realSource = await realpath(join(artifactPath, sourceFile));
  } catch {
    return null;
  }
  const rel = relative(root, realSource).split(sep).join('/');
  if (rel.startsWith('..')) return null; // source lives outside the repo
  return showFileAtRef(artifactPath, ref, rel);
}
