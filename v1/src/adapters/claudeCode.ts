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
  brief produced by \`mirador open\` and guides the conversation around the
  artifact files at ${input.artifactPath}.
---

# Mirador session — ${input.slug}

Artifact path: ${input.artifactPath}
${input.expectedRole ? `Expected role: ${input.expectedRole}\n` : ''}
## How to respond

The user invoked \`mirador open ${input.slug}\`. The CLI has printed a
session brief. **Your first turn must render that brief verbatim** (table
format from PRD §11.1) — do not paraphrase, do not add narrative summary,
do not add bullets. After the brief, wait for the user's next message.

## Brain — your own memory

Your **brain** is your own living memory — what you already carry about this
user (your memory + their \`CLAUDE.md\` / \`AGENTS.md\`). There is no separate store
and no brain-edit command: you read it natively and update it through your normal
memory mechanism. \`mirador brain\` shows, read-only, what Mirador resolves.

- Use it to frame the artifact in *this* user's terms — what they check first.
- Never quote brain content into a shared artifact or comment without explicit OK.
- It never enters git or a handoff packet.

## Refine + push

The artifact's \`source.md\` is refinable — wet clay, not a finished page. Edit by
section (headings carry stable \`{#anchor}\`s; touch only what you mean to);
\`mirador preview ${input.slug}\` renders the view. When the user is ready,
**auto-draft** a one-line intent (*what changed & why, in their context*) — never
make them write it — silently infer the move (critique / extend / tighten /
reframe / question / endorse; never name it), and run:

\`\`\`
mirador push ${input.slug} --intent "<one line>" --move <inferred>
\`\`\`

## Don't (general)

- Don't auto-edit an artifact without the user steering. Refine with them.
- Don't block on a form — the intent note is auto-drafted and editable.
`;
}
