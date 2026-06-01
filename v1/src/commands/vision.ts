import type { Command } from 'commander';
import { resolveArtifactPath } from '../services/artifact.js';
import { isOwner, readVision, setVision } from '../services/vision.js';
import { cobalt, muted } from '../shared/ansi.js';
import { readConfig } from '../shared/config.js';
import { MiradorError } from '../shared/errors.js';
import { logActivity } from '../shared/log.js';

export function registerVision(program: Command): void {
  program
    .command('vision <slug>')
    .description('Show or evolve the artifact vision (owner-gated to set).')
    .option('--set <text>', 'Set the vision (owner only).')
    .action(async (slug: string, opts: { set?: string }) => {
      const artifactPath = await resolveArtifactPath(slug);

      if (opts.set !== undefined) {
        const config = await readConfig();
        const viewer = config?.github.handle ?? '';
        if (!(await isOwner(artifactPath, viewer))) {
          throw new MiradorError(
            'NOT_OWNER',
            'Only the owner can set the vision.',
            'Propose it to the owner — they hold the vision.',
          );
        }
        await setVision(artifactPath, opts.set);
        await logActivity(`vision set slug=${slug}`);
        process.stdout.write(
          `Vision set for ${cobalt(slug)}. Review ${muted('source.md')} and push.\n`,
        );
        return;
      }

      const v = await readVision(artifactPath);
      process.stdout.write(
        v
          ? `${cobalt(slug)}  vision: ${v}\n`
          : `${cobalt(slug)}  ${muted('no vision yet — set one with `--set "<text>"`.')}\n`,
      );
    });
}
