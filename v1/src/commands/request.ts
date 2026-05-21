import type { Command } from 'commander';
import { createRequest } from '../services/request.js';
import { logActivity } from '../shared/log.js';

export function registerRequest(program: Command): void {
  program
    .command('request <title>')
    .description('Ask another user for an artifact that does not exist yet.')
    .requiredOption('--to <email>', 'Recipient email.')
    .option('--by <date>', 'Deadline (ISO date).')
    .option('--context <text>', 'Background / context for the request.')
    .option('--role <role>', 'Role expected (default: author).')
    .action(
      async (title: string, opts: { to: string; by?: string; context?: string; role?: string }) => {
        const result = await createRequest({
          title,
          toEmail: opts.to,
          by: opts.by,
          context: opts.context,
          role: opts.role,
        });
        await logActivity(`request to=${opts.to} slug=${result.slug}`);
        process.stdout.write(
          [
            `Created request "${result.slug}".`,
            'Seed (copy and paste to recipient):',
            '',
            result.seedText,
            '',
            `Landing: ${result.landingPath}`,
            '',
          ].join('\n'),
        );
      },
    );
}
