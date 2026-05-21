import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { paths } from './paths.js';

export interface LastSeenEntry {
  last_open_at: string;
  last_open_commit?: string;
}

export type LastSeenStore = Record<string, LastSeenEntry>;

export async function readLastSeen(): Promise<LastSeenStore> {
  try {
    const raw = await readFile(paths.lastSeenFile(), 'utf8');
    return JSON.parse(raw) as LastSeenStore;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

export async function writeLastSeen(store: LastSeenStore): Promise<void> {
  await mkdir(dirname(paths.lastSeenFile()), { recursive: true });
  await writeFile(paths.lastSeenFile(), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function updateLastSeen(slug: string, entry: LastSeenEntry): Promise<void> {
  const store = await readLastSeen();
  store[slug] = entry;
  await writeLastSeen(store);
}
