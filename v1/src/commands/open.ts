import type { Command } from 'commander';
import { openSession } from '../services/session.js';
import { logActivity } from '../shared/log.js';

export function registerOpen(program: Command): void {
  program
    .command('open <slug>')
    .description('Open an artifact and print its session brief.')
    .action(async (slug: string) => {
      const { brief } = await openSession(slug);
      process.stdout.write(brief);
      await logActivity(`open slug=${slug}`);
    });
}
