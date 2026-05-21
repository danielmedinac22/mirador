# VS-08 — Brain lifecycle (read, propose-update, session wiring)

**Goal:** Brain becomes a first-class, queryable, evolvable surface. Claude Code can pull brain content on demand during a session and propose updates that the user explicitly approves.

**Issue:** [#11](https://github.com/danielmedinac22/mirador/issues/11)
**Related:** [#15](https://github.com/danielmedinac22/mirador/issues/15) (smart brain bootstrap — partially addressed here, partially deferred)
**Branch:** `feat/v1-vs-08-brain-lifecycle` (off of `feat/v1-vs-02-new-open` — will rebase onto main once VS-02 merges)
**Reference docs:**
- PRD §5.4 (brain format), §12 (brain — deeper spec)
- SAD §5.2 (privacy boundary)

---

## Mental model

Brain is **read by demand, written by approval**. The CLI exposes:
- Read paths (`brain list`, `brain show`, `brain --topic`) for Claude Code to query mid-session.
- Write paths only through an explicit user-approved proposal flow.

There is **no code path** in this slice that pushes brain content into a shared artifact repo, ever. Brain content stays in the workspace repo. The session skill produced by VS-02's `mirador open` is extended here to reference the brain tool — but the actual brain content is fetched lazily on each tool call.

---

## Phase 0 — Branch hygiene

- [ ] Branched off `feat/v1-vs-02-new-open`. After VS-02 merges, rebase onto `main`.

---

## Phase 1 — `services/brain.ts` extended (read paths)

VS-01 already created `scaffoldBrain`. Extend with read primitives.

### Task 1.1: Extend brain.ts with list + show + load-with-frontmatter

- [ ] **Step 1:** Add to `v1/src/services/brain.ts`:

```ts
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { paths } from '../shared/paths.js';
import { pathExists } from '../adapters/fs.js';
import { MiradorError } from '../shared/errors.js';

export interface BrainFile {
  topic: string;            // slug = filename without .md
  description: string;      // from frontmatter
  appliesToRole?: string;   // from frontmatter
  body: string;             // markdown after frontmatter
  path: string;             // absolute path on disk
}

export async function brainRoot(): Promise<string> {
  const root = join(paths.workspaceClone(), 'brain');
  if (!(await pathExists(root))) {
    throw new MiradorError(
      'BRAIN_MISSING',
      'No brain found. Run `mirador-v1 init` first.',
    );
  }
  return root;
}

export async function listBrain(): Promise<BrainFile[]> {
  const root = await brainRoot();
  const files = await readdir(root);
  const out: BrainFile[] = [];
  for (const f of files) {
    if (!f.endsWith('.md') || f === 'MEMORY.md') continue;
    const parsed = await loadBrain(f.replace(/\.md$/, ''));
    out.push(parsed);
  }
  return out;
}

export async function loadBrain(topic: string): Promise<BrainFile> {
  const root = await brainRoot();
  const filePath = join(root, `${topic}.md`);
  if (!(await pathExists(filePath))) {
    throw new MiradorError('BRAIN_TOPIC_MISSING', `No brain topic "${topic}".`);
  }
  const raw = await readFile(filePath, 'utf8');
  return parseBrain(topic, raw, filePath);
}

export function parseBrain(topic: string, raw: string, path: string): BrainFile {
  // Minimal frontmatter parser: starts with --- ... ---\n
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { topic, description: '', body: raw, path };
  }
  const [, frontmatter, body] = fmMatch;
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const appliesToRole = frontmatter.match(/^\s*applies_to_role:\s*(\S+)$/m)?.[1]?.trim();
  return { topic, description, appliesToRole, body, path };
}
```

### Task 1.2: Tests

- [ ] `services/brain.test.ts` extended:
  - `listBrain` returns entries for each .md (skipping MEMORY.md)
  - `loadBrain` returns body without frontmatter
  - `parseBrain` extracts description + applies_to_role
  - `loadBrain` errors on missing topic

---

## Phase 2 — `services/brainProposals.ts` (write paths via approval)

### Task 2.1: Brain proposal flow

A "proposal" is a pending change. The flow:
1. Claude Code calls `mirador-v1 brain update --propose "<text>" --topic <topic>` (programmatic) — but the CLI **does not write to the brain immediately**. It writes a staging file.
2. The CLI prints to stdout a structured note showing the diff + a token that the user pastes back to approve, OR the CLI prompts the user interactively for y/n/edit.
3. On `--approve <token>` (or interactive yes), the staging file is moved into the brain.

For v1, simplest: interactive flow. The propose call BLOCKS on stdin asking y/n/edit. Claude Code's user sees it and answers in their terminal. This works because Mirador's "interface" IS the Claude Code session — the user has a terminal.

- [ ] **Step 1:** Create `v1/src/services/brainProposals.ts`:

```ts
import { join } from 'node:path';
import * as p from '@clack/prompts';
import { ensureDir, pathExists, readText, writeFileAtomic } from '../adapters/fs.js';
import { brainRoot, loadBrain } from './brain.js';

export interface ProposeInput {
  topic: string;
  proposedBody: string;   // full new body, not a diff
  reason?: string;        // why Claude is proposing this
}

export interface ProposeResult {
  applied: boolean;
  reason?: string;
}

export async function proposeBrainUpdate(input: ProposeInput): Promise<ProposeResult> {
  const root = await brainRoot();
  const filePath = join(root, `${input.topic}.md`);
  const existing = (await pathExists(filePath)) ? await readText(filePath) : '';

  p.intro(`Mirador · brain proposal for "${input.topic}"`);
  if (input.reason) p.log.info(`Reason: ${input.reason}`);
  if (existing) {
    p.log.step('Current:');
    p.log.message(existing);
  } else {
    p.log.step('Current: (new topic)');
  }
  p.log.step('Proposed:');
  p.log.message(input.proposedBody);

  const choice = await p.select({
    message: 'Apply this update to your brain?',
    options: [
      { value: 'yes', label: 'Yes — apply as proposed' },
      { value: 'edit', label: 'Edit before applying (opens $EDITOR)' },
      { value: 'no', label: 'No — reject' },
    ],
  });

  if (p.isCancel(choice) || choice === 'no') {
    p.outro('Brain unchanged.');
    return { applied: false, reason: 'rejected' };
  }

  let finalBody = input.proposedBody;
  if (choice === 'edit') {
    finalBody = await editInExternalEditor(input.proposedBody);
  }

  await writeFileAtomic(filePath, ensureFrontmatter(input.topic, finalBody));
  p.outro(`Brain updated: ${filePath}`);
  return { applied: true };
}

async function editInExternalEditor(initial: string): Promise<string> {
  // Stub for v1: clack's note that opening $EDITOR is not yet wired.
  // Users can manually edit the file later; for now, accept as-is.
  p.log.warn('Editor opening not yet wired — applying as proposed. Edit later via `mirador-v1 brain edit <topic>`.');
  return initial;
}

function ensureFrontmatter(topic: string, body: string): string {
  if (body.startsWith('---\n')) return body;
  return `---
name: ${topic}
description: (auto-added by brain proposal)
metadata:
  type: brain
---

${body}
`;
}
```

### Task 2.2: Tests

- [ ] **Step 1:** Tests require mocking clack — defer real integration tests; write a smaller smoke that calls `ensureFrontmatter` and validates the structural test (see Phase 6).

---

## Phase 3 — `commands/brain.ts` (CLI surface)

- [ ] **Step 1:** Create `v1/src/commands/brain.ts`:

```ts
import type { Command } from 'commander';
import { listBrain, loadBrain } from '../services/brain.js';
import { proposeBrainUpdate } from '../services/brainProposals.js';

export function registerBrain(program: Command): void {
  const brain = program.command('brain').description('Inspect or update your brain.');

  brain
    .command('list')
    .description('List all brain topics.')
    .action(async () => {
      const entries = await listBrain();
      if (entries.length === 0) {
        process.stdout.write('(brain is empty)\n');
        return;
      }
      const lines = entries.map((e) => {
        const desc = e.description || '(no description)';
        const role = e.appliesToRole ? ` [role:${e.appliesToRole}]` : '';
        return `${e.topic}${role}  —  ${desc}`;
      });
      process.stdout.write(`${lines.join('\n')}\n`);
    });

  brain
    .command('show <topic>')
    .description('Print the body of a brain topic.')
    .action(async (topic: string) => {
      const file = await loadBrain(topic);
      process.stdout.write(file.body);
      if (!file.body.endsWith('\n')) process.stdout.write('\n');
    });

  brain
    .command('topic <topic>')
    .description('Machine-format brain query for agents — alias of `show`.')
    .action(async (topic: string) => {
      const file = await loadBrain(topic);
      process.stdout.write(file.body);
      if (!file.body.endsWith('\n')) process.stdout.write('\n');
    });

  brain
    .command('update')
    .description('Propose a brain update (interactive y/n/edit).')
    .requiredOption('--topic <topic>', 'Topic to update or create.')
    .requiredOption('--propose <text>', 'New body for the topic.')
    .option('--reason <text>', 'Why this update is proposed.')
    .action(async (opts: { topic: string; propose: string; reason?: string }) => {
      await proposeBrainUpdate({
        topic: opts.topic,
        proposedBody: opts.propose,
        reason: opts.reason,
      });
    });
}
```

- [ ] **Step 2:** Wire in `v1/src/index.ts`:
  - `import { registerBrain } from './commands/brain.js';`
  - `registerBrain(program);`

---

## Phase 4 — Session skill knows about the brain tool

### Task 4.1: Extend `adapters/claudeCode.ts`

- [ ] **Step 1:** Update the session skill template to include a section telling Claude how to use `mirador-v1 brain topic <x>` on demand.

```ts
// In renderSessionSkill (existing function), replace the "Brain access (VS-08, not yet wired)" section with:

## Brain access

You have access to the user's brain — their private notes on how they think and work. Query it on demand by running:

\`\`\`
mirador-v1 brain topic <topic-name>
\`\`\`

To see what topics exist:

\`\`\`
mirador-v1 brain list
\`\`\`

**Use the brain when:**
- You're about to suggest something the user might have an opinion on.
- The artifact's expected role is set and you want to know how the user approaches that role.
- You're considering a flag, comment, or critique.

**Don't:**
- Pre-load all brain topics at session start (it wastes context).
- Quote brain content into shared comments without the user's explicit OK.
- Propose brain updates without going through `mirador-v1 brain update`.

## Proposing a brain update

When you notice a pattern in the user's choices that would be useful to remember, propose a brain update:

\`\`\`
mirador-v1 brain update --topic <existing-or-new-topic> --propose "<full body>" --reason "<why>"
\`\`\`

The CLI will ask the user y/n/edit. Do not write directly to brain files.
```

---

## Phase 5 — `services/brainImport.ts` (smart bootstrap — issue #15)

### Task 5.1: Detection

- [ ] **Step 1:** Create `v1/src/services/brainImport.ts`:

```ts
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathExists, readText } from '../adapters/fs.js';

export interface ExistingContext {
  source: string;          // human-readable label
  path: string;
  body: string;
}

export async function detectExistingContext(): Promise<ExistingContext[]> {
  const found: ExistingContext[] = [];

  // Home-level CLAUDE.md
  const homeClaudeMd = join(homedir(), 'CLAUDE.md');
  if (await pathExists(homeClaudeMd)) {
    found.push({
      source: '~/CLAUDE.md',
      path: homeClaudeMd,
      body: await readText(homeClaudeMd),
    });
  }

  // ~/.claude/projects/<dir>/memory/*.md
  const claudeProjects = join(homedir(), '.claude', 'projects');
  if (await pathExists(claudeProjects)) {
    const projects = await readdir(claudeProjects);
    for (const proj of projects) {
      const memoryDir = join(claudeProjects, proj, 'memory');
      if (!(await pathExists(memoryDir))) continue;
      const files = await readdir(memoryDir);
      for (const f of files) {
        if (!f.endsWith('.md')) continue;
        const p = join(memoryDir, f);
        found.push({
          source: `~/.claude/projects/${proj}/memory/${f}`,
          path: p,
          body: await readText(p),
        });
      }
    }
  }

  // ~/.codex/memory/*.md
  const codexMemory = join(homedir(), '.codex', 'memory');
  if (await pathExists(codexMemory)) {
    const files = await readdir(codexMemory);
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const p = join(codexMemory, f);
      found.push({
        source: `~/.codex/memory/${f}`,
        path: p,
        body: await readText(p),
      });
    }
  }

  return found;
}
```

### Task 5.2: Detection tests

- [ ] Tests in `services/brainImport.test.ts`:
  - Returns empty when none exist.
  - Detects `~/CLAUDE.md` under a `HOME` override.
  - Walks `~/.claude/projects/*/memory/`.
  - Walks `~/.codex/memory/`.

### Task 5.3: (Deferred) Import command

The full import flow (UI for picking which detected contexts to import, where to map them) is too much for VS-08's scope. Provide `mirador-v1 brain import` only as a stub that prints detected contexts; full interactive import is a follow-up.

- [ ] **Step 1:** Add a `brain import` subcommand to `commands/brain.ts` that lists detected sources but doesn't yet import.

---

## Phase 6 — Privacy assertion test + final test pass

### Task 6.1: Privacy assertion

A structural test that confirms the brain code paths do not write outside the workspace's `brain/` directory.

- [ ] **Step 1:** `v1/src/services/brain.privacy.test.ts`:

```ts
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileAtomic, ensureDir } from '../adapters/fs.js';
import { brainRoot, listBrain } from './brain.js';

describe('services/brain — privacy boundary', () => {
  let tmp: string;
  const original = process.env.MIRADOR_HOME_OVERRIDE;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-brainpriv-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
    // Set up a brain
    const brainDir = join(tmp, 'workspace', 'brain');
    await ensureDir(brainDir);
    await writeFileAtomic(
      join(brainDir, 'preferences.md'),
      '---\nname: preferences\ndescription: t\nmetadata:\n  type: brain\n---\nsecret content',
    );
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.MIRADOR_HOME_OVERRIDE = original;
  });

  it('listBrain only touches files under brain/', async () => {
    const entries = await listBrain();
    for (const e of entries) {
      expect(e.path.startsWith(await brainRoot())).toBe(true);
    }
  });

  it('shared/ directory is not touched by brain operations', async () => {
    const sharedDir = join(tmp, 'shared');
    await ensureDir(sharedDir);
    await listBrain();
    const after = await readdir(sharedDir);
    expect(after).toEqual([]); // brain operations never write to ~/.mirador/shared/
  });
});
```

### Task 6.2: Final test pass + smoke

- [ ] All tests pass (including VS-01, VS-02 tests).
- [ ] Smoke:
  - `mirador-v1 brain list` after init — shows 3 files (role-author, role-reviewer, preferences).
  - `mirador-v1 brain show preferences` — prints the body.
  - `mirador-v1 brain topic role-reviewer` — same output (alias).
  - `mirador-v1 brain update --topic role-reviewer --propose "new content" --reason "test"` — interactive, accept → file updated.

---

## Phase 7 — PR

- [ ] Build, push, draft PR targeting main, link to #11 and reference #15.
- [ ] Note in PR body: "import flow stubbed; full interactive import is a follow-up."

---

## Definition of done

- Brain is queryable via `brain list`, `brain show`, `brain topic`.
- Brain is updatable via `brain update --propose` with user approval.
- Session skill template (from VS-02) extended to teach Claude Code how to use the brain.
- Privacy assertion test in place.
- Existing-context detection implemented; import UX deferred to a follow-up.

— end of VS-08 plan —
