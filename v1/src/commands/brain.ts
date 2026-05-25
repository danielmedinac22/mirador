import * as p from '@clack/prompts';
import type { Command } from 'commander';
import { listBrain, loadBrain } from '../services/brain.js';
import {
  type ExistingContext,
  detectExistingContext,
  importContext,
} from '../services/brainImport.js';
import { proposeBrainUpdate } from '../services/brainProposals.js';

export function registerBrain(program: Command): void {
  const brain = program.command('brain').description('Inspect or update your brain.');

  brain
    .command('list')
    .description('List all brain topics.')
    .action(async () => {
      const entries = await listBrain();
      if (entries.length === 0) {
        process.stdout.write('Brain is empty.\n');
        return;
      }
      const lines = entries.map((e) => {
        const desc = e.description || '(no description)';
        const role = e.appliesToRole ? ` [role:${e.appliesToRole}]` : '';
        return `${e.topic}${role}  —  ${desc}`;
      });
      process.stdout.write(`${lines.join('\n')}\n`);
    });

  brain
    .command('show <topic>')
    .description('Print the body of a brain topic.')
    .action(async (topic: string) => {
      const file = await loadBrain(topic);
      process.stdout.write(file.body);
      if (!file.body.endsWith('\n')) process.stdout.write('\n');
    });

  brain
    .command('topic <topic>')
    .description('Machine-format brain query for agents — alias of `show`.')
    .action(async (topic: string) => {
      const file = await loadBrain(topic);
      process.stdout.write(file.body);
      if (!file.body.endsWith('\n')) process.stdout.write('\n');
    });

  brain
    .command('update')
    .description('Propose a brain update (interactive y/n/edit).')
    .requiredOption('--topic <topic>', 'Topic to update or create.')
    .requiredOption('--propose <text>', 'New body for the topic.')
    .option('--reason <text>', 'Why this update is proposed.')
    .action(async (opts: { topic: string; propose: string; reason?: string }) => {
      await proposeBrainUpdate({
        topic: opts.topic,
        proposedBody: opts.propose,
        reason: opts.reason,
      });
    });

  brain
    .command('detect')
    .description('List existing context files we could import (CLAUDE.md, memory/, etc.).')
    .action(async () => {
      const found = await detectExistingContext();
      if (found.length === 0) {
        process.stdout.write('Nothing to import — no context detected, or all already in.\n');
        return;
      }
      const lines = found.map((f) => `${f.source}  (${f.body.length} chars)`);
      process.stdout.write(`${lines.join('\n')}\n`);
      process.stdout.write('\nRun `mirador brain import` to bring these in.\n');
    });

  brain
    .command('import')
    .description('Interactively import detected existing contexts into your brain.')
    .action(async () => {
      const found = await detectExistingContext();
      if (found.length === 0) {
        process.stdout.write('Nothing to import — no context detected, or all already in.\n');
        return;
      }
      p.intro('brain import');
      const picks = (await p.multiselect({
        message: 'Which sources do you want to import?',
        options: found.map((f) => ({
          value: f.path,
          label: f.source,
          hint: `${f.body.length} chars`,
        })),
        required: false,
      })) as string[] | symbol;
      if (p.isCancel(picks) || !Array.isArray(picks) || picks.length === 0) {
        p.cancel('Nothing imported.');
        return;
      }

      const picked = found.filter((f) => picks.includes(f.path));
      for (const ctx of picked) {
        await importOne(ctx);
      }
      p.outro(`Imported ${picked.length} file${picked.length === 1 ? '' : 's'}.`);
    });
}

async function importOne(ctx: ExistingContext): Promise<void> {
  const suggestedTopic =
    ctx.source
      .split('/')
      .pop()
      ?.replace(/\.md$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '') ?? 'imported';

  const topic = await p.text({
    message: `Topic name for ${ctx.source}?`,
    placeholder: suggestedTopic,
    defaultValue: suggestedTopic,
  });
  if (p.isCancel(topic)) return;

  const description = await p.text({
    message: 'Short description?',
    placeholder: `(imported from ${ctx.source})`,
    defaultValue: `(imported from ${ctx.source})`,
  });
  if (p.isCancel(description)) return;

  const role = await p.select({
    message: 'Does this brain apply to a specific role?',
    options: [
      { value: '', label: 'No — cross-role / preferences' },
      { value: 'author', label: 'author' },
      { value: 'reviewer', label: 'reviewer' },
      { value: 'stakeholder', label: 'stakeholder' },
    ],
  });
  if (p.isCancel(role)) return;

  const { path } = await importContext({
    context: ctx,
    topic: String(topic) || suggestedTopic,
    description: String(description) || undefined,
    appliesToRole: role ? String(role) : undefined,
  });
  p.log.success(`Imported → ${path}`);
}
