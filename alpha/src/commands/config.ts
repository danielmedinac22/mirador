import type { Command } from 'commander';

export function registerConfig(program: Command) {
  program
    .command('config')
    .description('Re-run the setup wizard with current values as defaults.')
    .action(async () => {
      const { runInit } = await import('../wizard/run.js');
      await runInit({ mode: 'config' });
    });
}
