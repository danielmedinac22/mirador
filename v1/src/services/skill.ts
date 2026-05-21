import { join } from 'node:path';
import { ensureDir, writeFileAtomic } from '../adapters/fs.js';
import { paths } from '../shared/paths.js';

const SKILL_PLACEHOLDER = `---
name: mirador
description: |
  Mirador v1 placeholder skill. Full behavior is wired in VS-05.
---

# Mirador (placeholder)

The full skill body is defined when VS-05 (prompt-seed protocol) lands.
For now, this skill is a no-op declaration that lets \`mirador upgrade\`
find Mirador's skill location.
`;

const SLASH_COMMAND = `# /mirador

Use this to invoke the Mirador skill explicitly. The skill auto-activates
on prompt-seeds and inside Mirador artifact folders, but this command
forces an explicit invocation.
`;

export async function installClaudeSkill(): Promise<void> {
  await ensureDir(paths.claudeSkill());
  await writeFileAtomic(join(paths.claudeSkill(), 'SKILL.md'), SKILL_PLACEHOLDER);
}

export async function installSlashCommand(): Promise<void> {
  await writeFileAtomic(paths.claudeCommand(), SLASH_COMMAND);
}

export async function installCodexSkill(): Promise<void> {
  await ensureDir(paths.codexSkill());
  await writeFileAtomic(join(paths.codexSkill(), 'SKILL.md'), SKILL_PLACEHOLDER);
}
