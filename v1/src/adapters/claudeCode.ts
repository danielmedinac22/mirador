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
## How to respond — frame the handoff through your own brain

The user invoked \`mirador open ${input.slug}\`. The CLI printed a **handoff
packet**: the changed sections, the intent notes behind them, and a pointer to
your brain source. It is *not* the brief — **you** write the brief, by reframing
the packet through your own memory.

Your first turn is a **one-screen brief**:
- what changed → **why it matters to this user** (their lens, from your brain) →
  how it moves toward/away from the artifact's vision;
- cite the intent notes (the writer's reasons), don't restate the diff;
- end in **2–3 concrete next-refinements** (imperatives, not a question);
- tabular / single-critical-item. **No AI-prose**, no narrative preamble.

Two readers with different brains should get **visibly different briefs** — that
difference is the product. Then wait for the user.

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
