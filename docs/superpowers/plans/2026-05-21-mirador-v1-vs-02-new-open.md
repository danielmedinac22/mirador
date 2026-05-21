# VS-02 — `mirador new` + `mirador open` detailed plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship `mirador-v1 new` and `mirador-v1 open` end-to-end. After this slice, a user can create a workspace artifact and re-open it later seeing a tabular session brief — the first taste of the brain × artifact experience (brain integration arrives in VS-08).

**Issue:** [#5](https://github.com/danielmedinac22/mirador/issues/5)
**Branch:** `feat/v1-vs-02-new-open` (off of `main`)
**Reference docs:**
- PRD §7.2, §7.4, §11.1
- SAD §2.2 — skill is separate concern
- Overview: [`2026-05-21-mirador-v1-overview.md`](2026-05-21-mirador-v1-overview.md#vs-02)

---

## Mental model

`mirador-v1 open <slug>` does NOT launch Claude Code. It **prints a session brief to stdout in the exact PRD §11.1 format**, and the Mirador skill (when triggered inside Claude Code) renders that stdout verbatim as the first turn. This is the cleanest decoupling: the CLI owns the brief; the skill owns the trigger; Claude Code is the UI.

For VS-02 (workspace-only, no collaborators, no brain integration yet), the brief degrades gracefully:

```
q2-draft  ·  workspace  ·  newly created

(no changes — fresh artifact)

Next: open <path>/CONTEXT.md  |  mirador-v1 share q2-draft --with <email>
```

After some editing:

```
q2-draft  ·  workspace  ·  last opened by you 2h ago

CHANGES SINCE YOU                     WHEN
─────────────────────────────────────────────
Modified: index.html                  1h ago
Added: notes.md                       30m ago

Next: open <path>  |  mirador-v1 share q2-draft --with <email>
```

Brain-flag line is **omitted in VS-02** (no brain integration). VS-08 wires it in.

---

## Phase 0 — Branch hygiene + dep check

- [ ] **Step 1:** Confirm branched off `main` after VS-01 merge: `git log --oneline -3` shows the VS-01 merge commit.
- [ ] **Step 2:** `cd v1 && npm install` — no changes expected, sanity only.

---

## Phase 1 — `shared/lastSeen.ts` + helper extensions

### Task 1.1: `shared/lastSeen.ts`

Per-artifact `last_open_at` + optional `last_open_commit`.

- [ ] **Step 1:** Create `v1/src/shared/lastSeen.ts`:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { paths } from './paths.js';

export interface LastSeenEntry {
  last_open_at: string;          // ISO timestamp
  last_open_commit?: string;     // git SHA at last open (for shared repos; optional in v1)
}

export type LastSeenStore = Record<string, LastSeenEntry>;

export async function readLastSeen(): Promise<LastSeenStore> {
  try {
    const raw = await readFile(paths.lastSeenFile(), 'utf8');
    return JSON.parse(raw) as LastSeenStore;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

export async function writeLastSeen(store: LastSeenStore): Promise<void> {
  await mkdir(dirname(paths.lastSeenFile()), { recursive: true });
  await writeFile(paths.lastSeenFile(), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export async function updateLastSeen(slug: string, entry: LastSeenEntry): Promise<void> {
  const store = await readLastSeen();
  store[slug] = entry;
  await writeLastSeen(store);
}
```

- [ ] **Step 2:** Tests in `v1/src/shared/lastSeen.test.ts`:
  - read returns `{}` when file missing
  - round-trip a store
  - `updateLastSeen` adds without clobbering other slugs

### Task 1.2: Extend `shared/index.ts` barrel

- [ ] Add `export * from './lastSeen.js';`

---

## Phase 2 — `adapters/`

### Task 2.1: `adapters/claudeCode.ts` — session skill writer

The session skill is a tiny ephemeral SKILL.md that tells Claude Code how to interpret the artifact in this session.

- [ ] **Step 1:** Create `v1/src/adapters/claudeCode.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ensureDir, writeFileAtomic } from './fs.js';
import { paths } from '../shared/paths.js';

export interface SessionSkillInput {
  slug: string;
  artifactPath: string;
  expectedRole?: string;
  brainPath?: string;     // wired in VS-08; ignored in VS-02
}

export async function writeSessionSkill(input: SessionSkillInput): Promise<string> {
  const id = randomUUID();
  const dir = join(paths.sessionSkillsRoot(), id);
  await ensureDir(dir);
  await writeFileAtomic(join(dir, 'SKILL.md'), renderSessionSkill(input));
  return dir;
}

function renderSessionSkill(input: SessionSkillInput): string {
  return `---
name: mirador-session-${input.slug}
description: |
  Mirador session skill for the artifact "${input.slug}". Renders the session
  brief produced by \`mirador-v1 open\` and guides the conversation around the
  artifact files at ${input.artifactPath}.
---

# Mirador session — ${input.slug}

Artifact path: ${input.artifactPath}
${input.expectedRole ? `Expected role: ${input.expectedRole}\n` : ''}
## How to respond

The user invoked \`mirador-v1 open ${input.slug}\`. The CLI has printed a
session brief. **Your first turn must render that brief verbatim** (table
format from PRD §11.1) — do not paraphrase, do not add narrative summary,
do not add bullets. After the brief, wait for the user's next message.

## Brain access (VS-08, not yet wired)

When VS-08 lands, you will have a \`mirador brain --topic <x>\` tool. For
now, brain-flag lines are omitted from the brief.

## Don't

- Don't auto-edit any file. Suggest, the user confirms.
- Don't push to git. Commits are explicit, via the user's choice.
`;
}
```

### Task 2.2: `adapters/editor.ts` — open file in user's editor

For "next: open X" affordances. Optional in VS-02 — the CLI just prints the path; users open it themselves.

- [ ] **Step 1:** Create `v1/src/adapters/editor.ts` (minimal):

```ts
// Placeholder: in VS-02 we only print paths. A future iteration may shell out
// to $EDITOR or VS Code via `code <path>`.
export function suggestEditorOpen(path: string): string {
  return `open ${path}`;
}
```

---

## Phase 3 — `services/`

### Task 3.1: `services/artifact.ts` — slug resolution + creation

- [ ] **Step 1:** Create `v1/src/services/artifact.ts`:

```ts
import { join } from 'node:path';
import { ensureDir, pathExists, writeFileAtomic } from '../adapters/fs.js';
import { paths } from '../shared/paths.js';
import { MiradorError } from '../shared/errors.js';

export interface NewArtifactInput {
  slug: string;
  purpose?: string;
  audience?: string;
}

export async function createArtifact(input: NewArtifactInput): Promise<{ path: string }> {
  validateSlug(input.slug);
  const dir = join(paths.workspaceClone(), 'artifacts', input.slug);
  if (await pathExists(dir)) {
    throw new MiradorError('ARTIFACT_EXISTS', `Artifact "${input.slug}" already exists.`);
  }
  await ensureDir(dir);
  await writeFileAtomic(join(dir, 'CONTEXT.md'), renderContext(input));
  return { path: dir };
}

export async function resolveArtifactPath(slug: string): Promise<string> {
  validateSlug(slug);
  const dir = join(paths.workspaceClone(), 'artifacts', slug);
  if (!(await pathExists(dir))) {
    throw new MiradorError(
      'ARTIFACT_NOT_FOUND',
      `Artifact "${slug}" not found in workspace.`,
      'Run `mirador-v1 list` to see your artifacts.',
    );
  }
  return dir;
}

function validateSlug(slug: string): void {
  if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(slug)) {
    throw new MiradorError(
      'INVALID_SLUG',
      `Slug "${slug}" is invalid.`,
      'Use lowercase letters, digits, and dashes. 2–64 chars, no leading/trailing dash.',
    );
  }
}

function renderContext(input: NewArtifactInput): string {
  return `# ${input.slug}

## Purpose
${input.purpose || '(not specified yet — edit me)'}

## Audience
${input.audience || '(not specified yet — edit me)'}

## Notes
Add your working notes here as you build out the artifact.
`;
}
```

- [ ] **Step 2:** Tests in `v1/src/services/artifact.test.ts`:
  - createArtifact creates folder + CONTEXT.md
  - createArtifact errors when artifact already exists
  - invalid slugs rejected ("BadName", "no_underscore", "-leading", "trailing-")
  - resolveArtifactPath returns folder for existing artifact, errors for missing

### Task 3.2: `services/changeLog.ts` — what changed since last open

- [ ] **Step 1:** Create `v1/src/services/changeLog.ts`:

```ts
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface FileChange {
  path: string;          // relative to artifact root
  kind: 'added' | 'modified';
  mtime: Date;
}

export async function changesSince(
  artifactPath: string,
  sinceIso: string | null,
): Promise<FileChange[]> {
  const since = sinceIso ? new Date(sinceIso).getTime() : 0;
  const changes: FileChange[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      const st = await stat(full);
      if (st.mtimeMs > since) {
        changes.push({
          path: relative(artifactPath, full),
          kind: since === 0 || st.birthtimeMs > since ? 'added' : 'modified',
          mtime: st.mtime,
        });
      }
    }
  }

  await walk(artifactPath);
  changes.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return changes;
}
```

- [ ] **Step 2:** Tests in `v1/src/services/changeLog.test.ts`:
  - empty folder → empty changes
  - sinceIso=null → all files marked as added
  - modify a file after sinceIso → returns it as modified
  - dotfiles ignored

### Task 3.3: `services/session.ts` — orchestrate `open`

- [ ] **Step 1:** Create `v1/src/services/session.ts`:

```ts
import { writeSessionSkill } from '../adapters/claudeCode.js';
import { resolveArtifactPath } from './artifact.js';
import { changesSince, type FileChange } from './changeLog.js';
import { readLastSeen, updateLastSeen } from '../shared/lastSeen.js';

export interface SessionResult {
  brief: string;           // the human-readable brief to print to stdout
  sessionSkillPath: string;
}

export async function openSession(slug: string): Promise<SessionResult> {
  const artifactPath = await resolveArtifactPath(slug);
  const lastSeen = await readLastSeen();
  const entry = lastSeen[slug];

  const changes = await changesSince(artifactPath, entry?.last_open_at ?? null);
  const brief = renderBrief(slug, artifactPath, entry?.last_open_at ?? null, changes);

  const sessionSkillPath = await writeSessionSkill({
    slug,
    artifactPath,
    // expectedRole + brain wired in later slices
  });

  await updateLastSeen(slug, { last_open_at: new Date().toISOString() });

  return { brief, sessionSkillPath };
}

function renderBrief(
  slug: string,
  artifactPath: string,
  lastSeenIso: string | null,
  changes: FileChange[],
): string {
  const header = lastSeenIso
    ? `${slug}  ·  workspace  ·  last opened by you ${humanizeAgo(lastSeenIso)}`
    : `${slug}  ·  workspace  ·  newly created`;

  if (changes.length === 0 && !lastSeenIso) {
    return [
      header,
      '',
      '(fresh artifact — no files yet beyond CONTEXT.md)',
      '',
      `Next: open ${artifactPath}/CONTEXT.md  |  mirador-v1 share ${slug} --with <email>`,
      '',
    ].join('\n');
  }
  if (changes.length === 0) {
    return [
      header,
      '',
      '(no changes since you last opened)',
      '',
      `Next: open ${artifactPath}  |  mirador-v1 share ${slug} --with <email>`,
      '',
    ].join('\n');
  }

  const tableLines = renderChangeTable(changes.slice(0, 8));
  const overflow = changes.length > 8 ? `\n+ ${changes.length - 8} more — \`mirador-v1 diff ${slug}\`` : '';

  return [
    header,
    '',
    tableLines,
    overflow,
    '',
    `Next: open ${artifactPath}  |  mirador-v1 share ${slug} --with <email>`,
    '',
  ]
    .filter((s) => s !== '')
    .join('\n') + '\n';
}

function renderChangeTable(changes: FileChange[]): string {
  const header = 'CHANGES SINCE YOU'.padEnd(40) + 'WHEN';
  const sep = '─'.repeat(60);
  const rows = changes.map((c) => {
    const label = `${c.kind === 'added' ? 'Added' : 'Modified'}: ${c.path}`;
    return label.padEnd(40) + humanizeAgo(c.mtime.toISOString());
  });
  return [header, sep, ...rows].join('\n');
}

function humanizeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
```

- [ ] **Step 2:** Tests in `v1/src/services/session.test.ts`:
  - fresh artifact → brief contains "newly created"
  - no changes since last → brief says "(no changes since you last opened)"
  - with changes → table is present with rows sorted recent-first
  - >8 changes → overflow line appears
  - session skill is written to disk; path returned

---

## Phase 4 — Commands + wiring

### Task 4.1: `commands/new.ts`

- [ ] **Step 1:** Create `v1/src/commands/new.ts`:

```ts
import * as p from '@clack/prompts';
import type { Command } from 'commander';
import { createArtifact } from '../services/artifact.js';
import { logActivity } from '../shared/log.js';

export function registerNew(program: Command): void {
  program
    .command('new <slug>')
    .description('Create a new workspace artifact.')
    .option('--purpose <text>', 'Purpose of the artifact.')
    .option('--audience <text>', 'Intended audience.')
    .option('--no-prompts', 'Skip the 2-question wizard (use --purpose / --audience flags).')
    .action(async (slug: string, opts: { purpose?: string; audience?: string; prompts: boolean }) => {
      p.intro(`Mirador · new ${slug}`);
      let purpose = opts.purpose;
      let audience = opts.audience;
      if (opts.prompts !== false && !purpose && !audience) {
        const pp = await p.text({
          message: 'Purpose of this artifact?',
          placeholder: 'e.g. Q3 forecast for the board',
          defaultValue: '',
        });
        if (p.isCancel(pp)) {
          p.cancel('Aborted.');
          return;
        }
        const aa = await p.text({
          message: 'Audience?',
          placeholder: 'e.g. board; engineering leads; CFO',
          defaultValue: '',
        });
        if (p.isCancel(aa)) {
          p.cancel('Aborted.');
          return;
        }
        purpose = String(pp) || undefined;
        audience = String(aa) || undefined;
      }
      const { path } = await createArtifact({ slug, purpose, audience });
      await logActivity(`new slug=${slug}`);
      p.outro(`Created at ${path}.  Open with \`mirador-v1 open ${slug}\`.`);
    });
}
```

### Task 4.2: `commands/open.ts`

- [ ] **Step 1:** Create `v1/src/commands/open.ts`:

```ts
import type { Command } from 'commander';
import { openSession } from '../services/session.js';
import { logActivity } from '../shared/log.js';

export function registerOpen(program: Command): void {
  program
    .command('open <slug>')
    .description('Open an artifact and print its session brief.')
    .action(async (slug: string) => {
      const { brief } = await openSession(slug);
      process.stdout.write(brief);
      await logActivity(`open slug=${slug}`);
    });
}
```

### Task 4.3: Wire commands in `src/index.ts`

- [ ] Add:
  - `import { registerNew } from './commands/new.js';`
  - `import { registerOpen } from './commands/open.js';`
  - `registerNew(program);`
  - `registerOpen(program);`

---

## Phase 5 — Tests + verification

### Task 5.1: Run full suite

- [ ] `npx vitest run` — expect ≥19 + new tests passing.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npx biome check .` — clean (run `biome format --write .` first if needed).

### Task 5.2: Manual smoke

- [ ] In a temp shell with `MIRADOR_HOME_OVERRIDE=/tmp/vs02-test`:
  1. `mkdir -p /tmp/vs02-test/workspace/artifacts`
  2. `node v1/dist/index.js new q-test`  (or skip the wizard with `--no-prompts`)
  3. `ls /tmp/vs02-test/workspace/artifacts/q-test/` → `CONTEXT.md` present.
  4. `node v1/dist/index.js open q-test` → prints session brief: header + "(fresh artifact ...)".
  5. `echo "hi" > /tmp/vs02-test/workspace/artifacts/q-test/notes.md`
  6. `node v1/dist/index.js open q-test` → brief now shows "Added: notes.md" in table.
  7. `cat /tmp/vs02-test/last-seen.json` → has entry for `q-test`.
  8. `ls /tmp/vs02-test/session-skills/` → at least one UUID folder with `SKILL.md` inside.

---

## Phase 6 — PR

- [ ] Force a build: `npm run build`.
- [ ] Commit by phase. Push.
- [ ] Open PR targeting `main`, linked to issue #5.
- [ ] Update PR body with status checklist + brief examples (paste the smoke transcript).

---

## Definition of done

All boxes ticked above. PR reviewed and either:
- Approved and merged → VS-03 unblocked, VS-08 (separately) free to start independently.
- Feedback addressed → loop.

— end of VS-02 plan —
