# VS-01 — `mirador init` detailed plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `mirador-v1 init` end-to-end. A fresh user runs it and ends up with workspace repo + brain + skill + Vercel project, all idempotent and pre-flight checked.

**Issue:** [#4](https://github.com/danielmedinac22/mirador/issues/4)
**Branch:** `feat/v1-vs-01-init` (off of `feat/v2-design-and-v1-scaffold`)

**Reference docs:**
- PRD §7.1 — flow
- SAD §2 (modules), §3 (state), §5 (security)
- Overview: [`2026-05-21-mirador-v1-overview.md`](2026-05-21-mirador-v1-overview.md#vs-01)

---

## Phase 0 — Dependencies + structure

The `v1/` scaffold exists (`package.json`, `tsconfig.json`, `biome.json`, `src/index.ts`). Now install deps and create the empty module skeleton.

### Task 0.1: Install + lay out folders

- [ ] **Step 1:** `cd v1 && npm install` — expect no errors.
- [ ] **Step 2:** Create folders:
  ```
  v1/src/commands/
  v1/src/services/
  v1/src/adapters/
  v1/src/shared/
  v1/src/wizard/
  v1/tests/fixtures/
  ```
- [ ] **Step 3:** Create `v1/src/shared/index.ts` as a barrel:
  ```ts
  export * from './paths.js';
  export * from './config.js';
  export * from './errors.js';
  export * from './log.js';
  ```

---

## Phase 1 — `shared/` utilities

### Task 1.1: `shared/paths.ts`

Resolves all paths Mirador uses, with a single override env var for tests.

- [ ] **Step 1:** Create `v1/src/shared/paths.ts`:

```ts
import { homedir } from 'node:os';
import { join } from 'node:path';

const MIRADOR_HOME = process.env.MIRADOR_HOME_OVERRIDE ?? join(homedir(), '.mirador');

export const paths = {
  miradorHome: () => MIRADOR_HOME,
  workspaceClone: () => join(MIRADOR_HOME, 'workspace'),
  sharedClonesRoot: () => join(MIRADOR_HOME, 'shared'),
  sessionSkillsRoot: () => join(MIRADOR_HOME, 'session-skills'),
  configFile: () => join(MIRADOR_HOME, 'config.json'),
  lastSeenFile: () => join(MIRADOR_HOME, 'last-seen.json'),
  claudeSkill: () => join(homedir(), '.claude', 'skills', 'mirador'),
  claudeCommand: () => join(homedir(), '.claude', 'commands', 'mirador.md'),
  codexSkill: () => join(homedir(), '.codex', 'skills', 'mirador'),
};
```

- [ ] **Step 2:** Create `v1/src/shared/paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { paths } from './paths.js';

describe('paths', () => {
  it('roots under MIRADOR_HOME_OVERRIDE when set', () => {
    process.env.MIRADOR_HOME_OVERRIDE = '/tmp/mirador-test';
    // Reimport not feasible; verify by reading current
    expect(paths.workspaceClone().startsWith('/tmp/mirador-test')).toBe(true);
  });
});
```

### Task 1.2: `shared/config.ts`

Typed config + read/write to `~/.mirador/config.json`.

- [ ] **Step 1:** Create `v1/src/shared/config.ts`:

```ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { paths } from './paths.js';

export interface MiradorConfig {
  version: 1;
  github: {
    handle: string;
    workspaceRepo: string;        // e.g. "danielmedinac22/danielm-mirador"
    sharedReposNamespace: string; // "personal" | "<org-name>"
  };
  vercel: {
    project: string;
    domain: string;               // e.g. "mirador-danielm.vercel.app"
  };
  brain: {
    location: 'workspace' | 'separate-repo';
    repo?: string;                // only if separate-repo
  };
  defaults: {
    theme: string;
    passwordPolicy: 'never' | 'always-ask' | 'always-on';
    visibility: 'unlisted' | 'public';
  };
  docs: never[];                  // legacy alpha field; kept for migration
}

export async function readConfig(): Promise<MiradorConfig | null> {
  try {
    const raw = await readFile(paths.configFile(), 'utf8');
    return JSON.parse(raw) as MiradorConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeConfig(cfg: MiradorConfig): Promise<void> {
  await mkdir(dirname(paths.configFile()), { recursive: true });
  await writeFile(paths.configFile(), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}
```

- [ ] **Step 2:** Test in `v1/src/shared/config.test.ts` (round-trip).

### Task 1.3: `shared/errors.ts`

Typed CLI errors with exit codes.

- [ ] **Step 1:** Create `v1/src/shared/errors.ts`:

```ts
export class MiradorError extends Error {
  constructor(public code: string, message: string, public hint?: string) {
    super(message);
    this.name = 'MiradorError';
  }
}

export const ERRORS = {
  PREFLIGHT_GH_AUTH: 'PREFLIGHT_GH_AUTH',
  PREFLIGHT_VERCEL_AUTH: 'PREFLIGHT_VERCEL_AUTH',
  PREFLIGHT_GIT: 'PREFLIGHT_GIT',
  PREFLIGHT_NODE_VERSION: 'PREFLIGHT_NODE_VERSION',
  WORKSPACE_EXISTS: 'WORKSPACE_EXISTS',
  GITHUB_API: 'GITHUB_API',
  VERCEL_DEPLOY: 'VERCEL_DEPLOY',
} as const;
```

### Task 1.4: `shared/log.ts`

Append-only activity log + console formatting.

- [ ] **Step 1:** Create `v1/src/shared/log.ts`:

```ts
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { paths } from './paths.js';

export async function logActivity(line: string): Promise<void> {
  const logFile = join(paths.workspaceClone(), 'logs', 'activity.log');
  try {
    await mkdir(dirname(logFile), { recursive: true });
    await appendFile(logFile, `${new Date().toISOString()}\t${line}\n`, 'utf8');
  } catch {
    // Logging never blocks. Swallow errors.
  }
}
```

---

## Phase 2 — `adapters/`

Each adapter wraps one external concern. No business logic.

### Task 2.1: `adapters/fs.ts` — filesystem helpers

- [ ] **Step 1:** Create `v1/src/adapters/fs.ts`:

```ts
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeFileAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}
```

### Task 2.2: `adapters/gh-cli.ts` — `gh` CLI wrapper

- [ ] **Step 1:** Create `v1/src/adapters/gh-cli.ts`:

```ts
import { execa } from 'execa';
import { MiradorError, ERRORS } from '../shared/errors.js';

export async function ghAuthStatus(): Promise<{ user: string }> {
  try {
    const { stdout } = await execa('gh', ['api', 'user', '-q', '.login']);
    return { user: stdout.trim() };
  } catch {
    throw new MiradorError(
      ERRORS.PREFLIGHT_GH_AUTH,
      'GitHub CLI not authenticated.',
      'Run `gh auth login` and retry.'
    );
  }
}

export async function ghToken(): Promise<string> {
  const { stdout } = await execa('gh', ['auth', 'token']);
  return stdout.trim();
}
```

**Note:** add `execa` to dependencies: `npm i execa` in `v1/`.

### Task 2.3: `adapters/github.ts` — GitHub REST API via gh

- [ ] **Step 1:** Create `v1/src/adapters/github.ts`:

```ts
import { execa } from 'execa';
import { MiradorError, ERRORS } from '../shared/errors.js';

export interface CreateRepoOptions {
  name: string;
  owner?: string;           // org or user; defaults to authenticated user
  private: boolean;
  description?: string;
}

export async function createRepo(opts: CreateRepoOptions): Promise<{ fullName: string; cloneUrl: string }> {
  const args = ['repo', 'create', opts.owner ? `${opts.owner}/${opts.name}` : opts.name];
  if (opts.private) args.push('--private');
  else args.push('--public');
  if (opts.description) args.push('--description', opts.description);
  args.push('--confirm');

  try {
    const { stdout } = await execa('gh', args);
    // `gh repo create` prints the new repo URL on success
    const url = stdout.trim().split(/\s+/).pop() ?? '';
    const fullName = url.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
    return { fullName, cloneUrl: `https://github.com/${fullName}.git` };
  } catch (err) {
    throw new MiradorError(ERRORS.GITHUB_API, `Failed to create repo: ${(err as Error).message}`);
  }
}

