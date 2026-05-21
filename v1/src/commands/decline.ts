import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { parseSeed } from '../services/promptSeed.js';
import { declineRequest } from '../services/request.js';
import { logActivity } from '../shared/log.js';

export function registerDecline(program: Command): void {
  program
    .command('decline')
    .description('Decline a Mirador request seed.')
    .option('--from-request <text>', 'Inline request seed text.')
    .option('--from-file <path>', 'Read seed text from a file.')
    .requiredOption('--reason <text>', 'Reason for declining.')
    .action(async (opts: { fromRequest?: string; fromFile?: string; reason: string }) => {
      const raw = opts.fromRequest ?? (opts.fromFile ? await readFile(opts.fromFile, 'utf8') : '');
      const seed = parseSeed(raw);
      if (seed.kind !== 'request') {
        process.stderr.write('Provided seed is not a @mirador-request block.\n');
        process.exit(1);
      }
      const { responseSeed } = await declineRequest(seed, opts.reason);
      await logActivity(`decline request=${seed.askingFor}`);
      process.stdout.write(
        [
          `Declined "${seed.askingFor}".`,
          `Send this response seed back to ${seed.from}:`,
          '',
          responseSeed,
          '',
        ].join('\n'),
      );
    });
}
