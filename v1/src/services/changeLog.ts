import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

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