export async function repoExists(fullName: string): Promise<boolean> {
  try {
    await execa('gh', ['repo', 'view', fullName, '--json', 'name']);
    return true;
  } catch {
    return false;
  }
}
```

### Task 2.4: `adapters/git.ts` — local git operations

- [ ] **Step 1:** Create `v1/src/adapters/git.ts`:

```ts
import { execa } from 'execa';

export async function clone(repoUrl: string, dest: string): Promise<void> {
  await execa('git', ['clone', repoUrl, dest]);
}

export async function init(dir: string): Promise<void> {
  await execa('git', ['init'], { cwd: dir });
}

export async function add(dir: string, paths: string[]): Promise<void> {
  await execa('git', ['add', ...paths], { cwd: dir });
}

export async function commit(dir: string, message: string): Promise<void> {
  await execa('git', ['commit', '-m', message], { cwd: dir });
}

export async function setRemote(dir: string, name: string, url: string): Promise<void> {
  await execa('git', ['remote', 'add', name, url], { cwd: dir });
}

export async function push(dir: string, branch = 'main', upstream = true): Promise<void> {
  const args = ['push'];
  if (upstream) args.push('-u', 'origin', branch);
  await execa('git', args, { cwd: dir });
}

export async function setMainBranch(dir: string): Promise<void> {
  await execa('git', ['branch', '-M', 'main'], { cwd: dir });
}
```

### Task 2.5: `adapters/vercel.ts` — Vercel CLI wrapper

- [ ] **Step 1:** Create `v1/src/adapters/vercel.ts`:

```ts
import { execa } from 'execa';
import { MiradorError, ERRORS } from '../shared/errors.js';

