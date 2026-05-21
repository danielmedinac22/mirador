import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDir } from '../adapters/fs.js';
import { changesSince } from './changeLog.js';

describe('services/changeLog', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-changelog-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('empty folder returns empty changes', async () => {
    expect(await changesSince(tmp, null)).toEqual([]);
  });

  it('with sinceIso=null, all files marked as added', async () => {
    await writeFile(join(tmp, 'a.txt'), 'a');
    await writeFile(join(tmp, 'b.txt'), 'b');
    const result = await changesSince(tmp, null);
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.kind === 'added')).toBe(true);
  });

  it('files older than sinceIso are excluded', async () => {
    const old = join(tmp, 'old.txt');
    await writeFile(old, 'old');
    const past = new Date('2020-01-01T00:00:00Z');
    await utimes(old, past, past);

    const result = await changesSince(tmp, new Date('2024-01-01T00:00:00Z').toISOString());
    expect(result).toEqual([]);
  });

  it('dotfiles are ignored', async () => {
    await writeFile(join(tmp, '.hidden'), 'x');
    await writeFile(join(tmp, 'visible.txt'), 'y');
    const result = await changesSince(tmp, null);
    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe('visible.txt');
  });

  it('walks subdirectories', async () => {
    await ensureDir(join(tmp, 'sub'));
    await writeFile(join(tmp, 'sub', 'nested.txt'), 'n');
    const result = await changesSince(tmp, null);
    expect(result.map((c) => c.path)).toContain(join('sub', 'nested.txt'));
  });

  it('sorts recent-first', async () => {
    const a = join(tmp, 'a.txt');
    const b = join(tmp, 'b.txt');
    await writeFile(a, 'a');
    await writeFile(b, 'b');
    const old = new Date(Date.now() - 60_000);
    await utimes(a, old, old);
    const result = await changesSince(tmp, null);
    expect(result[0]?.path).toBe('b.txt');
    expect(result[1]?.path).toBe('a.txt');
  });
});
