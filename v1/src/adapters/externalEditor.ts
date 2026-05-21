import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface EditResult {
  edited: string;
  cancelled: boolean;
}

/**
 * Opens the user's $VISUAL/$EDITOR (or `vi` as fallback) on a temp file
 * pre-filled with `initialContent`. Blocks until the editor exits.
 *
 * Returns the edited content. If the user exits with non-zero status OR
 * the file is empty after editing, returns { cancelled: true }.
 */
export async function editInEditor(initialContent: string): Promise<EditResult> {
  const editor = process.env.VISUAL ?? process.env.EDITOR ?? 'vi';
  const tmp = await mkdtemp(join(tmpdir(), 'mirador-edit-'));
  const file = join(tmp, 'edit.md');
  await writeFile(file, initialContent, 'utf8');

  // Many editors expect their args as separate argv entries (e.g., `code --wait`).
  // Split a simple command line on whitespace.
  const [cmd, ...rest] = editor.split(/\s+/);
  if (!cmd) {
    await rm(tmp, { recursive: true, force: true });
    return { edited: initialContent, cancelled: true };
  }

  const exitCode: number = await new Promise((resolve) => {
    const child = spawn(cmd, [...rest, file], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });

  if (exitCode !== 0) {
    await rm(tmp, { recursive: true, force: true });
    return { edited: initialContent, cancelled: true };
  }

  const edited = await readFile(file, 'utf8');
  await rm(tmp, { recursive: true, force: true });

  if (edited.trim() === '') {
    return { edited: initialContent, cancelled: true };
  }
  return { edited, cancelled: false };
}
