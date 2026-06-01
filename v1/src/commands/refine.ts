import type { Command } from 'commander';
import { keepCockpitAlive, startCockpit } from '../services/cockpit.js';
import { openRefine } from '../services/refine.js';
import { cobalt, muted } from '../shared/ansi.js';
import { logActivity } from '../shared/log.js';

export function registerRefine(program: Command): void {
  program
    .command('refine <slug>')
    .description('Open an artifact for refinement through your agent.')
    .option('--watch', 'Also open the live cockpit (read-only mirror).')
    .option('--theme <name>', 'Cockpit theme: page | memo | deck | console | atlas', 'page')
    .action(async (slug: string, opts: { watch?: boolean; theme: string }) => {
      const { brief } = await openRefine(slug);
      process.stdout.write(brief);
      await logActivity(`refine slug=${slug}${opts.watch ? ' watch' : ''}`);

      if (opts.watch) {
        const cockpit = await startCockpit({ slug, theme: opts.theme });
        process.stdout.write(
          `\n${cobalt('cockpit')} → ${cockpit.url}  ${muted('(read-only · Ctrl-C to stop)')}\n`,
        );
        await keepCockpitAlive(cockpit, 10);
      }
    });
}
