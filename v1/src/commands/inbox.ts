import type { Command } from 'commander';
import { computeInbox, renderInbox } from '../services/inbox.js';

export function registerInbox(program: Command): void {
  program
    .command('inbox')
    .description('Show pending items needing your attention.')
    .option('--all', 'Show all items without rank filtering.')
    .action(async (opts: { all?: boolean }) => {
      const items = await computeInbox();
      if (opts.all) {
        const rows = items.map(
          (i) => `[${i.priorityScore}]  ${i.what.padEnd(40)} ${i.who.padEnd(12)} ${i.where}`,
        );
        process.stdout.write(`${rows.join('\n') || '(empty)'}\n`);
        return;
      }
      process.stdout.write(renderInbox(items));
    });
}
