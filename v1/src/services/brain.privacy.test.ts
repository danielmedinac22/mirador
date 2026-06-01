import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDir } from '../adapters/fs.js';
import { paths } from '../shared/paths.js';
import { brainSummary, listBrain, loadBrain, readBrain } from './brain.js';

/**
 * Privacy boundary (design §3.1 / §8.2): the brain is read from the agent's own
 * memory and NEVER copied into a shared repo or a handoff packet. CV-01 made the
 * brain read-only by construction — these assertions guard that structurally.
 */
describe('services/brain — privacy boundary (agent-native)', () => {
  let tmp: string;
  let project: string;
  const saved: Record<string, string | undefined> = {};
  const KEYS = ['MIRADOR_HOME_OVERRIDE', 'MIRADOR_PROJECT_OVERRIDE', 'MIRADOR_AGENT'] as const;

  beforeEach(async () => {
    for (const k of KEYS) saved[k] = process.env[k];
    tmp = await mkdtemp(join(tmpdir(), 'mirador-brainpriv-'));
    project = join(tmp, 'project');
    await mkdir(project, { recursive: true });
    // Brain content lives in the project (agent memory), with "secret content".
    await writeFile(join(project, 'AGENTS.md'), '---\ndescription: t\n---\nsecret content');
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
    process.env.MIRADOR_PROJECT_OVERRIDE = project;
    process.env.MIRADOR_AGENT = 'generic';
    // A shared-clones dir to prove nothing is written there.
    await ensureDir(join(tmp, 'shared', 'fake-artifact'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('every brain path read sits under the project, never under shared/', async () => {
    const shared = paths.sharedClonesRoot();
    for (const topic of await readBrain()) {
      expect(topic.path.startsWith(project)).toBe(true);
      expect(topic.path.startsWith(shared)).toBe(false);
    }
    const d = await brainSummary();
    for (const f of d.files) {
      expect(f.path.startsWith(shared)).toBe(false);
    }
  });

  it('shared/ is untouched after brain reads (no write path exists)', async () => {
    await listBrain();
    await loadBrain('agents');
    await brainSummary();
    expect(await readdir(join(tmp, 'shared'))).toEqual(['fake-artifact']);
    expect(await readdir(join(tmp, 'shared', 'fake-artifact'))).toEqual([]);
  });
});
