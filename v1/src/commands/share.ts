import * as p from '@clack/prompts';
import type { Command } from 'commander';
import { shareArtifact, unshareArtifact } from '../services/share.js';
import { logActivity } from '../shared/log.js';

export function registerShare(program: Command): void {
  program
    .command('share <slug>')
    .description('Promote a workspace artifact to a shared repo and invite collaborators.')
    .requiredOption('--with <emails>', 'Comma-separated invitee emails.')
    .option('--role <role>', 'Role expected from collaborators (reviewer, author, ...).')
    .option('--note <text>', 'Note to include in the invitation.')
    .option('--keep-history', 'Preserve git history (default: snapshot-clean).')
    .option('--no-publish', 'Skip Vercel deploy (preview + landing still rendered locally).')
    .option('--dry-run', 'Print what would happen without writing anything.')
    .option('--yes', 'Skip the confirmation prompt.')
    .action(
      async (
        slug: string,
        opts: {
          with: string;
          role?: string;
          note?: string;
          keepHistory?: boolean;
          publish: boolean;
          dryRun?: boolean;
          yes?: boolean;
          offline?: boolean;
        },
      ) => {
        const withEmails = opts.with
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const noPublish = opts.publish === false;

        if (opts.dryRun) {
          const result = await shareArtifact({
            slug,
            withEmails,
            role: opts.role,
            note: opts.note,
            keepHistory: opts.keepHistory,
            noPublish,
            dryRun: true,
          });
          process.stdout.write(
            `Dry run — plan:\n\n${(result.plan ?? []).map((l) => `  • ${l}`).join('\n')}\n`,
          );
          return;
        }

        if (!opts.yes && !opts.offline) {
          p.intro(`Mirador · share ${slug}`);
          p.log.info('This will:');
          p.log.message(`  • Create a private GitHub repo for "${slug}"`);
          p.log.message(`  • Invite ${withEmails.join(', ')}`);
          p.log.message(
            noPublish ? '  • Skip Vercel deploy' : '  • Deploy preview + landing to Vercel',
          );
          const ok = await p.confirm({ message: 'Proceed?', initialValue: true });
          if (p.isCancel(ok) || !ok) {
            p.cancel('Aborted.');
            return;
          }
        }

        const result = await shareArtifact({
          slug,
          withEmails,
          role: opts.role,
          note: opts.note,
          keepHistory: opts.keepHistory,
          offline: opts.offline,
          noPublish,
        });
        await logActivity(`share slug=${slug} with=${withEmails.join(',')}`);

        const lines = [
          `Shared "${slug}" to ${result.sharedRepo}.`,
          'Invitation seed (copy and paste to collaborator):',
          '',
          result.invitationSeed,
          '',
          `Landing: ${result.landingPath}`,
          `Preview: ${result.previewPath}`,
        ];
        if (result.deployedUrl) lines.push(`Deployed: ${result.deployedUrl}`);
        else if (!noPublish && !opts.offline) lines.push('Deploy: skipped (see logs for failure)');
        lines.push('');
        process.stdout.write(lines.join('\n'));
      },
    );

  program
    .command('unshare <slug>')
    .description('Bring a shared artifact back to workspace, archive the shared repo.')
    .option('--offline', 'Skip GitHub archive call (for testing).')
    .action(async (slug: string, opts: { offline?: boolean }) => {
      await unshareArtifact(slug, { offline: opts.offline });
      await logActivity(`unshare slug=${slug}`);
      process.stdout.write(`Unshared "${slug}".\n`);
    });
}
