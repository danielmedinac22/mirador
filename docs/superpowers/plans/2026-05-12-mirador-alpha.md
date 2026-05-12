# Mirador Alpha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Mirador alpha — a Claude Code (+ Codex best-effort) skill + slash command that lets an agent publish HTML to the user's own Vercel project. The `mirador` binary is a **one-time setup wizard**; every share is driven by the agent.

**Architecture:** TypeScript Node CLI in `alpha/`, two commands only (`init`, `config`). The CLI sets up `~/.mirador/`, links a Vercel project, picks defaults, and installs the skill + `/mirador` command into the agents the user selects. After that, the agent does all the share work via shell commands and a small `encrypt.mjs` helper for the password gate.

**Tech Stack:**
- Node 20+, TypeScript (strict), `tsup` for bundling, `commander`, `@clack/prompts`
- `vitest` for tests, `biome` for lint+format
- `vercel` CLI shelled out via `child_process`
- Browser + Node crypto via `crypto.subtle` (native, no JS crypto libs)
- No Anthropic SDK in the binary (theme generation happens in the user's agent)

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-12-mirador-alpha-design.md`
- V1 spec (context only): `docs/superpowers/specs/2026-05-12-mirador-design.md`

---

## Phase 0: Package scaffold

The alpha lives entirely under `alpha/` in the same repo as the future V1 work. `alpha/` is a self-contained npm package.

### Task 0.1: Initialize `alpha/` as an npm package

**Files:**
- Create: `alpha/package.json`
- Create: `alpha/tsconfig.json`
- Create: `alpha/.gitignore`
- Create: `alpha/biome.json`
- Create: `alpha/README.md` (placeholder; final version lands in Phase 9)

- [ ] **Step 1: Create `alpha/package.json`**

```json
{
  "name": "@mirador/cli",
  "version": "0.1.0-alpha.0",
  "description": "Mirador alpha — setup wizard for the agent-driven HTML publishing skill.",
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": { "mirador": "./dist/index.js" },
  "files": ["dist", "themes", "templates", "scripts", "skill", "command"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --target node20 --shims --no-splitting --clean",
    "dev": "tsup src/index.ts --format esm --target node20 --shims --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `alpha/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "lib": ["ES2022"],
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create `alpha/.gitignore`**

```
node_modules
dist
.DS_Store
```

- [ ] **Step 4: Create `alpha/biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "files": { "ignore": ["dist", "node_modules"] },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "always" } },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "noNonNullAssertion": "off" }
    }
  }
}
```

- [ ] **Step 5: Placeholder README**

`alpha/README.md`:
```markdown
# Mirador Alpha

A Claude Code (+ Codex best-effort) skill that publishes AI-generated HTML to your own Vercel.

Install + quickstart land in Phase 9.
```

- [ ] **Step 6: Install deps**

Run: `cd alpha && npm install`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add alpha/package.json alpha/tsconfig.json alpha/.gitignore alpha/biome.json alpha/README.md alpha/package-lock.json
git commit -m "chore(alpha): scaffold @mirador/cli package"
```

---

## Phase 1: CLI entrypoint — init and config

The binary's entire user surface: two commands.

### Task 1.1: Entrypoint with `commander`

**Files:**
- Create: `alpha/src/index.ts`
- Create: `alpha/src/version.ts`
- Create: `alpha/src/commands/init.ts`
- Create: `alpha/src/commands/config.ts`

- [ ] **Step 1: Version**

`alpha/src/version.ts`:
```ts
export const VERSION = '0.1.0-alpha.0';
```

- [ ] **Step 2: Command stubs**

`alpha/src/commands/init.ts`:
```ts
import type { Command } from 'commander';

export function registerInit(program: Command) {
  program
    .command('init')
    .description('First-run setup. Configures Vercel, defaults, and installs the skill.')
    .action(async () => {
      const { runInit } = await import('../wizard/run.js');
      await runInit({ mode: 'init' });
    });
}
```

`alpha/src/commands/config.ts`:
```ts
import type { Command } from 'commander';

export function registerConfig(program: Command) {
  program
    .command('config')
    .description('Re-run the setup wizard with current values as defaults.')
    .action(async () => {
      const { runInit } = await import('../wizard/run.js');
      await runInit({ mode: 'config' });
    });
}
```

- [ ] **Step 3: Stub `wizard/run.ts`**

`alpha/src/wizard/run.ts`:
```ts
export interface RunOptions { mode: 'init' | 'config'; }
export async function runInit(_opts: RunOptions): Promise<void> {
  throw new Error('wizard not implemented yet');
}
```

- [ ] **Step 4: Entrypoint**

`alpha/src/index.ts`:
```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { registerConfig } from './commands/config.js';
import { registerInit } from './commands/init.js';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('mirador')
  .description('Setup wizard for the Mirador HTML-publishing skill.')
  .version(VERSION);

registerInit(program);
registerConfig(program);

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 5: Build + verify**

Run: `cd alpha && npm run build && node dist/index.js --help`
Expected: prints usage with `init` and `config` only.

- [ ] **Step 6: Commit**

```bash
git add alpha/src
git commit -m "feat(alpha): CLI entrypoint with init and config commands"
```

---

## Phase 2: Paths + config IO + home pointer

### Task 2.1: Storage path resolution

**Files:**
- Create: `alpha/src/paths.ts`
- Create: `alpha/src/paths.test.ts`

`paths.ts` resolves the storage root in this order:
1. `MIRADOR_HOME` env var (for tests).
2. Contents of `~/.mirador-home` if the file exists.
3. Default: `~/.mirador/`.

- [ ] **Step 1: Failing test**

`alpha/src/paths.test.ts`:
```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('paths', () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'mirador-paths-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); delete process.env.MIRADOR_HOME; });

  it('returns env var when set', async () => {
    process.env.MIRADOR_HOME = tmp;
    const { resolveRoot } = await import(`./paths.js?${Math.random()}`);
    expect(resolveRoot()).toBe(tmp);
  });

  it('falls back to ~/.mirador when no pointer', async () => {
    const { resolveRoot } = await import(`./paths.js?${Math.random()}`);
    // can't easily test default without filesystem manipulation; assert it doesn't throw.
    expect(typeof resolveRoot()).toBe('string');
  });

  it('reads the pointer file', async () => {
    process.env.MIRADOR_POINTER = join(tmp, 'pointer');
    writeFileSync(join(tmp, 'pointer'), join(tmp, 'real-home'));
    const { resolveRoot } = await import(`./paths.js?${Math.random()}`);
    expect(resolveRoot()).toBe(join(tmp, 'real-home'));
    delete process.env.MIRADOR_POINTER;
  });
});
```

(Note: the cache-busting `?random` is so `vi`'s module cache doesn't reuse a previous evaluation. Alternative: use `vi.resetModules()`.)

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `paths.ts`**

```ts
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_POINTER = join(homedir(), '.mirador-home');

export function pointerPath(): string {
  return process.env.MIRADOR_POINTER ?? DEFAULT_POINTER;
}

export function resolveRoot(): string {
  if (process.env.MIRADOR_HOME) return process.env.MIRADOR_HOME;
  const p = pointerPath();
  if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  return join(homedir(), '.mirador');
}

export function paths() {
  const root = resolveRoot();
  return {
    root,
    config: join(root, 'config.json'),
    site: join(root, 'site'),
    themes: join(root, 'themes'),
    templates: join(root, 'templates'),
    scripts: join(root, 'scripts'),
    logs: join(root, 'logs'),
  } as const;
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add alpha/src/paths.ts alpha/src/paths.test.ts
git commit -m "feat(alpha): storage path resolver with pointer file"
```

### Task 2.2: Config IO

**Files:**
- Create: `alpha/src/config.ts`
- Create: `alpha/src/config.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('config', () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'mirador-cfg-')); process.env.MIRADOR_HOME = tmp; });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); delete process.env.MIRADOR_HOME; });

  it('returns null when missing', async () => {
    const { readConfig } = await import('./config.js');
    expect(await readConfig()).toBeNull();
  });

  it('round-trips a full config', async () => {
    const { readConfig, writeConfig } = await import('./config.js');
    const c = {
      version: 1 as const,
      storage_path: tmp,
      vercel: { projectId: 'p', projectName: 'n', domain: 'n.vercel.app', orgId: 'o' },
      agents: ['claude-code'] as Array<'claude-code' | 'codex' | 'other'>,
      defaults: { theme: 'memo', password_policy: 'always-ask' as const, visibility: 'unlisted' as const },
      docs: [],
    };
    await writeConfig(c);
    expect((await readConfig())?.defaults.theme).toBe('memo');
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement**

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { paths } from './paths.js';

export type AgentKey = 'claude-code' | 'codex' | 'other';
export type PasswordPolicy = 'always-ask' | 'never' | 'always-on';
export type Visibility = 'unlisted' | 'public';

export interface VercelInfo {
  projectId: string; projectName: string; domain: string; orgId: string;
}

export interface DocRecord {
  slug: string; title: string; theme: string;
  passwordProtected: boolean; visibility: Visibility;
  url: string; createdAt: string;
}

export interface Config {
  version: 1;
  storage_path: string;
  vercel: VercelInfo;
  agents: AgentKey[];
  defaults: { theme: string; password_policy: PasswordPolicy; visibility: Visibility };
  docs: DocRecord[];
}

export async function readConfig(): Promise<Config | null> {
  try {
    return JSON.parse(await readFile(paths().config, 'utf8')) as Config;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function writeConfig(c: Config): Promise<void> {
  await mkdir(dirname(paths().config), { recursive: true });
  await writeFile(paths().config, JSON.stringify(c, null, 2), 'utf8');
}
```

- [ ] **Step 4: Verify pass, commit**

```bash
git add alpha/src/config.ts alpha/src/config.test.ts
git commit -m "feat(alpha): config IO with typed schema"
```

---

## Phase 3: Shipped static assets — themes, templates, encrypt script

These are static files that ship in the npm package and are copied into `<storage-path>/` during `mirador init`. They don't need tests as files — they're tested as part of integration later (e.g., the gate template is tested via `encrypt.mjs` tests).

### Task 3.1: Shipped themes

**Files:**
- Create: `alpha/themes/default/{meta.json, theme.css, head.html}`
- Create: `alpha/themes/deck/{meta.json, theme.css, head.html}`
- Create: `alpha/themes/memo/{meta.json, theme.css, head.html}`

- [ ] **Step 1: Create the `default` theme**

`alpha/themes/default/meta.json`:
```json
{ "name": "default", "description": "Clean, neutral, generous whitespace. Works for any document.", "tags": ["clean", "neutral"] }
```

`alpha/themes/default/theme.css`:
```css
.mirador-content { max-width: 720px; margin: 4rem auto; padding: 0 1.5rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 16px; line-height: 1.7; color: #1a1a1a; }
.mirador-content h1, .mirador-content h2, .mirador-content h3 { font-weight: 600; letter-spacing: -0.01em; line-height: 1.25; }
.mirador-content h1 { font-size: 2rem; margin-top: 0; }
.mirador-content h2 { font-size: 1.5rem; margin-top: 2.5rem; }
.mirador-content h3 { font-size: 1.2rem; margin-top: 2rem; }
.mirador-content p, .mirador-content li { color: #333; }
.mirador-content code { background: #f3f3f3; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; font-family: 'SF Mono', ui-monospace, monospace; }
.mirador-content pre { background: #1a1a1a; color: #eee; padding: 1rem; border-radius: 6px; overflow-x: auto; }
.mirador-content a { color: #2451b7; text-decoration: underline; }
.mirador-content table { border-collapse: collapse; width: 100%; }
.mirador-content th, .mirador-content td { border-bottom: 1px solid #e5e5e5; padding: 0.5rem 0.75rem; text-align: left; }
```

`alpha/themes/default/head.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

- [ ] **Step 2: Create the `deck` theme**

`alpha/themes/deck/meta.json`:
```json
{ "name": "deck", "description": "Presentation-style: large type, vertical slide rhythm, dark background.", "tags": ["presentation", "slides"] }
```

`alpha/themes/deck/theme.css`:
```css
.mirador-content { font-family: 'Inter', -apple-system, system-ui, sans-serif; background: #0e0f11; color: #f5f5f7; min-height: 100vh; padding: 4rem 2rem; font-size: 20px; line-height: 1.5; }
.mirador-content > * { max-width: 960px; margin-inline: auto; }
.mirador-content h1 { font-size: 3.5rem; font-weight: 700; letter-spacing: -0.02em; }
.mirador-content h2 { font-size: 2.5rem; font-weight: 600; }
.mirador-content h3 { font-size: 1.8rem; }
.mirador-content section, .mirador-content .slide { min-height: 90vh; display: flex; flex-direction: column; justify-content: center; padding: 4rem 0; border-top: 1px solid #2a2b2e; }
.mirador-content code { background: #1f2024; color: #c5e3ff; padding: 0.1em 0.4em; border-radius: 4px; }
```

`alpha/themes/deck/head.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 3: Create the `memo` theme**

`alpha/themes/memo/meta.json`:
```json
{ "name": "memo", "description": "Document/report style: serif body, restrained palette, optimized for reading.", "tags": ["document", "memo", "report"] }
```

`alpha/themes/memo/theme.css`:
```css
.mirador-content { max-width: 680px; margin: 5rem auto; padding: 0 1.5rem; font-family: 'Source Serif Pro', Georgia, 'Times New Roman', serif; font-size: 17px; line-height: 1.75; color: #2a2a2a; }
.mirador-content h1, .mirador-content h2, .mirador-content h3 { font-family: 'Inter', -apple-system, system-ui, sans-serif; font-weight: 600; letter-spacing: -0.01em; color: #1a1a1a; }
.mirador-content h1 { font-size: 1.75rem; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; }
.mirador-content blockquote { border-left: 3px solid #888; padding-left: 1rem; margin-left: 0; color: #555; font-style: italic; }
.mirador-content code { font-family: 'SF Mono', ui-monospace, monospace; font-size: 0.92em; }
```

`alpha/themes/memo/head.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@600&family=Source+Serif+Pro:wght@400;600&display=swap" rel="stylesheet">
```

- [ ] **Step 4: Commit**

```bash
git add alpha/themes
git commit -m "feat(alpha): ship default, deck, memo themes"
```

### Task 3.2: Shipped templates

**Files:**
- Create: `alpha/templates/site-index.html`
- Create: `alpha/templates/password-gate.html`

- [ ] **Step 1: site-index template**

`alpha/templates/site-index.html`:
```html
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mirador</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:0 1.5rem;color:#1a1a1a}h1{font-weight:600;letter-spacing:-0.01em}ul{list-style:none;padding:0}li{padding:0.75rem 0;border-bottom:1px solid #eee}a{color:#2451b7;text-decoration:none}a:hover{text-decoration:underline}.empty{color:#888}</style>
</head><body><h1>Mirador</h1><p class="empty">{{empty_or_list}}</p>{{list_html}}<footer style="margin-top:4rem;color:#888;font-size:0.85em;">Powered by <a href="https://github.com/mirador">Mirador</a>.</footer></body></html>
```

- [ ] **Step 2: password-gate template**

`alpha/templates/password-gate.html`:
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Password required</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, system-ui, sans-serif; min-height: 100vh; margin:0; display:flex; align-items:center; justify-content:center; background:#fafafa; color:#111; }
  @media (prefers-color-scheme: dark) { body { background:#0e0f11; color:#eee; } .card { background:#16181c; border-color:#2a2b2e; } input { background:#1f2024; color:#eee; border-color:#2a2b2e; } }
  .card { background:#fff; border:1px solid #e5e5e5; padding:2rem; border-radius:10px; max-width:360px; width:100%; }
  h1 { margin:0 0 1rem; font-size:1.1rem; font-weight:600; }
  input { width:100%; padding:0.6rem 0.8rem; border:1px solid #ccc; border-radius:6px; box-sizing:border-box; font-size:1rem; }
  button { margin-top:0.8rem; width:100%; padding:0.6rem; border:none; background:#2451b7; color:white; border-radius:6px; cursor:pointer; font-size:1rem; }
  .err { color:#c0392b; font-size:0.85em; margin-top:0.6rem; min-height:1em; }
  footer { color:#888; font-size:0.75em; margin-top:1.5rem; }
</style>
</head>
<body>
<form class="card" id="f" autocomplete="off">
  <h1>Password required</h1>
  <input id="p" type="password" placeholder="Password" autofocus required>
  <button type="submit">Unlock</button>
  <div class="err" id="e"></div>
  <footer>Client-side gate — deters casual viewing; not authentication.</footer>
</form>
<script>
const SALT_B64 = "__SALT__";
const IV_B64 = "__IV__";
const CT_B64 = "__CT__";
const ITER = __ITER__;

const b64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function deriveKey(pw) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64(SALT_B64), iterations: ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

document.getElementById('f').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const pw = document.getElementById('p').value;
  const err = document.getElementById('e');
  err.textContent = '';
  try {
    const key = await deriveKey(pw);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64(IV_B64) },
      key,
      b64(CT_B64),
    );
    const html = new TextDecoder().decode(plain);
    document.open(); document.write(html); document.close();
  } catch {
    err.textContent = 'Incorrect password.';
  }
});
</script>
</body>
</html>
```

The four placeholders (`__SALT__`, `__IV__`, `__CT__`, `__ITER__`) are exactly what `encrypt.mjs` substitutes via `String.prototype.replace` — keep them spelled this way.

- [ ] **Step 3: Commit**

```bash
git add alpha/templates
git commit -m "feat(alpha): ship site-index and password-gate templates"
```

### Task 3.3: Standalone `encrypt.mjs`

**Files:**
- Create: `alpha/scripts/encrypt.mjs`
- Create: `alpha/scripts/encrypt.test.mjs`

This is a single-file Node script with **zero dependencies** that the agent invokes via shell. It must run with just `node encrypt.mjs --in ... --out ... --password ...`.

- [ ] **Step 1: Write the failing test**

`alpha/scripts/encrypt.test.mjs`:
```js
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = resolve(__dirname, 'encrypt.mjs');
// encrypt.mjs needs the gate template; for tests, point at the shipped one.
const template = resolve(__dirname, '..', 'templates', 'password-gate.html');

describe('encrypt.mjs', () => {
  let tmp;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'mirador-enc-')); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('produces an HTML file with the gate UI and no plaintext', () => {
    const input = join(tmp, 'in.html'); const output = join(tmp, 'out.html');
    writeFileSync(input, '<html><body><h1>top secret</h1></body></html>');
    const r = spawnSync('node', [script, '--in', input, '--out', output, '--password', 'pw', '--template', template], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    const out = readFileSync(output, 'utf8');
    expect(out).toContain('Password required');
    expect(out).not.toContain('top secret');
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `encrypt.mjs`**

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    in: { type: 'string' },
    out: { type: 'string' },
    password: { type: 'string' },
    template: { type: 'string' }, // path to password-gate.html
  },
});

if (!values.in || !values.out || !values.password || !values.template) {
  console.error('usage: encrypt.mjs --in <file> --out <file> --password <pw> --template <gate.html>');
  process.exit(2);
}

const ITER = 200_000;

const html = readFileSync(values.in);
const template = readFileSync(values.template, 'utf8');

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(values.password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, html));

const b64 = (u) => Buffer.from(u).toString('base64');
const out = template
  .replace('__SALT__', b64(salt))
  .replace('__IV__', b64(iv))
  .replace('__CT__', b64(ct))
  .replace('__ITER__', String(ITER));

writeFileSync(values.out, out);
```

- [ ] **Step 4: Verify test passes**

Run: `cd alpha && npm test -- encrypt`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add alpha/scripts
git commit -m "feat(alpha): standalone encrypt.mjs for the password gate"
```

---

## Phase 4: Vercel wrapper

The wizard needs to verify `vercel`, run login, and link a project. These are init-only — the share flow runs `vercel deploy` directly from the agent.

### Task 4.1: Vercel verification + link helpers

**Files:**
- Create: `alpha/src/vercel.ts`
- Create: `alpha/src/vercel.test.ts`

- [ ] **Step 1: Implement**

```ts
import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function checkInstalled(): Promise<{ ok: true; version: string } | { ok: false }> {
  try {
    const { stdout } = await run('vercel', ['--version']);
    return { ok: true, version: stdout.trim() };
  } catch { return { ok: false }; }
}

export async function checkAuth(): Promise<{ ok: true; user: string } | { ok: false }> {
  try {
    const { stdout } = await run('vercel', ['whoami']);
    return { ok: true, user: stdout.trim() };
  } catch { return { ok: false }; }
}

export function loginInteractive(): number {
  const r = spawnSync('vercel', ['login'], { stdio: 'inherit' });
  return r.status ?? 1;
}

export interface LinkResult { projectId: string; orgId: string; }
export async function linkProject(projectName: string): Promise<LinkResult> {
  const stage = mkdtempSync(join(tmpdir(), 'mirador-link-'));
  const r = spawnSync('vercel', ['link', '--yes', '--name', projectName], { cwd: stage, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`vercel link failed (status ${r.status})`);
  const raw = await readFile(join(stage, '.vercel', 'project.json'), 'utf8');
  const parsed = JSON.parse(raw) as { projectId: string; orgId: string };
  return parsed;
}

interface RunResult { stdout: string; stderr: string; }
function run(cmd: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (b) => { stdout += b.toString(); });
    proc.stderr.on('data', (b) => { stderr += b.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.trim()}`));
    });
  });
}
```

- [ ] **Step 2: Test with a mock binary**

`alpha/src/vercel.test.ts`:
```ts
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('vercel', () => {
  let mockDir: string; let prevPath: string | undefined;
  function mockVercel(out: string, exit = 0): void {
    const path = join(mockDir, 'vercel');
    writeFileSync(path, `#!/usr/bin/env bash\ncat <<'OUT'\n${out}\nOUT\nexit ${exit}\n`);
    chmodSync(path, 0o755);
  }
  beforeEach(() => { mockDir = mkdtempSync(join(tmpdir(), 'mirador-vercel-')); prevPath = process.env.PATH; process.env.PATH = `${mockDir}:${process.env.PATH}`; });
  afterEach(() => { rmSync(mockDir, { recursive: true, force: true }); if (prevPath !== undefined) process.env.PATH = prevPath; });

  it('checkInstalled returns version when present', async () => {
    mockVercel('Vercel CLI 33.0.0');
    const { checkInstalled } = await import('./vercel.js');
    const r = await checkInstalled();
    expect(r.ok).toBe(true);
  });

  it('checkAuth returns user', async () => {
    mockVercel('danielm');
    const { checkAuth } = await import('./vercel.js');
    expect((await checkAuth())).toEqual({ ok: true, user: 'danielm' });
  });

  it('checkAuth fails when whoami exits non-zero', async () => {
    mockVercel('not logged in', 1);
    const { checkAuth } = await import('./vercel.js');
    expect(await checkAuth()).toEqual({ ok: false });
  });
});
```

- [ ] **Step 3: Verify pass, commit**

```bash
git add alpha/src/vercel.ts alpha/src/vercel.test.ts
git commit -m "feat(alpha): vercel CLI wrapper for setup wizard"
```

---

## Phase 5: The init wizard

This is the user-facing flow. Use `@clack/prompts` for nice TTY UI. Each step prompts; on cancel, exit gracefully.

### Task 5.1: Wizard runner

**Files:**
- Create: `alpha/src/wizard/run.ts` (replaces the stub)
- Create: `alpha/src/wizard/install-agents.ts`

- [ ] **Step 1: Implement `wizard/run.ts`**

```ts
import * as p from '@clack/prompts';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { readConfig, writeConfig } from '../config.js';
import { paths, pointerPath } from '../paths.js';
import * as vercel from '../vercel.js';
import { installAgents } from './install-agents.js';
import { fileURLToPath } from 'node:url';
import { cp } from 'node:fs/promises';

export interface RunOptions { mode: 'init' | 'config'; }

// dist/index.js → package root is two segments up (../..).
const PKG_DIR = resolve(fileURLToPath(import.meta.url), '../..');

export async function runInit(opts: RunOptions): Promise<void> {
  p.intro(opts.mode === 'init' ? 'mirador init' : 'mirador config');

  const existing = await readConfig();
  const cur = existing ?? null;

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
  const agents = agentChoice as Array<'claude-code' | 'codex' | 'other'>;

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
    if (p.isCancel(goLogin) || !goLogin) { p.outro('Run `vercel login` and re-run `mirador init`.'); process.exit(1); }
    if (vercel.loginInteractive() !== 0) { p.outro('vercel login failed.'); process.exit(1); }
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
  if (!vercelInfo || vercelInfo.projectName !== projectName) {
    const linked = await vercel.linkProject(projectName);
    vercelInfo = { projectId: linked.projectId, orgId: linked.orgId, projectName, domain: `${projectName}.vercel.app` };
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
  // a) Write the pointer file if storage path is non-default.
  const defaultHome = join(homedir(), '.mirador');
  if (storagePath !== defaultHome) {
    await mkdir(dirname(pointerPath()), { recursive: true });
    await writeFile(pointerPath(), storagePath, 'utf8');
  }
  process.env.MIRADOR_HOME = storagePath;

  // b) Create dirs
  await mkdir(storagePath, { recursive: true });
  for (const d of ['themes', 'site', 'templates', 'scripts', 'logs', 'site/.vercel']) {
    await mkdir(join(storagePath, d), { recursive: true });
  }

  // c) Copy shipped assets into the storage path
  await cp(join(PKG_DIR, 'themes'), join(storagePath, 'themes'), { recursive: true, force: false, errorOnExist: false });
  await cp(join(PKG_DIR, 'templates'), join(storagePath, 'templates'), { recursive: true, force: true });
  await cp(join(PKG_DIR, 'scripts'), join(storagePath, 'scripts'), { recursive: true, force: true });

  // d) Save config
  await writeConfig({
    version: 1,
    storage_path: storagePath,
    vercel: vercelInfo!,
    agents,
    defaults: {
      theme: themeAnswer as string,
      password_policy: pwPolicy as 'always-ask' | 'never' | 'always-on',
      visibility: visibility as 'unlisted' | 'public',
    },
    docs: cur?.docs ?? [],
  });

  // e) Copy .vercel/project.json into the site dir so future `vercel deploy` is linked.
  await writeFile(
    join(storagePath, 'site', '.vercel', 'project.json'),
    JSON.stringify({ projectId: vercelInfo!.projectId, orgId: vercelInfo!.orgId }, null, 2),
    'utf8',
  );

  // f) Install skill + slash command into the chosen agents
  await installAgents(agents, PKG_DIR);

  p.outro(`Done. Open Claude Code and type /mirador to publish your first HTML.`);
}
```

- [ ] **Step 2: Implement `wizard/install-agents.ts`**

```ts
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export async function installAgents(
  agents: Array<'claude-code' | 'codex' | 'other'>,
  pkgDir: string,
): Promise<void> {
  for (const a of agents) {
    if (a === 'claude-code') await installClaudeCode(pkgDir);
    else if (a === 'codex') await installCodex(pkgDir);
    else if (a === 'other') await installOther(pkgDir);
  }
}

async function installClaudeCode(pkgDir: string): Promise<void> {
  const skillDir = join(homedir(), '.claude', 'skills', 'mirador');
  const cmdFile = join(homedir(), '.claude', 'commands', 'mirador.md');
  await mkdir(skillDir, { recursive: true });
  await cp(join(pkgDir, 'skill'), skillDir, { recursive: true, force: true });
  await mkdir(join(homedir(), '.claude', 'commands'), { recursive: true });
  await cp(join(pkgDir, 'command', 'mirador.md'), cmdFile);
  console.log(`Claude Code: installed skill to ${skillDir} and /mirador to ${cmdFile}`);
}

async function installCodex(pkgDir: string): Promise<void> {
  // Best-effort: try ~/.codex/skills/mirador/. If we don't know the right layout for
  // the user's Codex version, write the files into a hints folder for manual copying.
  const candidate = join(homedir(), '.codex', 'skills', 'mirador');
  try {
    await mkdir(candidate, { recursive: true });
    await cp(join(pkgDir, 'skill'), candidate, { recursive: true, force: true });
    console.log(`Codex: installed to ${candidate} (best-effort; verify in your Codex docs)`);
  } catch (err) {
    const hints = join(homedir(), '.mirador', 'install-hints', 'codex');
    await mkdir(hints, { recursive: true });
    await cp(join(pkgDir, 'skill'), hints, { recursive: true, force: true });
    console.log(`Codex: could not auto-install. Files saved to ${hints} — copy them per your Codex setup.`);
  }
}

async function installOther(pkgDir: string): Promise<void> {
  const hints = join(homedir(), '.mirador', 'install-hints', 'other');
  await mkdir(hints, { recursive: true });
  await cp(join(pkgDir, 'skill'), hints, { recursive: true, force: true });
  await cp(join(pkgDir, 'command'), join(hints, 'command'), { recursive: true, force: true });
  await writeFile(
    join(hints, 'README.md'),
    'Copy SKILL.md to your agent platform\'s skills directory and command/mirador.md to its slash-commands directory.\n',
    'utf8',
  );
  console.log(`Manual install: files in ${hints}`);
}
```

- [ ] **Step 3: Smoke test by hand**

Run: `cd alpha && npm run build && node dist/index.js init`
Expected: walks the user through the 6 questions; on success, files exist at:
- `~/.mirador/config.json`
- `~/.mirador/themes/{default,deck,memo}/`
- `~/.mirador/templates/password-gate.html`
- `~/.mirador/scripts/encrypt.mjs`
- `~/.mirador/site/.vercel/project.json`
- `~/.claude/skills/mirador/SKILL.md`
- `~/.claude/commands/mirador.md`

- [ ] **Step 4: Commit**

```bash
git add alpha/src/wizard
git commit -m "feat(alpha): mirador init wizard with multi-agent install"
```

---

## Phase 6: The skill and slash command (the share-flow prompt)

The SKILL.md is the **algorithm** the agent runs. It's prose, not code — but it must be precise enough that any model follows it.

### Task 6.1: Write SKILL.md

**Files:**
- Create: `alpha/skill/SKILL.md`
- Create: `alpha/skill/README.md`
- Create: `alpha/command/mirador.md`

- [ ] **Step 1: SKILL.md**

`alpha/skill/SKILL.md`:
```markdown
---
name: mirador
description: Use after producing an HTML artifact in the session (report, dashboard, presentation, document, prototype, or mini-app) and the user wants to share it. Publishes the file to the user's own Vercel project. Walks the user through name, theme (with optional theme-from-reference generation done by your own model), and password protection, then deploys via `vercel` CLI and prints the URL.
---

# Mirador — share an HTML artifact

You publish HTML to the user's own Vercel project. The user already ran `mirador init`; everything you need is in their local Mirador home.

## When to use

You just produced an HTML artifact (a report, deck, dashboard, document, prototype). **Offer; never auto-run.** Say something like *"Want me to publish this and give you a link?"* and wait for confirmation.

## How the share flow works — follow exactly

### 1. Locate the user's Mirador home

Read the pointer file `~/.mirador-home` if it exists; its contents are an absolute path. Otherwise use `~/.mirador/`. Call this `$ROOT`.

Read `$ROOT/config.json`. If it doesn't exist, tell the user to run `mirador init` from a terminal first, then stop.

### 2. Identify the file

If the slash command provided an argument, use it. Otherwise look back in the current session for the most recently produced HTML file and offer it. Confirm if ambiguous.

### 3. Ask the user, in chat, respecting defaults from `config.json`

- **slug** (`name`): suggest from the file's `<title>` or filename. Validate: lowercase letters, digits, dashes only.
- **theme**: list the themes under `$ROOT/themes/` (each has a `meta.json`). Default is `config.defaults.theme`. Also offer `+ generate from a reference…`.
- **password**:
  - If `config.defaults.password_policy === 'never'`, do not ask.
  - If `'always-ask'`, ask the user yes/no.
  - If `'always-on'`, ask for the password (assume yes).
- **visibility**: default `config.defaults.visibility`. Only ask if you think the user might want to change it.

### 4. If the user wants to generate a theme

Ask them for one of:
- **URL** — fetch the page with `curl -s <url>` (or your equivalent), read any linked CSS, then write a CSS file under 4KB scoped under `.mirador-content { ... }` that visibly captures the typographic and color language.
- **Screenshot/image** — examine the image and write the CSS.
- **Description** — write the CSS from the description.

Save the result to `$ROOT/themes/<theme-name>/`:
- `meta.json`: `{ "name": "<n>", "description": "...", "generated_from": { "type": "url"|"image"|"description", "ref": "..." }, "created_at": "<ISO>" }`
- `theme.css`: the CSS you wrote, scoped under `.mirador-content`
- `head.html`: any `<link>`/`<meta>` tags the theme needs (e.g., Google Fonts). Empty if none.

Then use `<theme-name>` as the chosen theme.

### 5. Apply the theme to the user's HTML

Read the user's HTML. Then construct the themed HTML:

1. If theme name is `none`, skip steps 2–4.
2. Ensure a `<head>` exists; if not, insert one right after `<html>` (or wrap the whole content if there is no `<html>`).
3. Before `</head>`, insert (in order): the contents of `$ROOT/themes/<theme>/head.html`, then `<style data-mirador-theme="<theme>">` + the contents of `$ROOT/themes/<theme>/theme.css` + `</style>`.
4. Wrap the `<body>` content in `<div class="mirador-content"> ... </div>`. If there's no `<body>`, wrap everything between `</head>` and `</html>`.

### 6. If a password was given, wrap with the gate

Write the themed HTML to a temp file. Then run:

```
node $ROOT/scripts/encrypt.mjs \
  --in <temp-themed.html> \
  --out $ROOT/site/d/<slug>/index.html \
  --password "<password>" \
  --template $ROOT/templates/password-gate.html
```

The output is the gate page with ciphertext embedded.

### 7. Otherwise, write the themed HTML directly

```
mkdir -p $ROOT/site/d/<slug>/
write themed HTML → $ROOT/site/d/<slug>/index.html
write original HTML → $ROOT/site/d/<slug>/original.html   (verbatim, no theme)
```

### 8. Rebuild the public index if visibility=public

If the doc is `public`, regenerate `$ROOT/site/index.html` from `$ROOT/templates/site-index.html`:
- Replace `{{empty_or_list}}` with empty string if there's at least one public doc; otherwise "No public docs yet."
- Replace `{{list_html}}` with `<ul><li><a href="/d/<slug>/"><title></a></li>...</ul>` for each public doc in the config.

Otherwise leave the index alone.

### 9. Deploy

Run via shell:

```
vercel deploy --prod $ROOT/site --yes --no-clipboard
```

Capture stdout. The deployed URL is in there (`https://...`). If you can't parse it, use the fallback: `https://<config.vercel.domain>/d/<slug>/`.

### 10. Update the config

Append a doc record to `config.json`'s `docs` array:

```
{
  "slug": "<slug>",
  "title": "<title from <title> tag, or slug>",
  "theme": "<theme-name>",
  "passwordProtected": <bool>,
  "visibility": "<unlisted|public>",
  "url": "<url>",
  "createdAt": "<ISO now>"
}
```

### 11. Log the deploy

Append a line to `$ROOT/logs/deploys.log`: `<ISO now>\t<slug>\t<url>\n`.

### 12. Report

Print the URL to the user in chat with one line of confirmation, e.g.:
> Published. `https://mirador-danielm.vercel.app/d/q2/`

## When things go wrong

- `vercel` not found or `vercel whoami` fails → tell the user to run `mirador config`.
- `$ROOT/config.json` missing → tell the user to run `mirador init`.
- The user wants a feature this flow doesn't cover (multi-player, comments, edit-in-browser) → tell them honestly that the alpha doesn't have it; V1 will.

## Don't

- Don't auto-run on every HTML file you produce — always offer first.
- Don't promise the password gate is real authentication. Tell the user it's a client-side gate, disuasive only.
- Don't invent themes outside `$ROOT/themes/`; the directory is the source of truth.
- Don't keep secrets in `config.json` (passwords are never stored — only `passwordProtected: true`).
```

- [ ] **Step 2: Slash command markdown**

`alpha/command/mirador.md`:
```markdown
---
description: Publish an HTML artifact to your Mirador (your own Vercel) and get a shareable link.
---

The user invoked `/mirador $ARGUMENTS`.

If `$ARGUMENTS` is a path to an HTML file, use that file. Otherwise, find the most recently produced HTML artifact in this session; if ambiguous, ask which file.

Then follow the Mirador share flow exactly as documented in `~/.claude/skills/mirador/SKILL.md`. Don't deviate; if the SKILL.md describes a step, do that step.
```

- [ ] **Step 3: Brief skill README** (`alpha/skill/README.md`): one paragraph pointing to the alpha spec.

- [ ] **Step 4: Commit**

```bash
git add alpha/skill alpha/command
git commit -m "feat(alpha): SKILL.md share-flow prompt and /mirador command"
```

---

## Phase 7: Installer and quickstart README

### Task 7.1: `install.sh`

**Files:**
- Create: `alpha/install.sh`

- [ ] **Step 1: Write the installer**

```bash
#!/usr/bin/env bash
set -euo pipefail

require_node20() {
  local v="$(node -v 2>/dev/null || true)"
  [[ -z "$v" ]] && { echo "Node 20+ required. Install from https://nodejs.org/"; exit 1; }
  local major="${v#v}"; major="${major%%.*}"
  if (( major < 20 )); then echo "Node 20+ required (you have $v)."; exit 1; fi
}

require_npm_global_writable() {
  local prefix="$(npm config get prefix)"
  if [[ ! -w "$prefix" ]]; then
    cat >&2 <<EOF
npm global prefix is not user-writable: $prefix

Refusing to run with sudo silently. Either:
  - Use nvm / volta / fnm (recommended), OR
  - Re-run this installer with sudo (you accept responsibility), OR
  - See https://docs.npmjs.com/resolving-eacces-permissions-errors
EOF
    exit 1
  fi
}

require_node20
require_npm_global_writable

echo "Installing @mirador/cli…"
npm i -g @mirador/cli

echo
echo "Installed. Next: run \`mirador init\` to set up Vercel and your agents."
```

- [ ] **Step 2: chmod + commit**

```bash
chmod +x alpha/install.sh
git add alpha/install.sh
git commit -m "feat(alpha): user-friendly install.sh"
```

### Task 7.2: Quickstart README

**Files:**
- Modify: `alpha/README.md`
- Create/modify: `README.md` (repo root)

- [ ] **Step 1: Write `alpha/README.md`**

Sections, in order, each short:
- **What is Mirador?** — one paragraph
- **Install** — one-liner + npm alternative
- **Setup (5 minutes)** — what `mirador init` asks
- **Use it** — `/mirador` in Claude Code; example exchange
- **Themes** — list the shipped; mention "generate from a reference"
- **Security** — honest paragraph about the gate
- **Uninstall** — three lines
- **Links** — spec, repo

Keep under 200 lines.

- [ ] **Step 2: Update repo root `README.md`**

Two sections:
- **What's in this repo** — alpha + future V1
- **Status** — alpha in active dev; V1 design lives in `docs/superpowers/specs/`

- [ ] **Step 3: Commit**

```bash
git add alpha/README.md README.md
git commit -m "docs: alpha quickstart README + repo root pointer"
```

---

## Phase 8: Multi-agent integration verification

This phase is mostly manual — confirm the install works for the agents we claim to support.

### Task 8.1: Verify Claude Code install

- [ ] **Step 1: Fresh test**

In a scratch directory:
```
npm i -g ./alpha
mirador init        # pick "Claude Code" only
```

- [ ] **Step 2: Inspect**

Verify the following exist:
- `~/.claude/skills/mirador/SKILL.md`
- `~/.claude/commands/mirador.md`

- [ ] **Step 3: Functional smoke**

Open Claude Code, type `/mirador`. Confirm the slash command appears in autocomplete and triggers the share flow.

### Task 8.2: Best-effort Codex install

- [ ] **Step 1: Research current Codex layout**

Check the Codex docs / source for where skills live. If `~/.codex/skills/<name>/SKILL.md` is correct, no code changes needed.

- [ ] **Step 2: Manual smoke**

Run init with "Codex" selected. Confirm files were placed; if Codex format differs, capture the right path and update `install-agents.ts` (`installCodex`).

- [ ] **Step 3: If layout unknown, document fallback**

Update `alpha/skill/README.md` with manual install instructions for Codex; mark Codex as "best-effort" in the README.

### Task 8.3: Commit any fixes

```bash
git add alpha/src/wizard/install-agents.ts alpha/skill/README.md
git commit -m "feat(alpha): refine codex install layout based on docs"
```

---

## Phase 9: Pre-release verification

Walk through the spec's success criteria. Each is a checkbox; only ship if all pass.

- [ ] **Step 1: Fresh-account install < 3 min**

On a clean macOS user account or Docker container:
```
curl -fsSL <installer-url> | sh
mirador init
```
Time end-to-end. Must be under 3 minutes assuming a Vercel account exists.

- [ ] **Step 2: `/mirador` flow < 60 s**

In Claude Code, generate a simple HTML file, type `/mirador`, complete the prompts. Time from "Enter on slash" to "URL printed". Must be under 60 seconds (excluding Vercel deploy time).

- [ ] **Step 3: Theme generation quality**

Pick 10 real reference sites (mix of corporate, design portfolios, news, github readmes, etc.). For each, generate a theme via the share flow, deploy a sample HTML, screenshot. Judge: 8/10 visibly resemble the reference.

- [ ] **Step 4: Password gate resists casual attack**

Pick a strong password; share an HTML doc through the gate; spend 30 minutes trying to extract the content without the password (view source, dev tools). Must fail.

- [ ] **Step 5: README quickstart literally works**

Walk a friend (or a fresh VM) through the README quickstart. They should reach a working `/mirador` without you helping.

- [ ] **Step 6: Multi-agent dual install**

Run `mirador init`, pick both Claude Code and Codex. Verify both have working skill + (where applicable) slash command.

If any of these fail, return to the relevant phase and fix. Each fix is its own commit (`fix(alpha): ...`).

---

## Notes for the implementer

- **DRY:** types like `Config`, `AgentKey`, `PasswordPolicy` live in one place (`config.ts`). Reuse them.
- **YAGNI:** this plan deliberately omits — and the spec deliberately defers to V1 — sandbox runtime, comments, forks, multi-player, server-side AI, Vercel Pro detection, custom domains, analytics, audit log, embed widget, CI workflows. Resist the urge to add any of these to the alpha.
- **Frequent commits:** every step that ends with "commit" should be its own commit. Don't batch.
- **Tests** are co-located (`foo.ts` next to `foo.test.ts`) and run via `npm test`.
- **No Anthropic SDK in the binary.** All AI work (theme generation, share flow logic) happens inside the user's agent.
- **No `mirador share` or `mirador list`.** If you find yourself adding one, stop — that work belongs to the agent in SKILL.md.
- **The agent platform support matrix is intentionally short.** Claude Code is the only first-class target for the alpha; everything else is best-effort or manual.

---

## Out of scope (becomes the V1 plan, separately)

- Our own hosted runtime, accounts, SSO, custom domains, analytics, audit log
- Multi-player editing, comments, forks, versioned history, server-side AI edit endpoint
- Sandbox iframe rendering (the alpha relies entirely on the user's own deploy)

These are covered by `docs/superpowers/specs/2026-05-12-mirador-design.md` and will get their own plan document.
