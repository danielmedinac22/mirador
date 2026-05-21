import type { Command } from 'commander';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('First-run setup — workspace repo, brain, skill, Vercel.')
    .option('--reset', 'Re-create workspace from scratch (destructive).')
    .option('--org <name>', 'Use a specific GitHub org as the workspace namespace.')
    .action(async (opts: { reset?: boolean; org?: string }) => {
      const { runInit } = await import('../wizard/run.js');
      await runInit({ reset: opts.reset, org: opts.org });
    });
}
