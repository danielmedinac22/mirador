import type { Command } from 'commander';
import { composeSeed } from '../services/promptSeed.js';
import { readConfig } from '../shared/config.js';
import { logActivity } from '../shared/log.js';

export function registerComment(program: Command): void {
  program
    .command('comment <slug>')
    .description('Compose a T1 comment as a paste-back @mirador-response (no clone needed).')
    .requiredOption('--text <text>', 'Your comment.')
    .option('--to <handle>', 'Who to address (the owner / sender).')
    .action(async (slug: string, opts: { text: string; to?: string }) => {
      const config = await readConfig();
      const handle = config?.github.handle;
      const from = handle ? `${handle} <${handle}@users.noreply.github.com>` : 'a reader';
      const seed = composeSeed({
        kind: 'response',
        from,
        to: opts.to ?? '(owner)',
        reRequest: slug,
        status: 'commented',
        note: opts.text,
        sent: new Date().toISOString(),
      });
      process.stdout.write(`${seed}\n`);
      await logActivity(`comment slug=${slug}`);
    });
}
