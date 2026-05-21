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
    .option('--no-publish', 'Skip Vercel deploy of the request landing.')
    .option('--dry-run', 'Print what would happen without writing anything.')
    .action(
      async (
        title: string,
        opts: {
          to: string;
          by?: string;
          context?: string;
          role?: string;
          publish: boolean;
          dryRun?: boolean;
          offline?: boolean;
        },
      ) => {
        const noPublish = opts.publish === false;
        const result = await createRequest({
          title,
          toEmail: opts.to,
          by: opts.by,
          context: opts.context,
          role: opts.role,
          offline: opts.offline,
          noPublish,
          dryRun: opts.dryRun,
        });

        if (result.dryRun) {
          process.stdout.write(
            `Dry run — plan:\n\n${(result.plan ?? []).map((l) => `  • ${l}`).join('\n')}\n`,
          );
          return;
        }

        await logActivity(`request to=${opts.to} slug=${result.slug}`);
        const lines = [
          `Created request "${result.slug}".`,
          'Seed (copy and paste to recipient):',
          '',
          result.seedText,
          '',
          `Landing: ${result.landingPath}`,
        ];
        if (result.deployedUrl) lines.push(`Deployed: ${result.deployedUrl}`);
        else if (!noPublish && !opts.offline) lines.push('Deploy: skipped (see logs for failure)');
        lines.push('');
        process.stdout.write(lines.join('\n'));
      },
    );
}
