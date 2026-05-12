import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from './config.js';

describe('config', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mirador-cfg-'));
    process.env.MIRADOR_HOME = tmp;
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env.MIRADOR_HOME;
  });

  const baseConfig: Config = {
    version: 1,
    storage_path: '/somewhere',
    vercel: {
      projectId: 'p',
      projectName: 'n',
      domain: 'n.vercel.app',
      orgId: 'o',
    },
    agents: ['claude-code'],
    defaults: {
      theme: 'memo',
      password_policy: 'always-ask',
      visibility: 'unlisted',
    },
    docs: [],
  };

  it('returns null when missing', async () => {
    const { readConfig } = await import('./config.js');
    expect(await readConfig()).toBeNull();
  });

  it('round-trips a full config', async () => {
    const { readConfig, writeConfig } = await import('./config.js');
    await writeConfig(baseConfig);
    const read = await readConfig();
    expect(read?.defaults.theme).toBe('memo');
    expect(read?.agents).toEqual(['claude-code']);
    expect(read?.vercel.projectName).toBe('n');
  });
});