export async function vercelWhoami(): Promise<{ user: string }> {
  try {
    const { stdout } = await execa('vercel', ['whoami']);
    return { user: stdout.trim() };
  } catch {
    throw new MiradorError(
      ERRORS.PREFLIGHT_VERCEL_AUTH,
      'Vercel CLI not authenticated.',
      'Run `vercel login` and retry.'
    );
  }
}

export async function ensureProject(name: string): Promise<{ projectName: string }> {
  // For init: we just confirm the user can create or already has a project.
  // Actual deploy logic lives in VS-04.
  return { projectName: name };
}
```

---

## Phase 3 — `services/`

Domain logic. Pure-ish — input/output, no console I/O. The wizard is the only orchestrator that prints.

### Task 3.1: `services/workspace.ts`

- [ ] **Step 1:** Create `v1/src/services/workspace.ts`:

```ts
import { join } from 'node:path';
import { ensureDir, writeFileAtomic, pathExists } from '../adapters/fs.js';
import * as github from '../adapters/github.js';
import * as git from '../adapters/git.js';
import { paths } from '../shared/paths.js';

export interface CreateWorkspaceInput {
  ghUser: string;
  repoName: string;        // e.g. "danielm-mirador"
  owner: string;           // org or user
}

export async function createWorkspaceRepo(input: CreateWorkspaceInput): Promise<{ fullName: string }> {
  const existing = await github.repoExists(`${input.owner}/${input.repoName}`);
  if (existing) {
    // Idempotent: just clone if not already present locally
    if (!(await pathExists(paths.workspaceClone()))) {
      await git.clone(`https://github.com/${input.owner}/${input.repoName}.git`, paths.workspaceClone());
    }
    return { fullName: `${input.owner}/${input.repoName}` };
  }
  const repo = await github.createRepo({
    name: input.repoName,
    owner: input.owner === input.ghUser ? undefined : input.owner,
    private: true,
    description: 'My personal Mirador workspace.',
  });
  await git.clone(repo.cloneUrl, paths.workspaceClone());
  return { fullName: repo.fullName };
}

export async function scaffoldWorkspace(): Promise<void> {
  const root = paths.workspaceClone();
  await ensureDir(join(root, 'brain'));
  await ensureDir(join(root, 'artifacts'));
  await ensureDir(join(root, 'incoming-requests'));
  await ensureDir(join(root, 'outgoing-requests'));
  await ensureDir(join(root, 'logs'));
  await writeFileAtomic(join(root, 'README.md'), defaultWorkspaceReadme);
  await writeFileAtomic(join(root, '.gitignore'), 'logs/\nnode_modules/\n');
}

const defaultWorkspaceReadme = `# My Mirador workspace

This is my private Mirador workspace. Drafts, brain, and request stubs live here.
Shared artifacts get promoted to standalone repos when I run \`mirador share\`.

Source of truth for the design: https://github.com/danielmedinac22/mirador
`;
```

### Task 3.2: `services/brain.ts` — initial brain scaffolding

- [ ] **Step 1:** Create `v1/src/services/brain.ts`:

```ts
import { join } from 'node:path';
import { writeFileAtomic } from '../adapters/fs.js';
import { paths } from '../shared/paths.js';

export interface BrainSeedAnswers {
  role: string;
  reviewFocus: string;
  authorAudience: string;
  domain: string;
  preferences: string;
}

export async function scaffoldBrain(answers: BrainSeedAnswers): Promise<void> {
  const root = join(paths.workspaceClone(), 'brain');
  await writeFileAtomic(join(root, 'MEMORY.md'), brainIndex);
  await writeFileAtomic(join(root, 'preferences.md'), brainPrefs(answers));
  await writeFileAtomic(join(root, 'role-author.md'), brainAuthor(answers));
  await writeFileAtomic(join(root, 'role-reviewer.md'), brainReviewer(answers));
}

