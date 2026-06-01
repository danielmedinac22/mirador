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
          `Dry run.\n\n${actions.map((a) => `  · [${a.kind}] ${a.detail}`).join('\n')}\n`,
        );
        return;
      }

      p.intro('upgrade alpha → v1');
      const ok = await p.confirm({ message: 'Proceed?', initialValue: true });
      if (p.isCancel(ok) || !ok) {
        p.cancel('Aborted. Alpha unchanged.');
        return;
      }

      const { alphaConfig } = await detectAlpha();
      if (!alphaConfig) {
        p.cancel('No alpha install detected.');
        return;
      }

      const { user } = await ghAuthStatus();
      const { migrated, backupPath, shimAgent, brainHarvest } = await runUpgrade({
        ghHandle: user,
      });
      await logActivity(`upgrade migrated=${migrated.length} shim=${shimAgent}`);
      const lines = [
        `Upgraded. ${migrated.length} doc${migrated.length === 1 ? '' : 's'} kept as broadcast HTML${migrated.length ? ` (${migrated.join(', ')})` : ''}; new artifacts are markdown++.`,
        `Shim installed for ${shimAgent}. Alpha config backed up to ${backupPath}.`,
      ];
      if (brainHarvest) lines.push(brainHarvest);
      p.outro(lines.join('\n'));
    });
}
