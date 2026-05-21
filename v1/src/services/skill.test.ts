import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installClaudeSkill, installCodexSkill, installSlashCommand } from './skill.js';

describe('services/skill', () => {
  let tmp: string;
  const originals = {
    claude: process.env.CLAUDE_HOME_OVERRIDE,
    codex: process.env.CODEX_HOME_OVERRIDE,
  };

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-skill-'));
    process.env.CLAUDE_HOME_OVERRIDE = join(tmp, 'claude');
    process.env.CODEX_HOME_OVERRIDE = join(tmp, 'codex');
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.CLAUDE_HOME_OVERRIDE = originals.claude;
    process.env.CODEX_HOME_OVERRIDE = originals.codex;
  });

  it('installClaudeSkill writes SKILL.md under <claude>/skills/mirador/', async () => {
    await installClaudeSkill();
    const content = await readFile(join(tmp, 'claude', 'skills', 'mirador', 'SKILL.md'), 'utf8');
    expect(content).toContain('name: mirador');
    expect(content).toContain('placeholder');
  });

  it('installSlashCommand writes the /mirador command file', async () => {
    await installSlashCommand();
    const content = await readFile(join(tmp, 'claude', 'commands', 'mirador.md'), 'utf8');
    expect(content).toContain('/mirador');
  });

  it('installCodexSkill writes SKILL.md under <codex>/skills/mirador/', async () => {
    await installCodexSkill();
    const content = await readFile(join(tmp, 'codex', 'skills', 'mirador', 'SKILL.md'), 'utf8');
    expect(content).toContain('name: mirador');
  });
});
