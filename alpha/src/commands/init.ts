import type { Command } from 'commander';

export function registerInit(program: Command) {
  program
    .command('init')
    .description('First-run setup. Configures Vercel, defaults, and installs the skill.')
    .action(async () => {
      const { runInit } = await import('../wizard/run.js');
      await runInit({ mode: 'init' });
    });
}
