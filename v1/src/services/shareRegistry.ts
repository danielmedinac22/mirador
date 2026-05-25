import { join } from 'node:path';
import { pathExists, readText, writeFileAtomic } from '../adapters/fs.js';

export type ShareKind = 'share' | 'request';

export interface ShareEntry {
  slug: string;
  kind: ShareKind;
  publishedAt: string;
  theme?: string;
  /** For shares: emails of collaborators. */
  sharedWith?: string[];
  /** For shares: role expected from collaborators. */
  role?: string;
  /** For shares: optional inviter note. */
  note?: string;
  /** For requests: recipient email. */
  to?: string;
  /** For requests: deadline (ISO date). */
  by?: string;
  /** For requests: context/background. */
  context?: string;
}

export interface ShareRegistry {
  version: 1;
  shares: ShareEntry[];
}

const REGISTRY_FILENAME = '.shares.json';

/**
 * Reads the share registry from <siteRoot>/.shares.json. Returns an empty
 * registry if the file does not exist. Safe to call on a fresh siteRoot.
 */
export async function readRegistry(siteRoot: string): Promise<ShareRegistry> {
  const file = join(siteRoot, REGISTRY_FILENAME);
  if (!(await pathExists(file))) return { version: 1, shares: [] };
  const raw = await readText(file);
  try {
    const parsed = JSON.parse(raw) as ShareRegistry;
    if (parsed.version !== 1 || !Array.isArray(parsed.shares)) {
      return { version: 1, shares: [] };
    }
    return parsed;
  } catch {
    // Corrupt registry — treat as empty so the next upsert rebuilds it.
    return { version: 1, shares: [] };
  }
}

/**
 * Inserts or replaces the entry for `entry.slug`. Most-recent share wins for
 * a given slug — a re-share with a different theme/collaborators replaces
 * the previous record. Persists sorted by `publishedAt` DESC so the index
 * page reads newest-first without re-sorting.
 */
export async function upsertEntry(siteRoot: string, entry: ShareEntry): Promise<void> {
  const registry = await readRegistry(siteRoot);
  const filtered = registry.shares.filter((s) => s.slug !== entry.slug);
  filtered.push(entry);
  filtered.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  const out: ShareRegistry = { version: 1, shares: filtered };
  const file = join(siteRoot, REGISTRY_FILENAME);
  await writeFileAtomic(file, `${JSON.stringify(out, null, 2)}\n`);
}

/**
 * Removes the entry for `slug`. Used by `mirador unshare`.
 */
export async function removeEntry(siteRoot: string, slug: string): Promise<void> {
  const registry = await readRegistry(siteRoot);
  const filtered = registry.shares.filter((s) => s.slug !== slug);
  if (filtered.length === registry.shares.length) return;
  const out: ShareRegistry = { version: 1, shares: filtered };
  const file = join(siteRoot, REGISTRY_FILENAME);
  await writeFileAtomic(file, `${JSON.stringify(out, null, 2)}\n`);
}
