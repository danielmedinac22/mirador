import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir, pathExists, readText, writeFileAtomic } from '../adapters/fs.js';
import { paths } from '../shared/paths.js';

const SLASH_COMMAND = `# /mirador

Invokes the mirador skill explicitly. The skill auto-activates on
@mirador-invitation / @mirador-request / @mirador-response prompt-seeds
and inside mirador workspace folders — use this slash command to force
an explicit invocation when none of those signals fire.
`;

export async function installClaudeSkill(): Promise<void> {
  await ensureDir(paths.claudeSkill());
  await writeFileAtomic(join(paths.claudeSkill(), 'SKILL.md'), await readSkillBody());
}

export async function installSlashCommand(): Promise<void> {
  await writeFileAtomic(paths.claudeCommand(), SLASH_COMMAND);
}

export async function installCodexSkill(): Promise<void> {
  await ensureDir(paths.codexSkill());
  await writeFileAtomic(join(paths.codexSkill(), 'SKILL.md'), await readSkillBody());
}

async function readSkillBody(): Promise<string> {
  if (process.env.MIRADOR_SKILL_BODY_OVERRIDE) return process.env.MIRADOR_SKILL_BODY_OVERRIDE;
  const source = resolveSkillSource();
  if (await pathExists(source)) return readText(source);
  return SKILL_FALLBACK;
}

function resolveSkillSource(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dev:   v1/src/services → v1/skill/SKILL.md
  // bundled: dist/index.js → ../skill/SKILL.md
  // Try in order.
  const candidates = [
    resolve(here, '..', '..', 'skill', 'SKILL.md'),
    resolve(here, '..', 'skill', 'SKILL.md'),
    resolve(here, '..', '..', '..', 'skill', 'SKILL.md'),
  ];
  return candidates[0] ?? '';
}

const SKILL_FALLBACK = `---
name: mirador
description: |
  mirador — share AI-generated artifacts on git. Activate on
  @mirador-invitation / @mirador-request / @mirador-response prompt-seeds,
  or inside a mirador workspace or shared-artifact folder.
---

# mirador

Paste-driven onboarding plus brain-aware session briefs.
Source of truth in the user's install: \`mirador --help\` and
\`docs/design/spec.md\` in the mirador repo.
`;
