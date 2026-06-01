import type { Command } from 'commander';
import { pushRefinement } from '../services/refine.js';
import { cobalt, muted, success } from '../shared/ansi.js';
import { logActivity } from '../shared/log.js';

export function registerPush(program: Command): void {
  program
    .command('push <slug>')
    .description('Commit a refinement with its auto-drafted intent note.')
    .requiredOption(
      '--intent <text>',
      'What changed and why (auto-drafted by your agent, editable).',
    )
    .option('--move <move>', 'Inferred collaboration move (internal — your agent supplies it).')
    .option('--offline', 'Commit locally only; do not push to the remote.')
    .action(async (slug: string, opts: { intent: string; move?: string; offline?: boolean }) => {
      const res = await pushRefinement(slug, {
        intent: opts.intent,
        move: opts.move,
        offline: opts.offline,
      });
      await logActivity(`push slug=${slug} sha=${res.sha.slice(0, 7)} pushed=${res.pushed}`);
      // The move tag is internal (design §11.4) — deliberately not printed.
      const sync = res.pushed ? '' : muted('  (local only)');
      process.stdout.write(
        `${success('Refined')} ${cobalt(slug)} → ${muted(res.sha.slice(0, 7))}. Intent recorded.${sync}\n`,
      );
    });
}
