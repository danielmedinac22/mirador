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
    .option('--offline', 'Stub GitHub + Vercel calls (for testing).')
    .action(
      async (
        slug: string,
        opts: {
          with: string;
          role?: string;
          note?: string;
          keepHistory?: boolean;
          offline?: boolean;
        },
      ) => {
        const withEmails = opts.with
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const result = await shareArtifact({
          slug,
          withEmails,
          role: opts.role,
          note: opts.note,
          keepHistory: opts.keepHistory,
          offline: opts.offline,
        });
        await logActivity(`share slug=${slug} with=${withEmails.join(',')}`);
        process.stdout.write(
          [
            `Shared "${slug}" to ${result.sharedRepo}.`,
            'Invitation seed (copy and paste to collaborator):',
            '',
            result.invitationSeed,
            '',
            `Landing: ${result.landingPath}`,
            `Preview: ${result.previewPath}`,
            '',
          ].join('\n'),
        );
      },
    );

  program
    .command('unshare <slug>')
    .description('Bring a shared artifact back to workspace, archive the shared repo.')
    .option('--offline', 'Stub GitHub calls (for testing).')
    .action(async (slug: string, opts: { offline?: boolean }) => {
      await unshareArtifact(slug, { offline: opts.offline });
      await logActivity(`unshare slug=${slug}`);
      process.stdout.write(`Unshared "${slug}".\n`);
    });
}
