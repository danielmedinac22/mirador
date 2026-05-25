import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { parseSeed } from '../services/promptSeed.js';
import { acceptRequest } from '../services/request.js';
import { logActivity } from '../shared/log.js';

export function registerAccept(program: Command): void {
  program
    .command('accept')
    .description('Accept a mirador request.')
    .option('--from-request <text>', 'Inline request seed text.')
    .option('--from-file <path>', 'Read seed text from a file.')
    .action(async (opts: { fromRequest?: string; fromFile?: string }) => {
      const raw = opts.fromRequest ?? (opts.fromFile ? await readFile(opts.fromFile, 'utf8') : '');
      const seed = parseSeed(raw);
      if (seed.kind !== 'request') {
        process.stderr.write('Not a @mirador-request block.\n');
        process.exit(1);
      }
      const { artifactPath, responseSeed } = await acceptRequest(seed);
      await logActivity(`accept request=${seed.askingFor}`);
      process.stdout.write(
        [
          `Accepted. Artifact at ${artifactPath}.`,
          '',
          `Send this back to ${seed.from}:`,
          '',
          responseSeed,
          '',
        ].join('\n'),
      );
    });
}
