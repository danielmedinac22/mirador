import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { paths } from '../../shared/paths.js';
import { resolveBrainSource } from './index.js';

const ENV_KEYS = [
  'MIRADOR_PROJECT_OVERRIDE',
  'CLAUDE_HOME_OVERRIDE',
  'GEMINI_HOME_OVERRIDE',
  'CODEX_HOME_OVERRIDE',
  'MIRADOR_AGENT',
] as const;

describe('adapters/brainSource resolver', () => {
  let tmp: string;
  let project: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    tmp = await mkdtemp(join(tmpdir(), 'mirador-brainsrc-'));
    project = join(tmp, 'project');
    await mkdir(project, { recursive: true });
    process.env.MIRADOR_PROJECT_OVERRIDE = project;
    process.env.CLAUDE_HOME_OVERRIDE = join(tmp, 'claude');
    process.env.GEMINI_HOME_OVERRIDE = join(tmp, 'gemini');
    process.env.CODEX_HOME_OVERRIDE = join(tmp, 'codex');
    delete process.env.MIRADOR_AGENT;
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('cold start (empty project) resolves to generic, reads nothing', async () => {
    const source = await resolveBrainSource();
    expect(source.agent).toBe('generic');
    expect(await source.read()).toEqual([]);
  });

  it('AGENTS.md → codex', async () => {
    await writeFile(join(project, 'AGENTS.md'), '# Agents\n\nbe terse');
    const source = await resolveBrainSource();
    expect(source.agent).toBe('codex');
    const topics = await source.read();
    expect(topics).toHaveLength(1);
    expect(topics[0]?.body).toContain('be terse');
  });

  it('GEMINI.md → gemini', async () => {
    await writeFile(join(project, 'GEMINI.md'), 'gemini notes');
    expect((await resolveBrainSource()).agent).toBe('gemini');
  });

  it('Claude memory dir → claude, and wins over a stray AGENTS.md', async () => {
    const mem = paths.claudeMemoryDir(project);
    await mkdir(mem, { recursive: true });
    await writeFile(join(mem, 'MEMORY.md'), '- [role](role.md) — who I am');
    await writeFile(join(mem, 'role.md'), '---\ndescription: my role\n---\nPM');
    await writeFile(join(project, 'AGENTS.md'), 'stray'); // claude still wins

    const source = await resolveBrainSource();
    expect(source.agent).toBe('claude');
    const topics = await source.read();
    expect(topics.map((t) => t.name)).toEqual(expect.arrayContaining(['MEMORY', 'role']));
  });

  it('MIRADOR_AGENT override beats detection', async () => {
    await writeFile(join(project, 'AGENTS.md'), 'x'); // would be codex
    process.env.MIRADOR_AGENT = 'generic';
    expect((await resolveBrainSource()).agent).toBe('generic');
  });
});
