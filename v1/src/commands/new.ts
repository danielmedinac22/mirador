import * as p from '@clack/prompts';
import type { Command } from 'commander';
import { createArtifact } from '../services/artifact.js';
import { cobalt, muted } from '../shared/ansi.js';
import { logActivity } from '../shared/log.js';

export function registerNew(program: Command): void {
  program
    .command('new <slug>')
    .description('Create a new workspace artifact.')
    .option('--purpose <text>', 'Purpose of the artifact.')
    .option('--audience <text>', 'Intended audience.')
    .option('--no-prompts', 'Skip the 2-question wizard.')
    .action(
      async (slug: string, opts: { purpose?: string; audience?: string; prompts: boolean }) => {
        p.intro(`new ${cobalt(slug)}`);
        let purpose = opts.purpose;
        let audience = opts.audience;

        if (opts.prompts !== false && !purpose && !audience) {
          const pp = await p.text({
            message: 'Purpose of this artifact?',
            placeholder: 'e.g. Q3 forecast for the board',
            defaultValue: '',
          });
          if (p.isCancel(pp)) {
            p.cancel('Aborted.');
            return;
          }
          const aa = await p.text({
            message: 'Audience?',
            placeholder: 'e.g. board; engineering leads; CFO',
            defaultValue: '',
          });
          if (p.isCancel(aa)) {
            p.cancel('Aborted.');
            return;
          }
          purpose = String(pp) || undefined;
          audience = String(aa) || undefined;
        }

        const { path } = await createArtifact({ slug, purpose, audience });
        await logActivity(`new slug=${slug}`);
        p.outro(
          `Created at ${muted(path)} ${muted('(markdown++ source.md)')}.\n` +
            `Preview: \`mirador preview ${slug}\`  ·  Open: \`mirador open ${slug}\`.`,
        );
      },
    );
}
