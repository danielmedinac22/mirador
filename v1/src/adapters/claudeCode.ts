import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { paths } from '../shared/paths.js';
import { ensureDir, writeFileAtomic } from './fs.js';

export interface SessionSkillInput {
  slug: string;
  artifactPath: string;
  expectedRole?: string;
  brainPath?: string;
}

export async function writeSessionSkill(input: SessionSkillInput): Promise<string> {
  const id = randomUUID();
  const dir = join(paths.sessionSkillsRoot(), id);
  await ensureDir(dir);
  await writeFileAtomic(join(dir, 'SKILL.md'), renderSessionSkill(input));
  return dir;
}

function renderSessionSkill(input: SessionSkillInput): string {
  return `---
name: mirador-session-${input.slug}
description: |
  Mirador session skill for the artifact "${input.slug}". Renders the session
  brief produced by \`mirador-v1 open\` and guides the conversation around the
  artifact files at ${input.artifactPath}.
---

# Mirador session — ${input.slug}

Artifact path: ${input.artifactPath}
${input.expectedRole ? `Expected role: ${input.expectedRole}\n` : ''}
## How to respond

The user invoked \`mirador-v1 open ${input.slug}\`. The CLI has printed a
session brief. **Your first turn must render that brief verbatim** (table
format from PRD §11.1) — do not paraphrase, do not add narrative summary,
do not add bullets. After the brief, wait for the user's next message.

## Brain access (VS-08, not yet wired)

When VS-08 lands, you will have a \`mirador brain --topic <x>\` tool. For
now, brain-flag lines are omitted from the brief.

## Don't

- Don't auto-edit any file. Suggest, the user confirms.
- Don't push to git. Commits are explicit, via the user's choice.
`;
}
