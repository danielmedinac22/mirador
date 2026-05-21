import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalHome = process.env.HOME;

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => process.env.HOME ?? actual.homedir(),
  };
});

const { detectExistingContext } = await import('./brainImport.js');
const { ensureDir } = await import('../adapters/fs.js');

describe('services/brainImport', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-import-'));
    process.env.HOME = tmp;
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.HOME = originalHome;
  });

  it('returns empty when no contexts exist', async () => {
    const result = await detectExistingContext();
    expect(result).toEqual([]);
  });

  it('detects ~/CLAUDE.md', async () => {
    await writeFile(join(tmp, 'CLAUDE.md'), 'home claude content');
    const result = await detectExistingContext();
    expect(result.map((r) => r.source)).toContain('~/CLAUDE.md');
    expect(result[0]?.body).toBe('home claude content');
  });

  it('walks ~/.claude/projects/*/memory/', async () => {
    const dir = join(tmp, '.claude', 'projects', 'demo', 'memory');
    await ensureDir(dir);
    await writeFile(join(dir, 'user.md'), 'project user memory');
    await writeFile(join(dir, 'not-md.txt'), 'ignored');
    const result = await detectExistingContext();
    const sources = result.map((r) => r.source);
    expect(sources).toContain('~/.claude/projects/demo/memory/user.md');
    expect(sources).not.toContain('~/.claude/projects/demo/memory/not-md.txt');
  });

  it('walks ~/.codex/memory/', async () => {
    const dir = join(tmp, '.codex', 'memory');
    await ensureDir(dir);
    await writeFile(join(dir, 'prefs.md'), 'codex prefs');
    const result = await detectExistingContext();
    expect(result.map((r) => r.source)).toContain('~/.codex/memory/prefs.md');
  });
});
