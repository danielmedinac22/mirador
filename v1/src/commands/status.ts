import type { Command } from 'commander';
import { resolveArtifactPath } from '../services/artifact.js';
import { type ConvergenceState, computeConvergence } from '../services/convergence.js';
import { cobalt, muted, success, warn } from '../shared/ansi.js';
import { logActivity } from '../shared/log.js';

export function registerStatus(program: Command): void {
  program
    .command('status <slug>')
    .description('Convergence state — locked / contested / open by section.')
    .action(async (slug: string) => {
      const artifactPath = await resolveArtifactPath(slug);
      const state = await computeConvergence(artifactPath);
      process.stdout.write(renderStatus(slug, state));
      await logActivity(`status slug=${slug}`);
    });
}

function renderStatus(slug: string, state: ConvergenceState): string {
  const header = [
    cobalt(slug),
    state.vision ? `vision: ${state.vision}` : null,
    state.owner ? `owner: ${state.owner}` : null,
  ]
    .filter(Boolean)
    .join('   ·   ');

  const pick = (st: ConvergenceState['sections'][number]['state']) =>
    state.sections.filter((s) => s.state === st);
  const fmt = (s: ConvergenceState['sections'][number]) =>
    `§${s.anchor}${s.state === 'contested' && s.challenges ? muted(` (${s.challenges} open challenge${s.challenges === 1 ? '' : 's'})`) : ''}`;
  const row = (label: string, items: ConvergenceState['sections']) =>
    `  ${label}  ${items.length ? items.map(fmt).join('   ') : muted('—')}`;

  const locked = pick('locked');
  const contested = pick('contested');
  const open = pick('open');

  const nexts: string[] = [];
  if (contested[0]) nexts.push(`resolve §${contested[0].anchor}`);
  if (open[0]) nexts.push(`refine §${open[0].anchor}`);
  nexts.push('view');

  return `${[
    header,
    '',
    row(success('LOCKED   '), locked),
    row(warn('CONTESTED'), contested),
    row('OPEN     ', open),
    '',
    `  → ${nexts.join('   ·   ')}`,
  ].join('\n')}\n`;
}
