import * as p from '@clack/prompts';
import { ghAuthStatus } from '../adapters/gh-cli.js';
import { vercelWhoami } from '../adapters/vercel.js';
import { type BrainSeedAnswers, scaffoldBrain } from '../services/brain.js';
import { installClaudeSkill, installCodexSkill, installSlashCommand } from '../services/skill.js';
import { ensureUserProject } from '../services/vercel-project.js';
import { createWorkspaceRepo, scaffoldWorkspace } from '../services/workspace.js';
import { readConfig, writeConfig } from '../shared/config.js';
import { logActivity } from '../shared/log.js';

export interface RunInitOptions {
  reset?: boolean;
  org?: string;
}

export async function runInit(opts: RunInitOptions = {}): Promise<void> {
  p.intro('Mirador v1 setup');

  // Pre-flight
  p.log.step('Checking environment...');
  const { user: ghUser } = await ghAuthStatus();
  await vercelWhoami();
  p.log.success(`GitHub: ${ghUser}`);

  // Existing state
  const existing = await readConfig();
  if (existing && !opts.reset) {
    const proceed = await p.confirm({
      message: 'Mirador is already initialized. Re-run with current values as defaults?',
      initialValue: true,
    });
    if (p.isCancel(proceed) || !proceed) {
      p.cancel('Aborted.');
      return;
    }
  }

  // Workspace location
  const useOrg =
    opts.org ??
    (await p.text({
      message: 'GitHub namespace for your workspace repo (leave blank for personal):',
      placeholder: '',
      defaultValue: '',
    }));
  if (p.isCancel(useOrg)) {
    p.cancel('Aborted.');
    return;
  }
  const owner = (useOrg as string) || ghUser;
  const repoName = `${ghUser}-mirador`;

  // Brain seed Qs
  p.log.step('Quick brain bootstrap (5 questions — skippable)');
  const role = await p.text({
    message: 'Your primary role at work?',
    placeholder: 'PM / Engineer / ...',
    defaultValue: '',
  });
  if (p.isCancel(role)) {
    p.cancel('Aborted.');
    return;
  }
  const reviewFocus = await p.text({
    message: 'When reviewing, what do you check first?',
    defaultValue: '',
  });
  if (p.isCancel(reviewFocus)) {
    p.cancel('Aborted.');
    return;
  }
  const authorAudience = await p.text({
    message: 'When authoring, your default audience size?',
    defaultValue: '',
  });
  if (p.isCancel(authorAudience)) {
    p.cancel('Aborted.');
    return;
  }
  const domain = await p.text({
    message: 'Domain language you work in?',
    placeholder: 'e.g. fintech, LatAm, B2B',
    defaultValue: '',
  });
  if (p.isCancel(domain)) {
    p.cancel('Aborted.');
    return;
  }
  const preferences = await p.text({
    message: 'Anything else? (free text)',
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

  // Create workspace
  const spin = p.spinner();
  spin.start('Creating workspace repo on GitHub...');
  const { fullName } = await createWorkspaceRepo({ ghUser, repoName, owner });
  spin.stop(`Workspace repo: ${fullName}`);

  spin.start('Scaffolding workspace...');
  await scaffoldWorkspace();
  await scaffoldBrain(brainAnswers);
  spin.stop('Workspace scaffolded.');

  // Vercel
  spin.start('Ensuring Vercel project...');
  const { projectName, domain: vercelDomain } = await ensureUserProject(ghUser);
  spin.stop(`Vercel project: ${projectName} (${vercelDomain})`);

  // Skill
  spin.start('Installing Claude Code skill...');
  await installClaudeSkill();
  await installSlashCommand();
  const installCodex = await p.confirm({
    message: 'Also install for Codex?',
    initialValue: false,
  });
  if (!p.isCancel(installCodex) && installCodex) await installCodexSkill();
  spin.stop('Skills installed.');

  // Persist config
  await writeConfig({
    version: 1,
    github: {
      handle: ghUser,
      workspaceRepo: fullName,
      sharedReposNamespace: owner === ghUser ? 'personal' : owner,
    },
    vercel: { project: projectName, domain: vercelDomain },
    brain: { location: 'workspace' },
    defaults: { theme: 'default', passwordPolicy: 'always-ask', visibility: 'unlisted' },
    docs: [],
  });
  await logActivity(`init ok user=${ghUser} repo=${fullName}`);
  p.outro('Mirador ready. Try `mirador-v1 new <slug>`.');
}
