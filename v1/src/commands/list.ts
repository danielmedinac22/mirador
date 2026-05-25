import { join } from 'node:path';
import type { Command } from 'commander';
import { pathExists } from '../adapters/fs.js';
import { readRegistry } from '../services/shareRegistry.js';
import { discoverPublishedSlugs } from '../services/siteIndex.js';
import { cobalt, dim, muted } from '../shared/ansi.js';
import { readConfig } from '../shared/config.js';
import { MiradorError } from '../shared/errors.js';
import { paths } from '../shared/paths.js';

export function registerList(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List every artifact you have published, with dates and production URLs.')
    .action(async () => {
      const config = await readConfig();
      if (!config) {
        throw new MiradorError('CONFIG_MISSING', 'Run `mirador init` first.');
      }
      const siteRoot = join(paths.workspaceClone(), 'site');
      const haveSite = await pathExists(siteRoot);
      const registry = haveSite
        ? await readRegistry(siteRoot)
        : { version: 1 as const, shares: [] };
      const known = new Set(registry.shares.map((s) => s.slug));
      const legacy = haveSite
        ? (await discoverPublishedSlugs(siteRoot)).filter((s) => !known.has(s))
        : [];

      if (registry.shares.length === 0 && legacy.length === 0) {
        process.stdout.write('Nothing here yet. Run `mirador share <slug>` to publish.\n');
        return;
      }

      const base = `https://${config.vercel.domain}`;
      const lines: string[] = [];

      lines.push(
        `${muted('SLUG'.padEnd(28))}${muted('KIND'.padEnd(10))}${muted('DATE'.padEnd(12))}${muted('PRODUCTION URL')}`,
      );
      lines.push(dim('─'.repeat(88)));

      for (const s of registry.shares) {
        const slug = s.slug.length > 26 ? `${s.slug.slice(0, 25)}…` : s.slug;
        const path = s.kind === 'request' ? `/r/${s.slug}/` : `/i/${s.slug}/`;
        const url = `${base}${path}`;
        lines.push(
          `${cobalt(slug.padEnd(28))}${(s.kind ?? 'share').padEnd(10)}${s.publishedAt.slice(0, 10).padEnd(12)}${muted(url)}`,
        );
      }
      for (const slug of legacy) {
        const trimmed = slug.length > 26 ? `${slug.slice(0, 25)}…` : slug;
        const url = `${base}/i/${slug}/`;
        lines.push(
          `${muted(trimmed.padEnd(28))}${muted('legacy'.padEnd(10))}${muted('—'.padEnd(12))}${muted(url)}`,
        );
      }
      if (legacy.length > 0) {
        lines.push('');
        lines.push(
          muted(
            `${legacy.length} legacy item${legacy.length === 1 ? '' : 's'} — re-share to track with dates.`,
          ),
        );
      }
      lines.push('');
      lines.push(`${dim('dashboard')}  ${cobalt(`${base}/`)}`);
      lines.push('');
      process.stdout.write(`${lines.join('\n')}\n`);
    });
}
