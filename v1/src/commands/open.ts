import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { parseSeed } from '../services/promptSeed.js';
import { openSession } from '../services/session.js';
import { MiradorError } from '../shared/errors.js';
import { logActivity } from '../shared/log.js';

export function registerOpen(program: Command): void {
  program
    .command('open [slug]')
    .description('Open an artifact and print its session brief.')
    .option(
      '--from-seed <text>',
      'Open an artifact directly from a pasted @mirador-invitation block.',
    )
    .option('--from-file <path>', 'Read invitation seed from a file.')
    .action(async (slug: string | undefined, opts: { fromSeed?: string; fromFile?: string }) => {
      if (opts.fromSeed || opts.fromFile) {
        const raw = opts.fromSeed ?? (opts.fromFile ? await readFile(opts.fromFile, 'utf8') : '');
        const seed = parseSeed(raw);
        if (seed.kind !== 'invitation') {
          throw new MiradorError('SEED_WRONG_KIND', 'Open expects an @mirador-invitation block.');
        }
        // For the offline e2e: just print the artifact slug + repo info as the "brief".
        // Real clone-and-open path comes when VS-03 share writes a usable repo.
        process.stdout.write(
          [
            `${seed.artifact}  ·  shared by ${seed.from}  ·  role: ${seed.roleExpected ?? '—'}`,
            '',
            'This artifact lives on GitHub:',
            `  ${seed.repo}`,
            '',
            'To collaborate, clone the repo and re-run `mirador-v1 open` inside it.',
            '',
          ].join('\n'),
        );
        await logActivity(`open from-seed slug=${seed.artifact}`);
        return;
      }
      if (!slug) {
        throw new MiradorError('OPEN_ARGS', 'Provide a slug or --from-seed.');
      }
      const { brief } = await openSession(slug);
      process.stdout.write(brief);
      await logActivity(`open slug=${slug}`);
    });
}