const brainIndex = `- [preferences](preferences.md) — Cross-role defaults
- [role-author](role-author.md) — How I approach authoring
- [role-reviewer](role-reviewer.md) — How I approach reviewing
`;

const brainPrefs = (a: BrainSeedAnswers) => `---
name: preferences
description: My cross-role defaults
metadata:
  type: brain
---

I work in ${a.domain || 'general knowledge work'}.

${a.preferences || 'Prefer tables over prose. Avoid jargon.'}
`;

const brainAuthor = (a: BrainSeedAnswers) => `---
name: role-author
description: How I approach authoring
metadata:
  type: brain
  applies_to_role: author
---

When I author, my default audience is ${a.authorAudience || 'a small team'}.
My role is ${a.role || 'PM/Engineer'} — I default to scoping clearly and stating assumptions.
`;

const brainReviewer = (a: BrainSeedAnswers) => `---
name: role-reviewer
description: How I approach reviewing
metadata:
  type: brain
  applies_to_role: reviewer
---

When I review, I check ${a.reviewFocus || 'scope, timelines, and failure modes'} first.
`;
```

### Task 3.3: `services/skill.ts` — write Mirador skill files

- [ ] **Step 1:** Create `v1/src/services/skill.ts`:

```ts
import { join } from 'node:path';
import { ensureDir, writeFileAtomic } from '../adapters/fs.js';
import { paths } from '../shared/paths.js';

const SKILL_PLACEHOLDER = `---
name: mirador
description: |
  Mirador v1 placeholder skill. Full behavior is wired in VS-05.
---

# Mirador (placeholder)

The full skill body is defined when VS-05 (prompt-seed protocol) lands.
For now, this skill is a no-op declaration that lets \`mirador upgrade\`
find Mirador's skill location.
`;

const SLASH_COMMAND = `# /mirador

Use this to invoke the Mirador skill explicitly. The skill auto-activates
on prompt-seeds and inside Mirador artifact folders, but this command
forces an explicit invocation.
`;

export async function installClaudeSkill(): Promise<void> {
  await ensureDir(paths.claudeSkill());
  await writeFileAtomic(join(paths.claudeSkill(), 'SKILL.md'), SKILL_PLACEHOLDER);
}

export async function installSlashCommand(): Promise<void> {
  await writeFileAtomic(paths.claudeCommand(), SLASH_COMMAND);
}

export async function installCodexSkill(): Promise<void> {
  await ensureDir(paths.codexSkill());
  await writeFileAtomic(join(paths.codexSkill(), 'SKILL.md'), SKILL_PLACEHOLDER);
}
```

### Task 3.4: `services/vercel-project.ts`

- [ ] **Step 1:** Create `v1/src/services/vercel-project.ts`:

```ts
import * as vercel from '../adapters/vercel.js';

