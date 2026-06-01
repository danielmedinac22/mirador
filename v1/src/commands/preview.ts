import { join } from 'node:path';
import type { Command } from 'commander';
import { ensureDir, writeFileAtomic } from '../adapters/fs.js';
import { resolveArtifactPath } from '../services/artifact.js';
import { renderPreview } from '../services/staticPreview.js';
import { cobalt, muted } from '../shared/ansi.js';
import { logActivity } from '../shared/log.js';

export function registerPreview(program: Command): void {
  program
    .command('preview <slug>')
    .description('Render the artifact view (markdown++ → themed HTML) to a local file.')
    .option('--theme <name>', 'page | memo | deck | console | atlas | none', 'page')
    .action(async (slug: string, opts: { theme: string }) => {
      const artifactPath = await resolveArtifactPath(slug);
      const html = await renderPreview(artifactPath, opts.theme);

      const outDir = join(artifactPath, '.mirador');
      const out = join(outDir, 'preview.html');
      await ensureDir(outDir);
      await writeFileAtomic(out, html);

      await logActivity(`preview slug=${slug} theme=${opts.theme}`);
      process.stdout.write(
        `Rendered ${cobalt(slug)} (${opts.theme}) → ${muted(out)}\nOpen it in a browser to view.\n`,
      );
    });
}
