import { join } from 'node:path';
import type { Command } from 'commander';
import { pathExists, readText } from '../adapters/fs.js';
import { resolveArtifactPath } from '../services/artifact.js';
import { sourceAtRef, structuredDiff } from '../services/changeLog.js';
import type { StructuredDiff } from '../services/document/index.js';
import { SOURCE_FILE } from '../services/staticPreview.js';
import { cobalt, muted } from '../shared/ansi.js';
import { MiradorError } from '../shared/errors.js';
import { logActivity } from '../shared/log.js';

export function registerDiff(program: Command): void {
  program
    .command('diff <slug>')
    .description('Structured, section-level diff of the working source vs the last commit.')
    .option('--ref <ref>', 'git ref to compare against', 'HEAD')
    .action(async (slug: string, opts: { ref: string }) => {
      const artifactPath = await resolveArtifactPath(slug);
      const sourcePath = join(artifactPath, SOURCE_FILE);
      if (!(await pathExists(sourcePath))) {
        throw new MiradorError(
          'NO_MARKDOWN_SOURCE',
          `Artifact "${slug}" has no ${SOURCE_FILE}.`,
          'Raw-HTML artifacts are broadcast-only — no structured diff.',
        );
      }

      const head = await readText(sourcePath);
      const base = await sourceAtRef(artifactPath, SOURCE_FILE, opts.ref);

      if (base === null) {
        process.stdout.write(`${cobalt(slug)}  ·  no prior committed version to diff against.\n`);
        await logActivity(`diff slug=${slug} ref=${opts.ref} no-base`);
        return;
      }

      const d = structuredDiff(base, head);
      process.stdout.write(renderDiff(slug, opts.ref, d));
      await logActivity(`diff slug=${slug} ref=${opts.ref} changes=${d.changes.length}`);
    });
}

const KIND_LABEL: Record<StructuredDiff['changes'][number]['kind'], string> = {
  added: '+ added',
  removed: '– removed',
  modified: '~ modified',
};

function renderDiff(slug: string, ref: string, d: StructuredDiff): string {
  if (d.changes.length === 0) {
    return `${cobalt(slug)}  ·  no section changes vs ${ref}.\n`;
  }
  const header = `${'SECTION'.padEnd(30)}CHANGE`;
  const sep = muted('─'.repeat(44));
  const rows = d.changes.map((c) => {
    const label = `§ ${c.headingText || c.anchor}`;
    return label.padEnd(30) + KIND_LABEL[c.kind];
  });
  return [
    `${cobalt(slug)}  ·  ${d.changes.length} changed section(s) vs ${ref}`,
    '',
    header,
    sep,
    ...rows,
    '',
  ].join('\n');
}