export async function ensureUserProject(handle: string): Promise<{ projectName: string; domain: string }> {
  const name = `mirador-${handle}`;
  const project = await vercel.ensureProject(name);
  return {
    projectName: project.projectName,
    domain: `${project.projectName}.vercel.app`,
  };
}
```

---

## Phase 4 — Wizard + command wiring

### Task 4.1: `wizard/run.ts` — interactive flow

- [ ] **Step 1:** Create `v1/src/wizard/run.ts`:

```ts
import * as p from '@clack/prompts';
import { ghAuthStatus } from '../adapters/gh-cli.js';
import { vercelWhoami } from '../adapters/vercel.js';
import { createWorkspaceRepo, scaffoldWorkspace } from '../services/workspace.js';
import { scaffoldBrain, type BrainSeedAnswers } from '../services/brain.js';
import { installClaudeSkill, installSlashCommand, installCodexSkill } from '../services/skill.js';
import { ensureUserProject } from '../services/vercel-project.js';
import { readConfig, writeConfig } from '../shared/config.js';
import { logActivity } from '../shared/log.js';
import { pathExists } from '../adapters/fs.js';
import { paths } from '../shared/paths.js';

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
      message: 'Mirador is already initialized. Re-run wizard with current values as defaults?',
      initialValue: true,
    });
    if (p.isCancel(proceed) || !proceed) {
      p.cancel('Aborted.');
      return;
    }
  }

  // Workspace location
  const useOrg = opts.org ?? (await p.text({
    message: 'GitHub namespace for your workspace repo (leave blank for personal):',
    placeholder: '',
    defaultValue: '',
  }));
  if (p.isCancel(useOrg)) {
    p.cancel('Aborted.');
    return;
  }
  const owner = useOrg || ghUser;
  const repoName = `${ghUser}-mirador`;

  // Brain seed Qs
  p.log.step('Quick brain bootstrap (5 questions — skippable)');
  const role = await p.text({ message: 'Your primary role at work?', placeholder: 'PM / Engineer / ...', defaultValue: '' });
  if (p.isCancel(role)) return;
  const reviewFocus = await p.text({ message: 'When reviewing, what do you check first?', defaultValue: '' });
  if (p.isCancel(reviewFocus)) return;
  const authorAudience = await p.text({ message: 'When authoring, your default audience size?', defaultValue: '' });
  if (p.isCancel(authorAudience)) return;
  const domain = await p.text({ message: 'Domain language you work in?', placeholder: 'e.g. fintech, LatAm, B2B', defaultValue: '' });
  if (p.isCancel(domain)) return;
  const preferences = await p.text({ message: 'Anything else? (free text)', defaultValue: '' });
  if (p.isCancel(preferences)) return;

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
  const installCodex = await p.confirm({ message: 'Also install for Codex?', initialValue: false });
  if (!p.isCancel(installCodex) && installCodex) await installCodexSkill();
  spin.stop('Skills installed.');

  // Persist config
  await writeConfig({
    version: 1,
    github: { handle: ghUser, workspaceRepo: fullName, sharedReposNamespace: owner === ghUser ? 'personal' : owner },
    vercel: { project: projectName, domain: vercelDomain },
    brain: { location: 'workspace' },
    defaults: { theme: 'default', passwordPolicy: 'always-ask', visibility: 'unlisted' },
    docs: [],
  });
  await logActivity(`init ok user=${ghUser} repo=${fullName}`);
  p.outro('Mirador ready. Try `mirador-v1 new <slug>`.');
}
```

### Task 4.2: Wire the `init` command

- [ ] **Step 1:** Create `v1/src/commands/init.ts`:

```ts
import type { Command } from 'commander';

export function registerInit(program: Command) {
  program
    .command('init')
    .description('First-run setup — workspace repo, brain, skill, Vercel.')
    .option('--reset', 'Re-create workspace from scratch (destructive).')
    .option('--org <name>', 'Use a specific GitHub org as the workspace namespace.')
    .action(async (opts) => {
      const { runInit } = await import('../wizard/run.js');
      await runInit({ reset: opts.reset, org: opts.org });
    });
}
```

- [ ] **Step 2:** Update `v1/src/index.ts`:

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { registerInit } from './commands/init.js';
import { VERSION } from './version.js';

const program = new Command();
program.name('mirador-v1').description('Mirador v1 CLI.').version(VERSION);
registerInit(program);

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

---

## Phase 5 — Tests

### Task 5.1: Unit tests for services

- [ ] **Step 1:** `v1/src/services/workspace.test.ts` — mocks `github` and `git` adapters; asserts idempotency, scaffolding paths.
- [ ] **Step 2:** `v1/src/services/brain.test.ts` — verifies frontmatter + index generation against answers.
- [ ] **Step 3:** `v1/src/services/skill.test.ts` — verifies files are written to correct paths under a `MIRADOR_HOME_OVERRIDE`-set temp dir.

### Task 5.2: Integration smoke test

- [ ] **Step 1:** `v1/tests/init.integration.test.ts` runs the wizard under a temp `MIRADOR_HOME` + mocked execa for `gh`, `vercel`, `git`. Asserts: config file written, brain files exist, skill installed.

---

## Phase 6 — Build + smoke

- [ ] **Step 1:** `cd v1 && npm run build` — expect a `dist/index.js`.
- [ ] **Step 2:** `node v1/dist/index.js --version` — prints `1.0.0-dev.0`.
- [ ] **Step 3:** Inside a temp dir with `MIRADOR_HOME_OVERRIDE=/tmp/mtest`, run `node v1/dist/index.js init` and step through it. Verify `/tmp/mtest/workspace/brain/*` exist; verify config file; verify skill installed to a temp `HOME` if you scope that too.
- [ ] **Step 4:** PR: branch from `feat/v2-design-and-v1-scaffold`, target `main` (or rebase onto whichever is the integration branch).

---

## Dependencies added in this slice

```json
{
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "commander": "^12.0.0",
    "execa": "^9.0.0"
  }
}
```

`execa` is added in Task 2.2.

---

## Definition of done

All boxes ticked above. PR linked to issue #4, with:
- Green CI (lint + test + build).
- A manual run-through in a temp dir documented in the PR description.
- The implementer notes any deviation from this plan in the PR body.

— end of VS-01 plan —
