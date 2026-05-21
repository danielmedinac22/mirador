import { join } from 'node:path';
import { writeFileAtomic } from '../adapters/fs.js';
import { paths } from '../shared/paths.js';

export interface BrainSeedAnswers {
  role: string;
  reviewFocus: string;
  authorAudience: string;
  domain: string;
  preferences: string;
}

export async function scaffoldBrain(answers: BrainSeedAnswers): Promise<void> {
  const root = join(paths.workspaceClone(), 'brain');
  await writeFileAtomic(join(root, 'MEMORY.md'), BRAIN_INDEX);
  await writeFileAtomic(join(root, 'preferences.md'), brainPrefs(answers));
  await writeFileAtomic(join(root, 'role-author.md'), brainAuthor(answers));
  await writeFileAtomic(join(root, 'role-reviewer.md'), brainReviewer(answers));
}

const BRAIN_INDEX = `- [preferences](preferences.md) — Cross-role defaults
- [role-author](role-author.md) — How I approach authoring
- [role-reviewer](role-reviewer.md) — How I approach reviewing
`;

function brainPrefs(a: BrainSeedAnswers): string {
  return `---
name: preferences
description: My cross-role defaults
metadata:
  type: brain
---

I work in ${a.domain || 'general knowledge work'}.

${a.preferences || 'Prefer tables over prose. Avoid jargon.'}
`;
}

function brainAuthor(a: BrainSeedAnswers): string {
  return `---
name: role-author
description: How I approach authoring
metadata:
  type: brain
  applies_to_role: author
---

When I author, my default audience is ${a.authorAudience || 'a small team'}.
My role is ${a.role || 'PM/Engineer'} — I default to scoping clearly and stating assumptions.
`;
}

function brainReviewer(a: BrainSeedAnswers): string {
  return `---
name: role-reviewer
description: How I approach reviewing
metadata:
  type: brain
  applies_to_role: reviewer
---

When I review, I check ${a.reviewFocus || 'scope, timelines, and failure modes'} first.
`;
}
