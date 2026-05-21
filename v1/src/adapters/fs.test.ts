import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDir, pathExists, readText, writeFileAtomic } from './fs.js';

describe('adapters/fs', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-fs-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('ensureDir creates nested directories', async () => {
    const nested = join(tmp, 'a', 'b', 'c');
    await ensureDir(nested);
    expect(await pathExists(nested)).toBe(true);
  });

  it('writeFileAtomic creates parents and writes contents', async () => {
    const file = join(tmp, 'nested', 'file.txt');
    await writeFileAtomic(file, 'hello');
    expect(await readText(file)).toBe('hello');
  });

  it('pathExists returns false for missing paths', async () => {
    expect(await pathExists(join(tmp, 'nope'))).toBe(false);
  });

  it('readText round-trips utf8 content', async () => {
    const file = join(tmp, 'utf8.txt');
    await writeFile(file, 'héllo wörld', 'utf8');
    expect(await readText(file)).toBe('héllo wörld');
  });
});
