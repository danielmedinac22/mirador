import { cp, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as p from '@clack/prompts';
import type { AgentKey, Config, PasswordPolicy, Visibility } from '../config.js';
import { readConfig, writeConfig } from '../config.js';
import { pointerPath } from '../paths.js';
import * as vercel from '../vercel.js';
import { installAgents } from './install-agents.js';

// dist/index.js → package root is two segments up (../..).
const PKG_DIR = resolve(fileURLToPath(import.meta.url), '../..');

export interface RunOptions {
  mode: 'init' | 'config';
}

export async function runInit(opts: RunOptions): Promise<void> {
  p.intro(opts.mode === 'init' ? 'mirador init' : 'mirador config');

  const cur = await readConfig();

  // 1. Agents
  const agentChoice = await p.multiselect({
    message: 'Which AI agents do you use?',
    required: true,
    initialValues: cur?.agents ?? ['claude-code'],
    options: [
      { value: 'claude-code', label: 'Claude Code' },
      { value: 'codex', label: 'Codex CLI (best-effort)' },
      { value: 'other', label: 'Otro / manual install' },
    ],
  });
  if (p.isCancel(agentChoice)) process.exit(0);
  const agents = agentChoice as AgentKey[];

  // 2. Storage path
  const storageAnswer = await p.text({
    message: 'Where should Mirador store your files?',
    initialValue: cur?.storage_path ?? join(homedir(), '.mirador'),
  });
  if (p.isCancel(storageAnswer)) process.exit(0);
  const storagePath = storageAnswer as string;

  // 3. Vercel
  const v = await vercel.checkInstalled();
  if (!v.ok) {
    p.log.error('Vercel CLI not found on PATH. Install with `npm i -g vercel` and re-run.');
    process.exit(1);
  }
  const auth = await vercel.checkAuth();
  if (!auth.ok) {
    p.log.warn('Not logged in to Vercel.');
    const goLogin = await p.confirm({ message: 'Run `vercel login` now?', initialValue: true });
    if (p.isCancel(goLogin) || !goLogin) {
      p.outro('Run `vercel login` and re-run `mirador init`.');
      process.exit(1);
    }
    if (vercel.loginInteractive() !== 0) {
      p.outro('vercel login failed.');
      process.exit(1);
    }
  }

  const defaultProjectName = cur?.vercel.projectName ?? 'mirador';
  const nameAnswer = await p.text({
    message: 'Vercel project name?',
    initialValue: defaultProjectName,
    validate: (s) => (/^[a-z0-9-]+$/.test(s) ? undefined : 'lowercase letters, digits, dashes'),
  });
  if (p.isCancel(nameAnswer)) process.exit(0);
  const projectName = nameAnswer as string;

  let vercelInfo = cur?.vercel;
  // Only re-link when starting fresh or when the user changed the project name.
  const shouldRelink =
    opts.mode === 'init' || !vercelInfo || vercelInfo.projectName !== projectName;
  if (shouldRelink) {
    const linked = await vercel.linkProject(projectName);
    vercelInfo = {
      projectId: linked.projectId,
      orgId: linked.orgId,
      projectName,
      domain: `${projectName}.vercel.app`,
    };
  }

  // 4. Default theme
  const themeAnswer = await p.select({
    message: 'Default theme?',
    initialValue: cur?.defaults.theme ?? 'default',
    options: [
      { value: 'default', label: 'default — clean & neutral' },
      { value: 'memo', label: 'memo — document / report' },
      { value: 'deck', label: 'deck — presentation' },
      { value: 'none', label: 'none — publish verbatim' },
    ],
  });
  if (p.isCancel(themeAnswer)) process.exit(0);

  // 5. Password policy
  const pwPolicy = await p.select({
    message: 'Password default policy?',
    initialValue: cur?.defaults.password_policy ?? 'always-ask',
    options: [
      { value: 'always-ask', label: 'always ask (recommended)' },
      { value: 'never', label: 'never use' },
      { value: 'always-on', label: 'always include' },
    ],
  });
  if (p.isCancel(pwPolicy)) process.exit(0);

  // 6. Visibility
  const visibility = await p.select({
    message: 'Visibility default?',
    initialValue: cur?.defaults.visibility ?? 'unlisted',
    options: [
      { value: 'unlisted', label: 'unlisted — link-only' },
      { value: 'public', label: 'public — listed on your Mirador index' },
    ],
  });
  if (p.isCancel(visibility)) process.exit(0);

  // PERSIST
  const defaultHome = join(homedir(), '.mirador');
  if (storagePath !== defaultHome) {
    await mkdir(dirname(pointerPath()), { recursive: true });
    await writeFile(pointerPath(), storagePath, 'utf8');
  }
  process.env.MIRADOR_HOME = storagePath;

  await mkdir(storagePath, { recursive: true });
  for (const d of ['themes', 'site', 'templates', 'scripts', 'logs', 'site/.vercel']) {
    await mkdir(join(storagePath, d), { recursive: true });
  }

  await cp(join(PKG_DIR, 'themes'), join(storagePath, 'themes'), { recursive: true, force: false });
  await cp(join(PKG_DIR, 'templates'), join(storagePath, 'templates'), {
    recursive: true,
    force: true,
  });
  await cp(join(PKG_DIR, 'scripts'), join(storagePath, 'scripts'), {
    recursive: true,
    force: true,
  });

  const config: Config = {
    version: 1,
    storage_path: storagePath,
    vercel: vercelInfo!,
    agents,
    defaults: {
      theme: themeAnswer as string,
      password_policy: pwPolicy as PasswordPolicy,
      visibility: visibility as Visibility,
    },
    docs: cur?.docs ?? [],
  };
  await writeConfig(config);

  await writeFile(
    join(storagePath, 'site', '.vercel', 'project.json'),
    JSON.stringify({ projectId: vercelInfo!.projectId, orgId: vercelInfo!.orgId }, null, 2),
    'utf8',
  );

  await installAgents(agents, PKG_DIR);

  p.outro('Done. Open Claude Code and type /mirador to publish your first HTML.');
}
