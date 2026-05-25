import * as p from '@clack/prompts';
import { ghAuthStatus } from '../adapters/gh-cli.js';
import { vercelWhoami } from '../adapters/vercel.js';
import { type BrainSeedAnswers, scaffoldBrain } from '../services/brain.js';
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

  p.log.step('Brain bootstrap');
  p.log.info(
    'Your brain is private notes that shape how Claude Code reads the artifacts\n' +
      'you open with mirador. Answer briefly — or press Enter to skip any. Edit\n' +
      'later with `mirador brain`.',
  );
  const role = await p.text({
    message: 'Your primary role at work?',
    placeholder: 'e.g. Product Engineering Manager / Senior Backend / CFO',
    defaultValue: '',
  });
  if (p.isCancel(role)) {
    p.cancel('Aborted.');
    return;
  }
  const reviewFocus = await p.text({
    message: "Reviewing someone else's work — what do you check first?",
    placeholder: 'e.g. scope creep, missing timelines, failure modes',
    defaultValue: '',
  });
  if (p.isCancel(reviewFocus)) {
    p.cancel('Aborted.');
    return;
  }
  const authorAudience = await p.text({
    message: "Authoring something — who's the audience?",
    placeholder: 'e.g. my team, the whole company, the board, external clients',
    defaultValue: '',
  });
  if (p.isCancel(authorAudience)) {
    p.cancel('Aborted.');
    return;
  }
  const domain = await p.text({
    message: 'Domain language you work in?',
    placeholder: 'e.g. fintech LatAm B2B; healthcare HIPAA; e-commerce checkout',
    defaultValue: '',
  });
  if (p.isCancel(domain)) {
    p.cancel('Aborted.');
    return;
  }
  const preferences = await p.text({
    message: 'Preferences that shape how you like to work?',
    placeholder: 'e.g. tables not prose; avoid jargon; flag missing dates',
    defaultValue: '',
  });
  if (p.isCancel(preferences)) {
    p.cancel('Aborted.');
    return;
  }

  const brainAnswers: BrainSeedAnswers = {
    role: String(role),
    reviewFocus: String(reviewFocus),
    authorAudience: String(authorAudience),
    domain: String(domain),
    preferences: String(preferences),
  };

  const spin = p.spinner();
  spin.start('Creating workspace repo on GitHub.');
  const { fullName } = await createWorkspaceRepo({ ghUser, repoName, owner });
  spin.stop(`Workspace repo: ${fullName}`);

  spin.start('Scaffolding workspace.');
  await scaffoldWorkspace();
  await scaffoldBrain(brainAnswers);
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
