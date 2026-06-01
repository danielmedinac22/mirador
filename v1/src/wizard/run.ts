import * as p from '@clack/prompts';
import { ghAuthStatus } from '../adapters/gh-cli.js';
import { vercelWhoami } from '../adapters/vercel.js';
import { brainSummary } from '../services/brain.js';
import { installClaudeSkill, installCodexSkill, installSlashCommand } from '../services/skill.js';
import { ensureUserProject } from '../services/vercel-project.js';
import { createWorkspaceRepo, scaffoldWorkspace } from '../services/workspace.js';
import { printSplash } from '../shared/ansi.js';
import { readConfig, writeConfig } from '../shared/config.js';
import { logActivity } from '../shared/log.js';

export interface RunInitOptions {
  reset?: boolean;
  org?: string;
}

export async function runInit(opts: RunInitOptions = {}): Promise<void> {
  printSplash();
  p.intro('setup');

  p.log.step('Checking environment.');
  const { user: ghUser } = await ghAuthStatus();
  await vercelWhoami();
  p.log.success(`GitHub: ${ghUser}`);

  const existing = await readConfig();
  if (existing && !opts.reset) {
    const proceed = await p.confirm({
      message: 'Already initialized. Re-run with current values as defaults?',
      initialValue: true,
    });
    if (p.isCancel(proceed) || !proceed) {
      p.cancel('Aborted.');
      return;
    }
  }

  const useOrg =
    opts.org ??
    (await p.text({
      message: 'GitHub namespace for your workspace (blank = personal):',
      placeholder: '',
      defaultValue: '',
    }));
  if (p.isCancel(useOrg)) {
    p.cancel('Aborted.');
    return;
  }
  const owner = (useOrg as string) || ghUser;
  const repoName = `${ghUser}-mirador`;

  p.log.step('Brain source');
  // No wizard, no store: your brain is your agent's living memory (design §8).
  // Detect it and confirm — read-only, nothing is scaffolded or copied.
  const brain = await brainSummary();
  const foundCount = brain.files.filter((f) => f.exists).length;
  p.log.info(
    `Mirador reads your brain from: ${brain.label}\n` +
      `${foundCount} file(s) found, ${brain.topics.length} topic(s). Read-only — your brain never leaves your machine.`,
  );
  const okBrain = await p.confirm({
    message: `Use ${brain.label} as your brain source?`,
    initialValue: true,
  });
  if (p.isCancel(okBrain)) {
    p.cancel('Aborted.');
    return;
  }

  const spin = p.spinner();
  spin.start('Creating workspace repo on GitHub.');
  const { fullName } = await createWorkspaceRepo({ ghUser, repoName, owner });
  spin.stop(`Workspace repo: ${fullName}`);

  spin.start('Scaffolding workspace.');
  await scaffoldWorkspace();
  spin.stop('Workspace ready.');

  spin.start('Ensuring Vercel project.');
  const { projectName, domain: vercelDomain } = await ensureUserProject(ghUser);
  spin.stop(`Vercel: ${projectName} (${vercelDomain})`);

  spin.start('Installing the Claude Code skill.');
  await installClaudeSkill();
  await installSlashCommand();
  const installCodex = await p.confirm({
    message: 'Also install for Codex?',
    initialValue: false,
  });
  if (!p.isCancel(installCodex) && installCodex) await installCodexSkill();
  spin.stop('Skills installed.');

  await writeConfig({
    version: 1,
    github: {
      handle: ghUser,
      workspaceRepo: fullName,
      sharedReposNamespace: owner === ghUser ? 'personal' : owner,
    },
    vercel: { project: projectName, domain: vercelDomain },
    brain: { location: 'workspace' },
    defaults: { theme: 'page', passwordPolicy: 'always-ask', visibility: 'unlisted' },
    docs: [],
  });
  await logActivity(`init ok user=${ghUser} repo=${fullName}`);
  p.outro('Ready. Try `mirador new <slug>`.');
}
