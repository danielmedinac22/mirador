import type { Command } from 'commander';
import { listBrain, loadBrain } from '../services/brain.js';
import { detectExistingContext } from '../services/brainImport.js';
import { proposeBrainUpdate } from '../services/brainProposals.js';

export function registerBrain(program: Command): void {
  const brain = program.command('brain').description('Inspect or update your brain.');

  brain
    .command('list')
    .description('List all brain topics.')
    .action(async () => {
      const entries = await listBrain();
      if (entries.length === 0) {
        process.stdout.write('(brain is empty)\n');
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
        process.stdout.write('(no existing context detected)\n');
        return;
      }
      const lines = found.map((f) => `${f.source}  (${f.body.length} chars)`);
      process.stdout.write(`${lines.join('\n')}\n`);
      process.stdout.write('\nImport flow not yet wired — see issue #15 for the full UX.\n');
    });
}
