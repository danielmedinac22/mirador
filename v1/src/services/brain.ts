import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists, writeFileAtomic } from '../adapters/fs.js';
import { MiradorError } from '../shared/errors.js';
import { paths } from '../shared/paths.js';

// --- VS-01 scaffolding ---

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

// --- VS-08 read primitives ---

export interface BrainFile {
  topic: string;
  description: string;
  appliesToRole?: string;
  body: string;
  path: string;
}

export async function brainRoot(): Promise<string> {
  const root = join(paths.workspaceClone(), 'brain');
  if (!(await pathExists(root))) {
    throw new MiradorError('BRAIN_MISSING', 'No brain found. Run `mirador-v1 init` first.');
  }
  return root;
}

export async function listBrain(): Promise<BrainFile[]> {
  const root = await brainRoot();
  const files = await readdir(root);
  const out: BrainFile[] = [];
  for (const f of files) {
    if (!f.endsWith('.md') || f === 'MEMORY.md') continue;
    const parsed = await loadBrain(f.replace(/\.md$/, ''));
    out.push(parsed);
  }
  out.sort((a, b) => a.topic.localeCompare(b.topic));
  return out;
}

export async function loadBrain(topic: string): Promise<BrainFile> {
  const root = await brainRoot();
  const filePath = join(root, `${topic}.md`);
  if (!(await pathExists(filePath))) {
    throw new MiradorError('BRAIN_TOPIC_MISSING', `No brain topic "${topic}".`);
  }
  const raw = await readFile(filePath, 'utf8');
  return parseBrain(topic, raw, filePath);
}

export function parseBrain(topic: string, raw: string, path: string): BrainFile {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { topic, description: '', body: raw, path };
  }
  const frontmatter = fmMatch[1] ?? '';
  const body = fmMatch[2] ?? '';
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const appliesToRole = frontmatter.match(/^\s*applies_to_role:\s*(\S+)$/m)?.[1]?.trim();
  return { topic, description, appliesToRole, body, path };
}
