import { join } from 'node:path';
import * as p from '@clack/prompts';
import { editInEditor } from '../adapters/externalEditor.js';
import { pathExists, readText, writeFileAtomic } from '../adapters/fs.js';
import { brainRoot } from './brain.js';

export interface ProposeInput {
  topic: string;
  proposedBody: string;
  reason?: string;
}

export interface ProposeResult {
  applied: boolean;
  reason?: string;
}

export async function proposeBrainUpdate(input: ProposeInput): Promise<ProposeResult> {
  const root = await brainRoot();
  const filePath = join(root, `${input.topic}.md`);
  const existing = (await pathExists(filePath)) ? await readText(filePath) : '';

  p.intro(`Mirador · brain proposal for "${input.topic}"`);
  if (input.reason) p.log.info(`Reason: ${input.reason}`);
  if (existing) {
    p.log.step('Current:');
    p.log.message(existing);
  } else {
    p.log.step('Current: (new topic)');
  }
  p.log.step('Proposed:');
  p.log.message(input.proposedBody);

  const choice = await p.select({
    message: 'Apply this update to your brain?',
    options: [
      { value: 'yes', label: 'Yes — apply as proposed' },
      { value: 'edit', label: 'Edit before applying (manual file edit)' },
      { value: 'no', label: 'No — reject' },
    ],
  });

  if (p.isCancel(choice) || choice === 'no') {
    p.outro('Brain unchanged.');
    return { applied: false, reason: 'rejected' };
  }

  let bodyToApply = input.proposedBody;
  if (choice === 'edit') {
    const editor = process.env.VISUAL ?? process.env.EDITOR ?? 'vi';
    p.log.info(`Opening ${editor}...`);
    const result = await editInEditor(input.proposedBody);
    if (result.cancelled) {
      p.outro('Edit cancelled — brain unchanged.');
      return { applied: false, reason: 'edit-cancelled' };
    }
    bodyToApply = result.edited;
  }

  await writeFileAtomic(filePath, ensureFrontmatter(input.topic, bodyToApply));
  p.outro(`Brain updated: ${filePath}`);
  return { applied: true };
}

export function ensureFrontmatter(topic: string, body: string): string {
  if (body.startsWith('---\n')) return body;
  return `---
name: ${topic}
description: (auto-added by brain proposal)
metadata:
  type: brain
---

${body}
`;
}
