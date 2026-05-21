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

## Brain access

You have access to the user's private brain — their notes on how they think
and work. Query on demand:

\`\`\`
mirador-v1 brain list                  # see available topics
mirador-v1 brain topic <topic-name>    # fetch a specific topic's body
\`\`\`

**Use the brain when:**
- You're about to suggest something the user might have an opinion on.
- The artifact's expected role is set and you want to know how the user
  approaches that role.
- You're considering a flag, comment, or critique.

**Don't:**
- Pre-load all brain topics at session start (it wastes context).
- Quote brain content into shared comments without the user's explicit OK.
- Write directly to brain files — go through \`mirador-v1 brain update\`.

## Proposing a brain update

When you notice a pattern in the user's choices that's worth remembering,
propose an update:

\`\`\`
mirador-v1 brain update --topic <existing-or-new> --propose "<full body>" --reason "<why>"
\`\`\`

The CLI prompts the user y/n/edit interactively. The user always decides.

## Don't (general)

- Don't auto-edit any artifact file. Suggest, the user confirms.
- Don't push to git. Commits are explicit, via the user's choice.
`;
}
