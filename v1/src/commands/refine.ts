import type { Command } from 'commander';
import { openRefine } from '../services/refine.js';
import { logActivity } from '../shared/log.js';

export function registerRefine(program: Command): void {
  program
    .command('refine <slug>')
    .description('Open an artifact for refinement through your agent.')
    .action(async (slug: string) => {
      const { brief } = await openRefine(slug);
      process.stdout.write(brief);
      await logActivity(`refine slug=${slug}`);
    });
}
