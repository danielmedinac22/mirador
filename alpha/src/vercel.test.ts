import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('vercel', () => {
  let mockDir: string;
  let prevPath: string | undefined;

  function mockVercel(out: string, exit = 0): void {
    const path = join(mockDir, 'vercel');
    writeFileSync(path, `#!/usr/bin/env bash\ncat <<'OUT'\n${out}\nOUT\nexit ${exit}\n`);
    chmodSync(path, 0o755);
  }

  beforeEach(() => {
    mockDir = mkdtempSync(join(tmpdir(), 'mirador-vercel-'));
    prevPath = process.env.PATH;
    process.env.PATH = `${mockDir}:${process.env.PATH}`;
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(mockDir, { recursive: true, force: true });
    if (prevPath !== undefined) process.env.PATH = prevPath;
  });

  it('checkInstalled returns version when present', async () => {
    mockVercel('Vercel CLI 33.0.0');
    const { checkInstalled } = await import('./vercel.js');
    const r = await checkInstalled();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toContain('33.0.0');
  });

  it('checkInstalled returns ok=false when missing', async () => {
    // PATH points only to a directory without vercel
    process.env.PATH = mockDir;
    const { checkInstalled } = await import('./vercel.js');
    const r = await checkInstalled();
    expect(r.ok).toBe(false);
  });

  it('checkAuth returns user', async () => {
    mockVercel('danielm');
    const { checkAuth } = await import('./vercel.js');
    expect(await checkAuth()).toEqual({ ok: true, user: 'danielm' });
  });

  it('checkAuth returns ok=false when whoami exits non-zero', async () => {
    mockVercel('not logged in', 1);
    const { checkAuth } = await import('./vercel.js');
    expect(await checkAuth()).toEqual({ ok: false });
  });
});
