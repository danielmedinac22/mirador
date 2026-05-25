import type { Command } from 'commander';
import { execa } from 'execa';
import { cobalt } from '../shared/ansi.js';
import { readConfig } from '../shared/config.js';
import { MiradorError } from '../shared/errors.js';

export function registerDashboard(program: Command): void {
  program
    .command('dashboard')
    .description('Open your mirador dashboard (the production site index) in the browser.')
    .option('--print', 'Print the dashboard URL instead of opening it.')
    .action(async (opts: { print?: boolean }) => {
      const config = await readConfig();
      if (!config) {
        throw new MiradorError('CONFIG_MISSING', 'Run `mirador init` first.');
      }
      const url = `https://${config.vercel.domain}/`;
      if (opts.print) {
        process.stdout.write(`${url}\n`);
        return;
      }
      process.stdout.write(`Opening ${cobalt(url)}\n`);
      // Fire and forget — the binary just dispatches to the OS handler.
      const opener =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
      await execa(opener, [url], { detached: true, stdio: 'ignore' }).catch(() => {
        // If the opener is missing (rare), fall back to printing the URL.
        process.stdout.write(`Open it manually: ${url}\n`);
      });
    });
}
