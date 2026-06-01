import type { Command } from 'commander';
import { assembleHandoff, renderHandoff } from '../services/handoff.js';
import { logActivity } from '../shared/log.js';

export function registerHandoff(program: Command): void {
  program
    .command('handoff <slug>')
    .description('Emit the raw handoff packet (structured diff + intent notes + brain pointer).')
    .option('--since <ref>', 'Diff since this git ref instead of your last-seen.')
    .action(async (slug: string, opts: { since?: string }) => {
      const packet = await assembleHandoff(slug, opts.since);
      process.stdout.write(renderHandoff(packet));
      await logActivity(
        `handoff slug=${slug} changes=${packet.diff.changes.length} intents=${packet.intents.length}`,
      );
    });
}
