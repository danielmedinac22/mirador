import type { Command } from 'commander';
import { brainSummary } from '../services/brain.js';
import { cobalt, muted, success } from '../shared/ansi.js';

export function registerBrain(program: Command): void {
  program
    .command('brain')
    .description("Show the brain Mirador reads — your agent's living memory (diagnostic).")
    .action(async () => {
      const d = await brainSummary();
      const lines: string[] = [
        `${cobalt('brain source')}  ·  ${d.label}  ${muted(`(${d.agent})`)}`,
        '',
        muted('FILES'),
      ];
      for (const f of d.files) {
        const mark = f.exists ? success('✓') : muted('·');
        lines.push(`  ${mark} ${f.path}  ${muted(f.kind)}`);
      }
      lines.push('');
      if (d.topics.length === 0) {
        lines.push(muted('No brain content yet — running on the generic baseline.'));
        lines.push(muted('It sharpens as your agent memory grows.'));
      } else {
        lines.push(muted(`TOPICS (${d.topics.length})`));
        for (const t of d.topics) {
          lines.push(`  ${t.name}${t.description ? muted(`  —  ${t.description}`) : ''}`);
        }
      }
      lines.push('', muted('Read-only. Your brain never enters git or a handoff packet.'));
      process.stdout.write(`${lines.join('\n')}\n`);
    });
}
