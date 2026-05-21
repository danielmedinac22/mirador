import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig, writeConfig } from './config.js';

describe('config', () => {
  let tmp: string;
  const original = process.env.MIRADOR_HOME_OVERRIDE;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-cfg-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.MIRADOR_HOME_OVERRIDE = original;
  });

  it('returns null when no config file exists', async () => {
    expect(await readConfig()).toBeNull();
  });

  it('round-trips a config', async () => {
    const cfg = {
      version: 1 as const,
      github: { handle: 'me', workspaceRepo: 'me/me-mirador', sharedReposNamespace: 'personal' },
      vercel: { project: 'mirador-me', domain: 'mirador-me.vercel.app' },
      brain: { location: 'workspace' as const },
      defaults: {
        theme: 'default',
        passwordPolicy: 'always-ask' as const,
        visibility: 'unlisted' as const,
      },
      docs: [] as never[],
    };
    await writeConfig(cfg);
    const back = await readConfig();
    expect(back).toEqual(cfg);
  });
});
