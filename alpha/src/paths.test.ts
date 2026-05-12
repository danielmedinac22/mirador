import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('paths', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mirador-paths-'));
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env.MIRADOR_HOME;
    delete process.env.MIRADOR_POINTER;
  });

  it('returns env var when set', async () => {
    process.env.MIRADOR_HOME = tmp;
    const { resolveRoot } = await import('./paths.js');
    expect(resolveRoot()).toBe(tmp);
  });

  it('reads the pointer file when no env var is set', async () => {
    process.env.MIRADOR_POINTER = join(tmp, 'pointer');
    writeFileSync(join(tmp, 'pointer'), join(tmp, 'real-home'));
    const { resolveRoot } = await import('./paths.js');
    expect(resolveRoot()).toBe(join(tmp, 'real-home'));
  });

  it('falls back to ~/.mirador when no env var and no pointer', async () => {
    process.env.MIRADOR_POINTER = join(tmp, 'definitely-missing');
    const { resolveRoot } = await import('./paths.js');
    expect(resolveRoot()).toMatch(/\.mirador$/);
  });

  it('paths() returns derived paths from root', async () => {
    process.env.MIRADOR_HOME = tmp;
    const { paths } = await import('./paths.js');
    const p = paths();
    expect(p.root).toBe(tmp);
    expect(p.config).toBe(join(tmp, 'config.json'));
    expect(p.themes).toBe(join(tmp, 'themes'));
  });
});
