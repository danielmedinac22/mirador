import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { brainSummary, listBrain, loadBrain } from './brain.js';

const ENV_KEYS = ['MIRADOR_PROJECT_OVERRIDE', 'MIRADOR_AGENT'] as const;

describe('services/brain (agent-native, read-only)', () => {
  let project: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    project = await mkdtemp(join(tmpdir(), 'mirador-brain-'));
    process.env.MIRADOR_PROJECT_OVERRIDE = project;
    process.env.MIRADOR_AGENT = 'generic';
  });

  afterEach(async () => {
    await rm(project, { recursive: true, force: true });
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('cold start: listBrain empty, brainSummary reports the generic baseline', async () => {
    expect(await listBrain()).toEqual([]);
    const d = await brainSummary();
    expect(d.agent).toBe('generic');
    expect(d.topics).toEqual([]);
  });

  it('reads the AGENTS.md convention file as a topic', async () => {
    await writeFile(
      join(project, 'AGENTS.md'),
      '---\ndescription: how I work\n---\nPrefer tables.',
    );
    const entries = await listBrain();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ topic: 'agents', description: 'how I work' });
    expect(entries[0]?.body).toContain('Prefer tables.');
    expect(entries[0]?.appliesToRole).toBeUndefined(); // roles are inferred now

    const one = await loadBrain('agents');
    expect(one.body).toContain('Prefer tables.');
  });

  it('loadBrain throws for an unknown topic', async () => {
    await expect(loadBrain('nope')).rejects.toThrow(/No brain topic/);
  });

  it('brainSummary lists located files with existence flags', async () => {
    await writeFile(join(project, 'AGENTS.md'), 'x');
    const d = await brainSummary();
    const agentsFile = d.files.find((f) => f.path.endsWith('AGENTS.md'));
    expect(agentsFile?.exists).toBe(true);
    const claudeFile = d.files.find((f) => f.path.endsWith('CLAUDE.md'));
    expect(claudeFile?.exists).toBe(false);
  });
});
