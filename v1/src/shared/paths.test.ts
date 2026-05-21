import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { paths } from './paths.js';

describe('paths', () => {
  const originals = {
    mirador: process.env.MIRADOR_HOME_OVERRIDE,
    claude: process.env.CLAUDE_HOME_OVERRIDE,
    codex: process.env.CODEX_HOME_OVERRIDE,
  };

  beforeEach(() => {
    process.env.MIRADOR_HOME_OVERRIDE = '/tmp/mirador-test-paths';
    process.env.CLAUDE_HOME_OVERRIDE = '/tmp/mirador-test-claude';
    process.env.CODEX_HOME_OVERRIDE = '/tmp/mirador-test-codex';
  });

  afterEach(() => {
    process.env.MIRADOR_HOME_OVERRIDE = originals.mirador;
    process.env.CLAUDE_HOME_OVERRIDE = originals.claude;
    process.env.CODEX_HOME_OVERRIDE = originals.codex;
  });

  it('roots under MIRADOR_HOME_OVERRIDE when set', () => {
    expect(paths.miradorHome()).toBe('/tmp/mirador-test-paths');
    expect(paths.workspaceClone()).toBe('/tmp/mirador-test-paths/workspace');
    expect(paths.sharedClonesRoot()).toBe('/tmp/mirador-test-paths/shared');
    expect(paths.sessionSkillsRoot()).toBe('/tmp/mirador-test-paths/session-skills');
    expect(paths.configFile()).toBe('/tmp/mirador-test-paths/config.json');
    expect(paths.lastSeenFile()).toBe('/tmp/mirador-test-paths/last-seen.json');
  });

  it('uses CLAUDE_HOME_OVERRIDE for skill paths', () => {
    expect(paths.claudeSkill()).toBe('/tmp/mirador-test-claude/skills/mirador');
    expect(paths.claudeCommand()).toBe('/tmp/mirador-test-claude/commands/mirador.md');
  });

  it('uses CODEX_HOME_OVERRIDE for codex skill', () => {
    expect(paths.codexSkill()).toBe('/tmp/mirador-test-codex/skills/mirador');
  });
});
