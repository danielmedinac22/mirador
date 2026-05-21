import * as p from '@clack/prompts';
import type { Command } from 'commander';
import { ghAuthStatus } from '../adapters/gh-cli.js';
import { detectAlpha, planUpgrade, runUpgrade } from '../services/upgrade.js';
import { logActivity } from '../shared/log.js';

export function registerUpgrade(program: Command): void {
  program
    .command('upgrade')
    .description('Migrate an existing alpha install (`mirador-cli` alpha) to v1.')
    .option('--dry-run', 'Print what would happen without changing anything.')
    .action(async (opts: { dryRun?: boolean }) => {
      const actions = await planUpgrade();
      if (actions.length === 1 && actions[0]?.kind === 'noop') {
        process.stdout.write(`${actions[0].detail}\n`);
        return;
      }

      if (opts.dryRun) {
        process.stdout.write(
          `Dry run — plan:\n\n${actions.map((a) => `  • [${a.kind}] ${a.detail}`).join('\n')}\n`,
        );
        return;
      }

      p.intro('Mirador · upgrade alpha → v1');
      const ok = await p.confirm({ message: 'Proceed with upgrade?', initialValue: true });
      if (p.isCancel(ok) || !ok) {
        p.cancel('Aborted — alpha install unchanged.');
        return;
      }

      const { alphaConfig } = await detectAlpha();
      if (!alphaConfig) {
        p.cancel('No alpha install detected.');
        return;
      }

      const { user } = await ghAuthStatus();
      const { migrated, backupPath } = await runUpgrade({ ghHandle: user });
      await logActivity(`upgrade migrated=${migrated.length}`);
      p.outro(
        `Upgraded.\nMigrated artifacts: ${migrated.length}${migrated.length ? ` (${migrated.join(', ')})` : ''}\nAlpha config backed up to: ${backupPath}`,
      );
    });
}
