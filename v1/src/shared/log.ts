import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { paths } from './paths.js';

export async function logActivity(line: string): Promise<void> {
  const logFile = join(paths.workspaceClone(), 'logs', 'activity.log');
  try {
    await mkdir(dirname(logFile), { recursive: true });
    await appendFile(logFile, `${new Date().toISOString()}\t${line}\n`, 'utf8');
  } catch {
    // Logging never blocks. Swallow errors.
  }
}
