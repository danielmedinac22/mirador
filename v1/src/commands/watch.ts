import type { Command } from 'commander';
import { keepCockpitAlive, startCockpit } from '../services/cockpit.js';
import { cobalt, muted } from '../shared/ansi.js';
import { logActivity } from '../shared/log.js';

export function registerWatch(program: Command): void {
  program
    .command('watch <slug>')
    .description('Live local cockpit — a read-only mirror of the rendered view.')
    .option('--theme <name>', 'page | memo | deck | console | atlas', 'page')
    .option('--port <n>', 'Port to bind (default: ephemeral).', (v) => Number.parseInt(v, 10))
    .option(
      '--poll <seconds>',
      'Remote convergence poll interval.',
      (v) => Number.parseInt(v, 10),
      10,
    )
    .action(async (slug: string, opts: { theme: string; port?: number; poll: number }) => {
      const cockpit = await startCockpit({ slug, theme: opts.theme, port: opts.port });
      await logActivity(`watch slug=${slug} url=${cockpit.url}`);
      process.stdout.write(
        `${cobalt('cockpit')} ${slug} → ${cockpit.url}  ${muted('(read-only · Ctrl-C to stop)')}\n`,
      );
      await keepCockpitAlive(cockpit, opts.poll);
    });
}
