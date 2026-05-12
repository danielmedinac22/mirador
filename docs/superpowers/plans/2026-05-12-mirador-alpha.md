# Mirador Alpha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Mirador alpha — a Claude Code skill plus a thin Node CLI that publishes HTML to the user's own Vercel project, with conversational name/theme/password flows and an AI-driven theme-from-reference generator.

**Architecture:** TypeScript Node CLI in `alpha/`, built with `tsup` to a single executable. Two visible commands (`share`, `list`). All other behavior surfaces through conversational flows invoked from inside `share`. The skill in `alpha/skill/SKILL.md` describes when to invoke the CLI from Claude Code. Vercel CLI is the deployment substrate; we never run our own backend in the alpha.

**Tech Stack:**
- Node 20+, TypeScript (strict), `tsup` for bundling
- `commander` for CLI parsing
- `@clack/prompts` for TTY prompts
- `@anthropic-ai/sdk` for theme generation
- `clipboardy` for clipboard
- `undici` `fetch` (built-in on Node 20)
- `vitest` for tests, `biome` for lint+format
- `vercel` CLI shelled out via `child_process`
- Browser crypto via `window.crypto.subtle`; Node crypto via `globalThis.crypto.subtle` (both native, no JS crypto libs)

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-12-mirador-alpha-design.md`
- V1 spec (context only): `docs/superpowers/specs/2026-05-12-mirador-design.md`

---

## Phase 0: Repo scaffold

The alpha lives entirely under `alpha/` in the same repo as the (future) V1 work. No monorepo tooling needed for the alpha — `alpha/` is a self-contained npm package. The V1 will introduce pnpm workspaces later.

### Task 0.1: Initialize `alpha/` as an npm package

**Files:**
- Create: `alpha/package.json`
- Create: `alpha/tsconfig.json`
- Create: `alpha/.gitignore`
- Create: `alpha/biome.json`
- Create: `alpha/README.md` (placeholder)

- [ ] **Step 1: Create `alpha/package.json`**

```json
{
  "name": "@mirador/cli",
  "version": "0.1.0-alpha.0",
  "description": "Mirador alpha — publish AI-generated HTML to your own Vercel in one command.",
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": { "mirador": "./dist/index.js" },
  "files": ["dist", "themes", "templates", "skill"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --target node20 --shims --no-splitting --clean",
    "dev": "tsup src/index.ts --format esm --target node20 --shims --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.40.0",
    "@clack/prompts": "^0.7.0",
    "clipboardy": "^4.0.0",
    "commander": "^12.0.0",
    "nanoid": "^5.0.0"
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

- [ ] **Step 5: Create `alpha/README.md` placeholder**

```markdown
# Mirador Alpha

Skill + CLI to publish AI-generated HTML to your own Vercel.

Install and quickstart docs land in Phase 6.
```

- [ ] **Step 6: Install dependencies and verify**

Run: `cd alpha && npm install`
Expected: completes without errors. `node_modules/` exists.

- [ ] **Step 7: Commit**

```bash
git add alpha/package.json alpha/tsconfig.json alpha/.gitignore alpha/biome.json alpha/README.md alpha/package-lock.json
git commit -m "chore(alpha): scaffold @mirador/cli package"
```

---

## Phase 1: CLI entrypoint + command routing

Produce a working `mirador` binary that responds to `--help`, `share --help`, `list --help`. No real functionality yet — just the skeleton.

### Task 1.1: Entrypoint with `commander`

**Files:**
- Create: `alpha/src/index.ts`
- Create: `alpha/src/commands/share.ts`
- Create: `alpha/src/commands/list.ts`
- Create: `alpha/src/version.ts`

- [ ] **Step 1: Create `alpha/src/version.ts`**

```ts
export const VERSION = '0.1.0-alpha.0';
```

- [ ] **Step 2: Create `alpha/src/commands/share.ts` stub**

```ts
import type { Command } from 'commander';

export function registerShare(program: Command) {
  program
    .command('share <file>')
    .description('Publish an HTML file to your Mirador (your own Vercel)')
    .option('--name <slug>', 'override slug')
    .option('--theme <name>', 'theme to apply (built-in or generated)')
    .option('--password <password>', 'protect with a soft client-side gate')
    .option('--visibility <v>', 'unlisted | public', 'unlisted')
    .option('--non-interactive', 'skip TTY prompts; rely on flags (used by the skill)')
    .action(async (file: string, opts: ShareOptions) => {
      const { runShare } = await import('../flows/share.js');
      await runShare(file, opts);
    });
}

export interface ShareOptions {
  name?: string;
  theme?: string;
  password?: string;
  visibility: 'unlisted' | 'public';
  nonInteractive?: boolean;
}
```

- [ ] **Step 3: Create `alpha/src/commands/list.ts` stub**

```ts
import type { Command } from 'commander';

export function registerList(program: Command) {
  program
    .command('list')
    .description('Show your shared docs; pick one to copy/open/delete.')
    .action(async () => {
      const { runList } = await import('../flows/list.js');
      await runList();
    });
}
```

- [ ] **Step 4: Create `alpha/src/index.ts`**

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { registerList } from './commands/list.js';
import { registerShare } from './commands/share.js';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('mirador')
  .description('Publish AI-generated HTML to your own Vercel in one command.')
  .version(VERSION);

registerShare(program);
registerList(program);

// Hidden housekeeping commands. Not in help, not user-facing.
program
  .command('skill', { hidden: true })
  .description('Internal: skill install/uninstall (used by installer)')
  .argument('<action>', 'install | uninstall')
  .action(async (action: string) => {
    const { runSkill } = await import('./flows/skill.js');
    await runSkill(action);
  });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 5: Create stubs for the imported flow modules**

Create empty stubs so the build doesn't fail:

`alpha/src/flows/share.ts`:
```ts
import type { ShareOptions } from '../commands/share.js';

export async function runShare(_file: string, _opts: ShareOptions): Promise<void> {
  throw new Error('share not implemented yet');
}
```

`alpha/src/flows/list.ts`:
```ts
export async function runList(): Promise<void> {
  throw new Error('list not implemented yet');
}
```

`alpha/src/flows/skill.ts`:
```ts
export async function runSkill(_action: string): Promise<void> {
  throw new Error('skill not implemented yet');
}
```

- [ ] **Step 6: Build and run `--help`**

Run: `cd alpha && npm run build && node dist/index.js --help`
Expected: prints usage with `share`, `list` commands (no `skill` since hidden).

- [ ] **Step 7: Verify subcommand help**

Run: `node dist/index.js share --help`
Expected: prints flags including `--non-interactive`.

- [ ] **Step 8: Commit**

```bash
git add alpha/src
git commit -m "feat(alpha): CLI entrypoint with share/list commands"
```

---

## Phase 2: Config module

Persists `~/.mirador/config.json`. Read/write only — no flows yet.

### Task 2.1: Config types and IO

**Files:**
- Create: `alpha/src/config.ts`
- Create: `alpha/src/config.test.ts`
- Create: `alpha/src/paths.ts`

- [ ] **Step 1: Create `alpha/src/paths.ts`**

```ts
import { homedir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.env.MIRADOR_HOME ?? join(homedir(), '.mirador');

export const paths = {
  root: ROOT,
  config: join(ROOT, 'config.json'),
  site: join(ROOT, 'site'),
  themes: join(ROOT, 'themes'),
  logs: join(ROOT, 'logs'),
} as const;
```

The `MIRADOR_HOME` env var is for tests — it lets us point everything at a temp dir.

- [ ] **Step 2: Write the failing test `alpha/src/config.test.ts`**

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('config', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mirador-test-'));
    process.env.MIRADOR_HOME = tmp;
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env.MIRADOR_HOME;
  });

  it('returns null when config does not exist', async () => {
    const { readConfig } = await import('./config.js');
    expect(await readConfig()).toBeNull();
  });

  it('round-trips a config', async () => {
    const { readConfig, writeConfig } = await import('./config.js');
    await writeConfig({
      vercel: {
        projectId: 'p1',
        projectName: 'mirador-test',
        domain: 'mirador-test.vercel.app',
        orgId: 'o1',
      },
      defaultTheme: 'default',
      docs: [],
    });
    const c = await readConfig();
    expect(c?.vercel.projectName).toBe('mirador-test');
  });

  it('appends a doc record', async () => {
    const { addDoc, readConfig, writeConfig } = await import('./config.js');
    await writeConfig({
      vercel: { projectId: 'p1', projectName: 'n', domain: 'd', orgId: 'o' },
      defaultTheme: 'default',
      docs: [],
    });
    await addDoc({
      slug: 'q2',
      title: 'Q2',
      theme: 'default',
      passwordProtected: false,
      visibility: 'unlisted',
      url: 'https://n.vercel.app/d/q2/',
      createdAt: new Date('2026-05-12T00:00:00Z').toISOString(),
    });
    const c = await readConfig();
    expect(c?.docs).toHaveLength(1);
    expect(c?.docs[0]?.slug).toBe('q2');
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `cd alpha && npm test -- config`
Expected: FAIL — `./config.js` not found.

- [ ] **Step 4: Implement `alpha/src/config.ts`**

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { paths } from './paths.js';

export interface VercelInfo {
  projectId: string;
  projectName: string;
  domain: string;
  orgId: string;
}

export interface DocRecord {
  slug: string;
  title: string;
  theme: string;
  passwordProtected: boolean;
  visibility: 'unlisted' | 'public';
  url: string;
  createdAt: string;
}

export interface Config {
  vercel: VercelInfo;
  defaultTheme: string;
  docs: DocRecord[];
}

export async function readConfig(): Promise<Config | null> {
  try {
    const raw = await readFile(paths.config, 'utf8');
    return JSON.parse(raw) as Config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await mkdir(dirname(paths.config), { recursive: true });
  await writeFile(paths.config, JSON.stringify(config, null, 2), 'utf8');
}

export async function addDoc(doc: DocRecord): Promise<void> {
  const config = await readConfig();
  if (!config) throw new Error('Mirador not initialized — run `mirador share` to set up.');
  config.docs = [...config.docs.filter((d) => d.slug !== doc.slug), doc];
  await writeConfig(config);
}

export async function removeDoc(slug: string): Promise<void> {
  const config = await readConfig();
  if (!config) return;
  config.docs = config.docs.filter((d) => d.slug !== slug);
  await writeConfig(config);
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test -- config`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add alpha/src/config.ts alpha/src/config.test.ts alpha/src/paths.ts
git commit -m "feat(alpha): config module with disk persistence"
```

---

## Phase 3: Themes — shipped library and theme/apply

### Task 3.1: Ship the three default themes

**Files:**
- Create: `alpha/themes/default/meta.json`
- Create: `alpha/themes/default/theme.css`
- Create: `alpha/themes/default/head.html` (empty or minimal)
- Create: `alpha/themes/deck/{meta.json,theme.css,head.html}`
- Create: `alpha/themes/memo/{meta.json,theme.css,head.html}`

- [ ] **Step 1: Create the `default` theme**

`alpha/themes/default/meta.json`:
```json
{
  "name": "default",
  "description": "Clean, neutral, generous whitespace. Works for any document.",
  "tags": ["clean", "neutral"]
}
```

`alpha/themes/default/theme.css`:
```css
.mirador-content {
  max-width: 720px;
  margin: 4rem auto;
  padding: 0 1.5rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  color: #1a1a1a;
}
.mirador-content h1, .mirador-content h2, .mirador-content h3 {
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}
.mirador-content h1 { font-size: 2rem; margin-top: 0; }
.mirador-content h2 { font-size: 1.5rem; margin-top: 2.5rem; }
.mirador-content h3 { font-size: 1.2rem; margin-top: 2rem; }
.mirador-content p, .mirador-content li { color: #333; }
.mirador-content code {
  background: #f3f3f3; padding: 0.1em 0.3em; border-radius: 3px;
  font-size: 0.9em; font-family: 'SF Mono', ui-monospace, monospace;
}
.mirador-content pre {
  background: #1a1a1a; color: #eee; padding: 1rem; border-radius: 6px;
  overflow-x: auto;
}
.mirador-content a { color: #2451b7; text-decoration: underline; }
.mirador-content table { border-collapse: collapse; width: 100%; }
.mirador-content th, .mirador-content td {
  border-bottom: 1px solid #e5e5e5; padding: 0.5rem 0.75rem; text-align: left;
}
```

`alpha/themes/default/head.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

- [ ] **Step 2: Create the `deck` theme**

`alpha/themes/deck/meta.json`:
```json
{
  "name": "deck",
  "description": "Presentation-style: large type, vertical slide rhythm, dark mode optional.",
  "tags": ["presentation", "slides"]
}
```

`alpha/themes/deck/theme.css`:
```css
.mirador-content {
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  background: #0e0f11;
  color: #f5f5f7;
  min-height: 100vh;
  padding: 4rem 2rem;
  font-size: 20px;
  line-height: 1.5;
}
.mirador-content > * { max-width: 960px; margin-inline: auto; }
.mirador-content h1 { font-size: 3.5rem; font-weight: 700; letter-spacing: -0.02em; }
.mirador-content h2 { font-size: 2.5rem; font-weight: 600; }
.mirador-content h3 { font-size: 1.8rem; }
.mirador-content section, .mirador-content .slide {
  min-height: 90vh; display: flex; flex-direction: column; justify-content: center;
  padding: 4rem 0; border-top: 1px solid #2a2b2e;
}
.mirador-content code {
  background: #1f2024; color: #c5e3ff; padding: 0.1em 0.4em; border-radius: 4px;
}
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
{
  "name": "memo",
  "description": "Document/report style: serif body, restrained palette, optimized for reading.",
  "tags": ["document", "memo", "report"]
}
```

`alpha/themes/memo/theme.css`:
```css
.mirador-content {
  max-width: 680px;
  margin: 5rem auto;
  padding: 0 1.5rem;
  font-family: 'Source Serif Pro', Georgia, 'Times New Roman', serif;
  font-size: 17px;
  line-height: 1.75;
  color: #2a2a2a;
}
.mirador-content h1, .mirador-content h2, .mirador-content h3 {
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  font-weight: 600; letter-spacing: -0.01em; color: #1a1a1a;
}
.mirador-content h1 { font-size: 1.75rem; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; }
.mirador-content blockquote {
  border-left: 3px solid #888; padding-left: 1rem; margin-left: 0; color: #555; font-style: italic;
}
.mirador-content code { font-family: 'SF Mono', ui-monospace, monospace; font-size: 0.92em; }
```

`alpha/themes/memo/head.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@600&family=Source+Serif+Pro:wght@400;600&display=swap" rel="stylesheet">
```

- [ ] **Step 4: Commit themes**

```bash
git add alpha/themes
git commit -m "feat(alpha): ship default, deck, memo themes"
```

### Task 3.2: `theme/apply` — pure function

**Files:**
- Create: `alpha/src/theme/apply.ts`
- Create: `alpha/src/theme/apply.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { applyTheme } from './apply.js';

const sampleHtml = `<!doctype html><html><head><title>T</title></head><body><h1>Hi</h1></body></html>`;
const sampleTheme = {
  name: 'demo',
  css: '.mirador-content { color: red; }',
  head: '<meta name="viewport" content="width=device-width">',
};

describe('applyTheme', () => {
  it('wraps body in .mirador-content div', () => {
    const out = applyTheme(sampleHtml, sampleTheme);
    expect(out).toContain('<div class="mirador-content"');
    expect(out).toMatch(/<\/div>\s*<\/body>/);
  });

  it('injects theme.css inside <head>', () => {
    const out = applyTheme(sampleHtml, sampleTheme);
    expect(out).toContain('<style data-mirador-theme="demo">.mirador-content { color: red; }</style>');
  });

  it('injects head.html before </head>', () => {
    const out = applyTheme(sampleHtml, sampleTheme);
    expect(out).toContain('<meta name="viewport"');
    expect(out.indexOf('<meta name="viewport"')).toBeLessThan(out.indexOf('</head>'));
  });

  it("creates <head> if input has none", () => {
    const out = applyTheme('<html><body><p>hi</p></body></html>', sampleTheme);
    expect(out).toContain('<head>');
    expect(out).toContain('<style data-mirador-theme=');
  });

  it("creates <body> if input has none (rare)", () => {
    const out = applyTheme('<p>hi</p>', sampleTheme);
    expect(out).toContain('<div class="mirador-content"');
  });

  it('with theme name "none" returns html unchanged', () => {
    const out = applyTheme(sampleHtml, { name: 'none', css: '', head: '' });
    expect(out).toBe(sampleHtml);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- apply`
Expected: FAIL — `./apply.js` not found.

- [ ] **Step 3: Implement `apply.ts`**

```ts
export interface Theme {
  name: string;
  css: string;
  head: string;
}

const HEAD_OPEN = /<head(\s[^>]*)?>/i;
const HEAD_CLOSE = /<\/head>/i;
const BODY_OPEN = /<body(\s[^>]*)?>/i;
const BODY_CLOSE = /<\/body>/i;

export function applyTheme(html: string, theme: Theme): string {
  if (theme.name === 'none') return html;

  let out = html;

  // Ensure <head>
  if (!HEAD_OPEN.test(out)) {
    if (/<html(\s[^>]*)?>/i.test(out)) {
      out = out.replace(/<html(\s[^>]*)?>/i, (m) => `${m}<head></head>`);
    } else {
      out = `<html><head></head><body>${out}</body></html>`;
    }
  }

  // Inject head.html and <style>
  const headInjection = [
    theme.head,
    `<style data-mirador-theme="${escapeAttr(theme.name)}">${theme.css}</style>`,
  ]
    .filter(Boolean)
    .join('\n');
  out = out.replace(HEAD_CLOSE, `${headInjection}</head>`);

  // Ensure <body>
  if (!BODY_OPEN.test(out)) {
    out = out.replace(/<\/head>/i, `</head><body></body>`);
  }

  // Wrap body content
  out = out.replace(BODY_OPEN, (m) => `${m}<div class="mirador-content">`);
  out = out.replace(BODY_CLOSE, `</div></body>`);

  return out;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- apply`
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add alpha/src/theme
git commit -m "feat(alpha): theme/apply pure function with tests"
```

### Task 3.3: `theme/store` — load themes from disk

**Files:**
- Create: `alpha/src/theme/store.ts`
- Create: `alpha/src/theme/store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('theme/store', () => {
  let tmp: string;
  const shipped = resolve(fileURLToPath(import.meta.url), '../../../themes');

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mirador-store-'));
    process.env.MIRADOR_HOME = tmp;
    process.env.MIRADOR_SHIPPED_THEMES = shipped;
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env.MIRADOR_HOME;
    delete process.env.MIRADOR_SHIPPED_THEMES;
  });

  it('lists shipped themes when ~/.mirador/themes is empty', async () => {
    const { listThemes } = await import('./store.js');
    const themes = await listThemes();
    const names = themes.map((t) => t.name).sort();
    expect(names).toEqual(['deck', 'default', 'memo']);
  });

  it('loads a shipped theme', async () => {
    const { loadTheme } = await import('./store.js');
    const t = await loadTheme('default');
    expect(t.name).toBe('default');
    expect(t.css.length).toBeGreaterThan(0);
  });

  it('user themes shadow shipped themes with the same name', async () => {
    const userDir = join(tmp, 'themes', 'default');
    cpSync(join(shipped, 'default'), userDir, { recursive: true });
    // overwrite css
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(userDir, 'theme.css'), '/* user override */');
    const { loadTheme } = await import('./store.js');
    const t = await loadTheme('default');
    expect(t.css).toContain('user override');
  });

  it('throws on missing theme', async () => {
    const { loadTheme } = await import('./store.js');
    await expect(loadTheme('nope')).rejects.toThrow(/not found/i);
  });

  it('returns "none" pseudo-theme without disk access', async () => {
    const { loadTheme } = await import('./store.js');
    const t = await loadTheme('none');
    expect(t).toEqual({ name: 'none', css: '', head: '' });
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement `store.ts`**

```ts
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paths } from '../paths.js';
import type { Theme } from './apply.js';

export interface ThemeMeta {
  name: string;
  description: string;
  tags?: string[];
  generatedFrom?: { type: 'url' | 'image' | 'description'; ref: string };
}

const SHIPPED_DIR =
  process.env.MIRADOR_SHIPPED_THEMES ?? resolve(fileURLToPath(import.meta.url), '../../../themes');

export async function listThemes(): Promise<ThemeMeta[]> {
  const found = new Map<string, ThemeMeta>();
  for (const dir of [SHIPPED_DIR, paths.themes]) {
    const entries = await safeReaddir(dir);
    for (const name of entries) {
      const meta = await safeReadMeta(join(dir, name));
      if (meta) found.set(meta.name, meta);
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadTheme(name: string): Promise<Theme> {
  if (name === 'none') return { name: 'none', css: '', head: '' };
  // User themes shadow shipped themes
  for (const dir of [paths.themes, SHIPPED_DIR]) {
    const themeDir = join(dir, name);
    const meta = await safeReadMeta(themeDir);
    if (!meta) continue;
    const css = await readFile(join(themeDir, 'theme.css'), 'utf8');
    const head = await safeReadFile(join(themeDir, 'head.html'));
    return { name: meta.name, css, head: head ?? '' };
  }
  throw new Error(`theme "${name}" not found`);
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function safeReadMeta(dir: string): Promise<ThemeMeta | null> {
  const raw = await safeReadFile(join(dir, 'meta.json'));
  if (!raw) return null;
  return JSON.parse(raw) as ThemeMeta;
}
```

- [ ] **Step 4: Run, verify pass**

- [ ] **Step 5: Commit**

```bash
git add alpha/src/theme/store.ts alpha/src/theme/store.test.ts
git commit -m "feat(alpha): theme/store loads shipped and user themes"
```

---

## Phase 4: Site build

Build a local static site under `~/.mirador/site/` from config + docs. Don't deploy yet.

### Task 4.1: `site/build`

**Files:**
- Create: `alpha/src/site/build.ts`
- Create: `alpha/src/site/build.test.ts`
- Create: `alpha/templates/site-index.html`

- [ ] **Step 1: Create the site index template**

`alpha/templates/site-index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{title}}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; color: #1a1a1a; }
    h1 { font-weight: 600; letter-spacing: -0.01em; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.75rem 0; border-bottom: 1px solid #eee; }
    a { color: #2451b7; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .empty { color: #888; }
  </style>
</head>
<body>
  <h1>Mirador</h1>
  <p class="empty">{{empty_or_list}}</p>
  {{list_html}}
  <footer style="margin-top:4rem;color:#888;font-size:0.85em;">
    Powered by <a href="https://github.com/mirador">Mirador</a>.
  </footer>
</body>
</html>
```

- [ ] **Step 2: Write failing test**

```ts
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Config } from '../config.js';

const shipped = resolve(fileURLToPath(import.meta.url), '../../../themes');

const baseConfig = (docs: Config['docs']): Config => ({
  vercel: { projectId: 'p', projectName: 'mirador-test', domain: 'mirador-test.vercel.app', orgId: 'o' },
  defaultTheme: 'default',
  docs,
});

describe('site/build', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mirador-build-'));
    process.env.MIRADOR_HOME = tmp;
    process.env.MIRADOR_SHIPPED_THEMES = shipped;
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    delete process.env.MIRADOR_HOME;
    delete process.env.MIRADOR_SHIPPED_THEMES;
  });

  it('writes an index even when docs are empty', async () => {
    const { buildSite } = await import('./build.js');
    await buildSite(baseConfig([]));
    const idx = readFileSync(join(tmp, 'site', 'index.html'), 'utf8');
    expect(idx).toContain('Mirador');
    expect(idx).toMatch(/no.*docs/i);
  });

  it('only lists public docs on the index', async () => {
    const { buildSite } = await import('./build.js');
    await buildSite(
      baseConfig([
        { slug: 'a', title: 'Public A', theme: 'default', passwordProtected: false, visibility: 'public', url: '/d/a/', createdAt: '' },
        { slug: 'b', title: 'Hidden B', theme: 'default', passwordProtected: false, visibility: 'unlisted', url: '/d/b/', createdAt: '' },
      ]),
    );
    const idx = readFileSync(join(tmp, 'site', 'index.html'), 'utf8');
    expect(idx).toContain('Public A');
    expect(idx).not.toContain('Hidden B');
  });
});
```

- [ ] **Step 3: Run, verify fail**

- [ ] **Step 4: Implement `build.ts`**

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '../config.js';
import { paths } from '../paths.js';

const TEMPLATES_DIR = resolve(fileURLToPath(import.meta.url), '../../../templates');

export async function buildSite(config: Config): Promise<void> {
  await mkdir(paths.site, { recursive: true });
  await writeIndex(config);
}

async function writeIndex(config: Config): Promise<void> {
  const template = await readFile(join(TEMPLATES_DIR, 'site-index.html'), 'utf8');
  const publicDocs = config.docs.filter((d) => d.visibility === 'public');
  const empty = publicDocs.length === 0 ? 'No public docs yet.' : '';
  const list =
    publicDocs.length === 0
      ? ''
      : `<ul>${publicDocs
          .map(
            (d) =>
              `<li><a href="/d/${escapeHref(d.slug)}/">${escapeText(d.title)}</a></li>`,
          )
          .join('\n')}</ul>`;
  const out = template
    .replaceAll('{{title}}', 'Mirador')
    .replaceAll('{{empty_or_list}}', empty)
    .replaceAll('{{list_html}}', list);
  await writeFile(join(paths.site, 'index.html'), out, 'utf8');
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeHref(s: string): string {
  return encodeURIComponent(s);
}
```

- [ ] **Step 5: Run tests, verify pass; commit**

```bash
git add alpha/src/site/ alpha/templates/site-index.html
git commit -m "feat(alpha): site builder writes the index page"
```

### Task 4.2: Write per-doc page during build

**Files:**
- Modify: `alpha/src/site/build.ts`
- Modify: `alpha/src/site/build.test.ts`

- [ ] **Step 1: Extend the test**

Add to the existing `build.test.ts`:

```ts
it('writes a per-doc index.html with applied theme', async () => {
  const { writeDocPage } = await import('./build.js');
  await writeDocPage('q2', '<html><body><h1>Q2</h1></body></html>', 'default');
  const out = readFileSync(join(tmp, 'site', 'd', 'q2', 'index.html'), 'utf8');
  expect(out).toContain('<div class="mirador-content">');
  expect(out).toContain('<h1>Q2</h1>');
});

it('keeps original.html alongside index.html', async () => {
  const { writeDocPage } = await import('./build.js');
  const html = '<html><body><h1>raw</h1></body></html>';
  await writeDocPage('q2', html, 'none');
  const orig = readFileSync(join(tmp, 'site', 'd', 'q2', 'original.html'), 'utf8');
  expect(orig).toBe(html);
});
```

- [ ] **Step 2: Implement `writeDocPage` in `build.ts`**

```ts
import { applyTheme } from '../theme/apply.js';
import { loadTheme } from '../theme/store.js';

export async function writeDocPage(slug: string, html: string, themeName: string): Promise<void> {
  const theme = await loadTheme(themeName);
  const themed = applyTheme(html, theme);
  const docDir = join(paths.site, 'd', slug);
  await mkdir(docDir, { recursive: true });
  await writeFile(join(docDir, 'index.html'), themed, 'utf8');
  await writeFile(join(docDir, 'original.html'), html, 'utf8');
}
```

- [ ] **Step 3: Verify tests pass**

- [ ] **Step 4: Commit**

```bash
git add alpha/src/site/build.ts alpha/src/site/build.test.ts
git commit -m "feat(alpha): site builder writes per-doc themed pages"
```

---

## Phase 5: Password gate (client-side soft auth)

### Task 5.1: Password gate template + encryptor

**Files:**
- Create: `alpha/src/security/gate.ts`
- Create: `alpha/src/security/gate.test.ts`
- Create: `alpha/templates/password-gate.html`

- [ ] **Step 1: Create the gate template**

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

- [ ] **Step 2: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { wrapWithGate } from './gate.js';

describe('wrapWithGate', () => {
  it('returns plaintext-free HTML', async () => {
    const html = '<html><body><h1>top secret</h1></body></html>';
    const out = await wrapWithGate(html, 'hunter2');
    expect(out).not.toContain('top secret');
    expect(out).toContain('Password required');
  });

  it('round-trips via the encrypt/decrypt primitive', async () => {
    const { _decryptForTest } = await import('./gate.js');
    const html = '<p>round trip</p>';
    const out = await wrapWithGate(html, 'pw');
    const recovered = await _decryptForTest(out, 'pw');
    expect(recovered).toBe(html);
  });

  it('wrong password fails to decrypt', async () => {
    const { _decryptForTest } = await import('./gate.js');
    const out = await wrapWithGate('<p>x</p>', 'pw');
    await expect(_decryptForTest(out, 'nope')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run, verify fail**

- [ ] **Step 4: Implement `gate.ts`**

```ts
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATES_DIR = resolve(fileURLToPath(import.meta.url), '../../../templates');
const ITERATIONS = 200_000;

export async function wrapWithGate(html: string, password: string): Promise<string> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(html)),
  );
  const template = await readFile(`${TEMPLATES_DIR}/password-gate.html`, 'utf8');
  return template
    .replace('__SALT__', toB64(salt))
    .replace('__IV__', toB64(iv))
    .replace('__CT__', toB64(ct))
    .replace('__ITER__', String(ITERATIONS));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return arr;
}

function toB64(b: Uint8Array): string {
  return Buffer.from(b).toString('base64');
}

function fromB64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64'));
}

export async function _decryptForTest(wrappedHtml: string, password: string): Promise<string> {
  const salt = fromB64(extract(wrappedHtml, '__SALT__', 'SALT_B64'));
  const iv = fromB64(extract(wrappedHtml, '__IV__', 'IV_B64'));
  const ct = fromB64(extract(wrappedHtml, '__CT__', 'CT_B64'));
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(plain);
}

function extract(html: string, _placeholder: string, varName: string): string {
  const m = html.match(new RegExp(`${varName}\\s*=\\s*"([^"]+)"`));
  if (!m?.[1]) throw new Error(`missing ${varName}`);
  return m[1];
}
```

- [ ] **Step 5: Verify tests pass; commit**

```bash
git add alpha/src/security alpha/templates/password-gate.html
git commit -m "feat(alpha): client-side password gate with AES-GCM + PBKDF2"
```

### Task 5.2: Wire `wrapWithGate` into `writeDocPage`

**Files:**
- Modify: `alpha/src/site/build.ts`
- Modify: `alpha/src/site/build.test.ts`

- [ ] **Step 1: Update `writeDocPage` signature and impl**

```ts
import { wrapWithGate } from '../security/gate.js';

export async function writeDocPage(
  slug: string,
  html: string,
  themeName: string,
  password?: string,
): Promise<void> {
  const theme = await loadTheme(themeName);
  let final = applyTheme(html, theme);
  if (password) final = await wrapWithGate(final, password);
  const docDir = join(paths.site, 'd', slug);
  await mkdir(docDir, { recursive: true });
  await writeFile(join(docDir, 'index.html'), final, 'utf8');
  await writeFile(join(docDir, 'original.html'), html, 'utf8');
}
```

- [ ] **Step 2: Add a test for password-protected build**

```ts
it('when password given, index.html is a gate page', async () => {
  const { writeDocPage } = await import('./build.js');
  await writeDocPage('s', '<html><body><h1>secret</h1></body></html>', 'default', 'pw');
  const out = readFileSync(join(tmp, 'site', 'd', 's', 'index.html'), 'utf8');
  expect(out).toContain('Password required');
  expect(out).not.toContain('secret');
});
```

- [ ] **Step 3: Verify tests pass; commit**

```bash
git add alpha/src/site/build.ts alpha/src/site/build.test.ts
git commit -m "feat(alpha): wrap doc page with gate when password given"
```

---

## Phase 6: Vercel integration

### Task 6.1: Vercel CLI wrapper

**Files:**
- Create: `alpha/src/site/vercel.ts`
- Create: `alpha/src/site/vercel.test.ts`

The `vercel` CLI is shelled out. Tests use a mock binary on PATH (see step below).

- [ ] **Step 1: Implement `vercel.ts`**

```ts
import { spawn } from 'node:child_process';
import { paths } from '../paths.js';

export interface VercelLink {
  projectId: string;
  projectName: string;
  domain: string;
  orgId: string;
}

export async function checkVercelInstalled(): Promise<{ ok: true; version: string } | { ok: false }> {
  try {
    const { stdout } = await run('vercel', ['--version']);
    return { ok: true, version: stdout.trim() };
  } catch {
    return { ok: false };
  }
}

export async function checkLoggedIn(): Promise<{ ok: true; user: string } | { ok: false }> {
  try {
    const { stdout } = await run('vercel', ['whoami']);
    return { ok: true, user: stdout.trim() };
  } catch {
    return { ok: false };
  }
}

export async function deployProd(): Promise<string> {
  const { stdout } = await run('vercel', [
    'deploy',
    paths.site,
    '--prod',
    '--yes',
    '--no-clipboard',
  ]);
  const url = stdout.match(/https:\/\/[^\s]+/)?.[0];
  if (!url) throw new Error('could not parse deploy URL from Vercel output');
  return url;
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
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}: ${stderr.trim()}`));
    });
  });
}
```

- [ ] **Step 2: Write test using a mock vercel binary**

```ts
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('site/vercel', () => {
  let mockDir: string;
  let prevPath: string | undefined;

  function mockVercel(stdout: string, exit = 0): void {
    const script = `#!/usr/bin/env bash\ncat <<'OUT'\n${stdout}\nOUT\nexit ${exit}\n`;
    const path = join(mockDir, 'vercel');
    writeFileSync(path, script);
    chmodSync(path, 0o755);
  }

  beforeEach(() => {
    mockDir = mkdtempSync(join(tmpdir(), 'mirador-mock-'));
    prevPath = process.env.PATH;
    process.env.PATH = `${mockDir}:${process.env.PATH}`;
  });

  afterEach(() => {
    rmSync(mockDir, { recursive: true, force: true });
    if (prevPath !== undefined) process.env.PATH = prevPath;
  });

  it('checkVercelInstalled returns ok when CLI present', async () => {
    mockVercel('Vercel CLI 33.0.0');
    const { checkVercelInstalled } = await import('./vercel.js');
    const r = await checkVercelInstalled();
    expect(r.ok).toBe(true);
  });

  it('deployProd extracts the URL from stdout', async () => {
    mockVercel('Preview: https://mirador-test-abc.vercel.app');
    const { deployProd } = await import('./vercel.js');
    const url = await deployProd();
    expect(url).toBe('https://mirador-test-abc.vercel.app');
  });

  it('deployProd throws when no URL in output', async () => {
    mockVercel('something went sideways');
    const { deployProd } = await import('./vercel.js');
    await expect(deployProd()).rejects.toThrow(/parse/);
  });
});
```

- [ ] **Step 3: Run, verify pass**

- [ ] **Step 4: Commit**

```bash
git add alpha/src/site/vercel.ts alpha/src/site/vercel.test.ts
git commit -m "feat(alpha): vercel CLI wrapper with deploy + auth checks"
```

### Task 6.2: First-run init flow (Vercel link)

**Files:**
- Create: `alpha/src/flows/init.ts`

Init runs interactively; tests for it are manual at this stage (Vercel CLI is interactive and hard to mock end-to-end). We rely on unit tests for the primitives and validate `init` by hand.

- [ ] **Step 1: Implement `init.ts`**

```ts
import * as p from '@clack/prompts';
import { mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { writeConfig } from '../config.js';
import { paths } from '../paths.js';
import { checkLoggedIn, checkVercelInstalled } from '../site/vercel.js';

export async function runInit(): Promise<void> {
  p.intro('mirador init — first-time setup');

  const installed = await checkVercelInstalled();
  if (!installed.ok) {
    p.log.error('Vercel CLI not found on PATH.');
    p.log.info('Install with: npm i -g vercel  (or see https://vercel.com/cli)');
    p.outro('Re-run `mirador share` once vercel is installed.');
    process.exit(1);
  }

  const auth = await checkLoggedIn();
  if (!auth.ok) {
    p.log.warn('You are not logged in to Vercel.');
    p.log.info('Run: vercel login   then re-run `mirador share`.');
    p.outro('See you in a moment.');
    process.exit(1);
  }
  p.log.success(`Logged in as ${auth.user}`);

  const nameAnswer = await p.text({
    message: 'What should your Vercel project be called?',
    placeholder: 'mirador',
    initialValue: 'mirador',
    validate: (v) => (v && /^[a-z0-9-]+$/.test(v) ? undefined : 'lowercase letters, digits, dashes'),
  });
  if (p.isCancel(nameAnswer)) process.exit(0);
  const projectName = nameAnswer as string;

  const themeAnswer = await p.select({
    message: 'Default theme?',
    options: [
      { value: 'default', label: 'default — clean & neutral' },
      { value: 'memo', label: 'memo — document / report' },
      { value: 'deck', label: 'deck — presentation' },
      { value: 'none', label: 'none — publish verbatim' },
    ],
    initialValue: 'default',
  });
  if (p.isCancel(themeAnswer)) process.exit(0);
  const defaultTheme = themeAnswer as string;

  // Create the Vercel project by running `vercel link --yes --name <n>` in a temp dir.
  const stagingDir = mkdtempSync(join(tmpdir(), 'mirador-link-'));
  const r = spawnSync('vercel', ['link', '--yes', '--name', projectName], {
    cwd: stagingDir,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    p.outro(`vercel link failed (status ${r.status}).`);
    process.exit(1);
  }

  const linkRaw = await readFile(join(stagingDir, '.vercel', 'project.json'), 'utf8');
  const link = JSON.parse(linkRaw) as { projectId: string; orgId: string };

  await mkdir(paths.site, { recursive: true });
  await mkdir(paths.themes, { recursive: true });
  await writeConfig({
    vercel: {
      projectId: link.projectId,
      orgId: link.orgId,
      projectName,
      domain: `${projectName}.vercel.app`,
    },
    defaultTheme,
    docs: [],
  });

  // Place the .vercel/project.json next to the site so subsequent deploys are linked.
  await mkdir(join(paths.site, '.vercel'), { recursive: true });
  await writeConfig.bind(null); // (no-op; for clarity)

  p.outro(`Set up. Your URLs will live at https://${projectName}.vercel.app/`);
}
```

(Note: the `mkdir` near the end also needs to copy `project.json` into `paths.site/.vercel/`. We'll polish this in Phase 7 when wiring the full share flow. Mark with a `TODO: copy project.json into site dir` comment.)

- [ ] **Step 2: Manual smoke test**

Run: `node dist/index.js` and exercise via Task 7.1 once share is wired. We won't unit-test init.

- [ ] **Step 3: Commit**

```bash
git add alpha/src/flows/init.ts
git commit -m "feat(alpha): first-run init flow links a Vercel project"
```

---

## Phase 7: `share` end-to-end

Now we wire everything together. The share command:

1. Reads HTML.
2. Ensures config exists (else triggers init).
3. Resolves `name`, `theme`, `password`, `visibility` either from flags (non-interactive) or via prompts.
4. Calls `writeDocPage`, `buildSite`, `deployProd`.
5. Saves the doc to config.
6. Copies URL to clipboard and prints it.

### Task 7.1: Implement `runShare`

**Files:**
- Modify: `alpha/src/flows/share.ts`
- Create: `alpha/src/flows/prompts.ts` (the interactive variants)

- [ ] **Step 1: Implement `flows/prompts.ts`**

```ts
import * as p from '@clack/prompts';
import { listThemes } from '../theme/store.js';

export async function askName(suggested: string): Promise<string> {
  const v = await p.text({
    message: 'Slug for this doc?',
    initialValue: suggested,
    validate: (s) => (/^[a-z0-9-]+$/.test(s) ? undefined : 'lowercase letters, digits, dashes'),
  });
  if (p.isCancel(v)) process.exit(0);
  return v as string;
}

export async function askTheme(defaultTheme: string): Promise<string> {
  const themes = await listThemes();
  const v = await p.select({
    message: 'Theme?',
    initialValue: defaultTheme,
    options: [
      ...themes.map((t) => ({ value: t.name, label: `${t.name} — ${t.description}` })),
      { value: 'none', label: 'none — publish verbatim' },
    ],
  });
  if (p.isCancel(v)) process.exit(0);
  return v as string;
}

export async function askPassword(): Promise<string | undefined> {
  const wants = await p.confirm({ message: 'Protect with a password?', initialValue: false });
  if (p.isCancel(wants) || !wants) return undefined;
  const pw = await p.password({
    message: 'Password (client-side gate — disuasive, not auth):',
    validate: (s) => (s && s.length >= 4 ? undefined : 'at least 4 characters'),
  });
  if (p.isCancel(pw)) process.exit(0);
  return pw as string;
}

export async function askVisibility(): Promise<'unlisted' | 'public'> {
  const v = await p.select({
    message: 'Visibility?',
    initialValue: 'unlisted',
    options: [
      { value: 'unlisted', label: 'unlisted — link-only' },
      { value: 'public', label: 'public — listed on your Mirador index' },
    ],
  });
  if (p.isCancel(v)) process.exit(0);
  return v as 'unlisted' | 'public';
}
```

- [ ] **Step 2: Implement `flows/share.ts`**

```ts
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import clipboard from 'clipboardy';
import type { ShareOptions } from '../commands/share.js';
import { addDoc, readConfig } from '../config.js';
import { buildSite, writeDocPage } from '../site/build.js';
import { deployProd } from '../site/vercel.js';
import { runInit } from './init.js';
import { askName, askPassword, askTheme, askVisibility } from './prompts.js';

export async function runShare(file: string, opts: ShareOptions): Promise<void> {
  let config = await readConfig();
  if (!config) {
    if (opts.nonInteractive) throw new Error('Not initialized. Run `mirador share` from a terminal first.');
    await runInit();
    config = await readConfig();
    if (!config) throw new Error('init did not complete');
  }

  const html = await readFile(file, 'utf8');
  const suggested = slugify(opts.name ?? basename(file, extname(file)));

  const slug = opts.nonInteractive ? suggested : await askName(suggested);
  const theme = opts.theme ?? (opts.nonInteractive ? config.defaultTheme : await askTheme(config.defaultTheme));
  const password = opts.password ?? (opts.nonInteractive ? undefined : await askPassword());
  const visibility = opts.visibility ?? (opts.nonInteractive ? 'unlisted' : await askVisibility());

  await writeDocPage(slug, html, theme, password);
  await buildSite(config);

  const deployUrl = await deployProd();
  // Always prefer the project's stable domain for predictable doc URLs.
  const docUrl = `https://${config.vercel.domain}/d/${slug}/`;

  await addDoc({
    slug,
    title: extractTitle(html) ?? slug,
    theme,
    passwordProtected: !!password,
    visibility,
    url: docUrl,
    createdAt: new Date().toISOString(),
  });

  await clipboard.write(docUrl).catch(() => undefined);
  console.log(docUrl);
  console.log(`(deployed: ${deployUrl}; copied to clipboard)`);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'doc';
}

function extractTitle(html: string): string | null {
  return html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
}
```

- [ ] **Step 3: Build and smoke-test against a real Vercel account**

Run: `cd alpha && npm run build && node dist/index.js share path/to/some.html`
Expected: walks through init (first run), prompts for name/theme/password, deploys to Vercel, prints URL.

- [ ] **Step 4: Commit**

```bash
git add alpha/src/flows
git commit -m "feat(alpha): end-to-end share flow with prompts and deploy"
```

---

## Phase 8: Theme generation from reference

Three input modes: URL, image, description. Each calls Anthropic and writes a theme into `~/.mirador/themes/<name>/`.

### Task 8.1: Anthropic client wiring

**Files:**
- Create: `alpha/src/theme/generate.ts`
- Create: `alpha/src/theme/generate.test.ts`

- [ ] **Step 1: Define the contract**

The function signature:

```ts
type Source =
  | { type: 'url'; url: string }
  | { type: 'image'; bytes: Uint8Array; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' }
  | { type: 'description'; text: string };

export async function generateTheme(name: string, source: Source): Promise<ThemeMeta>;
```

The function:

1. Fetches additional context (for URL mode, downloads the HTML + linked CSS as plain text).
2. Calls Claude (Sonnet 4.6) with a structured prompt that includes the source and instructs the model to return a JSON object `{ css, head?, description }`.
3. Validates the JSON.
4. Writes `~/.mirador/themes/<name>/{meta.json, theme.css, head.html}`.
5. Returns the `ThemeMeta`.

- [ ] **Step 2: Implement `generate.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { paths } from '../paths.js';
import type { ThemeMeta } from './store.js';

export type Source =
  | { type: 'url'; url: string }
  | { type: 'image'; bytes: Uint8Array; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' }
  | { type: 'description'; text: string };

const SYSTEM_PROMPT = `
You are a designer producing a single self-contained CSS theme for HTML documents.

The user will share a reference (a web page, a screenshot, or a description).
You must return strict JSON with this shape:

{
  "description": "one-sentence summary",
  "css": "/* scoped under .mirador-content { ... }; do not use any other selectors */",
  "head": "<link>/<meta>/<style> tags to add inside <head>, or empty string"
}

Rules:
- Scope ALL rules under .mirador-content. Do not target html/body/* outside that scope.
- Cover at minimum: font-family, base size and line-height, color, h1/h2/h3, p, a, code, pre, table.
- Keep the CSS under 4KB. Do not include @import; if you need a webfont, put the <link> in head.
- Output JSON only. No prose.
`.trim();

export async function generateTheme(name: string, source: Source): Promise<ThemeMeta> {
  const client = new Anthropic();
  const userMessage = await buildUserMessage(source);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const parsed = parseJson(text);

  const meta: ThemeMeta = {
    name,
    description: parsed.description,
    generatedFrom: summarizeSource(source),
  };
  const dir = join(paths.themes, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'meta.json'), JSON.stringify({ ...meta, createdAt: new Date().toISOString() }, null, 2));
  await writeFile(join(dir, 'theme.css'), parsed.css);
  await writeFile(join(dir, 'head.html'), parsed.head ?? '');
  return meta;
}

async function buildUserMessage(source: Source): Promise<Anthropic.MessageParam['content']> {
  if (source.type === 'description') {
    return [{ type: 'text', text: `Reference (description):\n${source.text}` }];
  }
  if (source.type === 'image') {
    const data = Buffer.from(source.bytes).toString('base64');
    return [
      { type: 'image', source: { type: 'base64', media_type: source.mediaType, data } },
      { type: 'text', text: 'Reference is the image above. Produce a theme that visibly resembles it.' },
    ];
  }
  // url
  const fetched = await fetchSiteText(source.url);
  return [
    {
      type: 'text',
      text: `Reference URL: ${source.url}\n\n--- HTML (truncated to 50KB) ---\n${fetched.html}\n\n--- Linked CSS (concatenated, truncated to 50KB) ---\n${fetched.css}`,
    },
  ];
}

interface Fetched { html: string; css: string; }

async function fetchSiteText(url: string): Promise<Fetched> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const html = (await res.text()).slice(0, 50_000);
  const cssLinks = [...html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]+href=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((href): href is string => Boolean(href));
  let css = '';
  for (const href of cssLinks.slice(0, 5)) {
    try {
      const cssUrl = new URL(href, url).toString();
      const r = await fetch(cssUrl);
      if (r.ok) css += `\n/* ${cssUrl} */\n${(await r.text()).slice(0, 10_000)}`;
      if (css.length > 50_000) break;
    } catch {
      // best-effort
    }
  }
  return { html, css: css.slice(0, 50_000) };
}

function parseJson(text: string): { description: string; css: string; head?: string } {
  const trimmed = text.trim().replace(/^```(json)?/, '').replace(/```$/, '').trim();
  const obj = JSON.parse(trimmed);
  if (typeof obj.description !== 'string' || typeof obj.css !== 'string') {
    throw new Error('model returned invalid JSON shape');
  }
  return obj;
}

function summarizeSource(s: Source): ThemeMeta['generatedFrom'] {
  if (s.type === 'url') return { type: 'url', ref: s.url };
  if (s.type === 'image') return { type: 'image', ref: `image (${s.bytes.length}B, ${s.mediaType})` };
  return { type: 'description', ref: s.text.slice(0, 200) };
}
```

- [ ] **Step 3: Write a small offline test**

```ts
import { describe, expect, it, vi } from 'vitest';

describe('generateTheme', () => {
  it('rejects malformed model output', async () => {
    vi.mock('@anthropic-ai/sdk', () => {
      class FakeClient {
        messages = {
          create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] }),
        };
      }
      return { default: FakeClient };
    });
    const { generateTheme } = await import('./generate.js');
    await expect(generateTheme('x', { type: 'description', text: 'minimal' })).rejects.toThrow();
  });
});
```

(A richer test that asserts the file write happens uses a working mock plus `MIRADOR_HOME` — feel free to extend if time allows. Not blocking for alpha.)

- [ ] **Step 4: Commit**

```bash
git add alpha/src/theme/generate.ts alpha/src/theme/generate.test.ts
git commit -m "feat(alpha): generate themes from URL, image, or description"
```

### Task 8.2: Wire theme generation into the share flow

**Files:**
- Modify: `alpha/src/flows/prompts.ts`
- Modify: `alpha/src/flows/share.ts`

- [ ] **Step 1: Extend `askTheme` with the generate path**

Add an option `+ generate from reference…` to the select list. When chosen, branch to a sub-flow:

```ts
import { readFile } from 'node:fs/promises';
import { generateTheme, type Source } from '../theme/generate.js';

export async function askTheme(defaultTheme: string): Promise<string> {
  const themes = await listThemes();
  const v = await p.select({
    message: 'Theme?',
    initialValue: defaultTheme,
    options: [
      ...themes.map((t) => ({ value: t.name, label: `${t.name} — ${t.description}` })),
      { value: 'none', label: 'none — publish verbatim' },
      { value: '__generate__', label: '+ generate from a reference…' },
    ],
  });
  if (p.isCancel(v)) process.exit(0);
  if (v === '__generate__') return askGenerate();
  return v as string;
}

async function askGenerate(): Promise<string> {
  const mode = await p.select({
    message: 'Reference type?',
    options: [
      { value: 'url', label: 'paste a URL' },
      { value: 'image', label: 'point at a screenshot file (PNG/JPG)' },
      { value: 'description', label: 'describe it in words' },
    ],
  });
  if (p.isCancel(mode)) process.exit(0);

  const name = await p.text({
    message: 'Name this theme:',
    validate: (s) => (/^[a-z0-9-]+$/.test(s) ? undefined : 'lowercase letters, digits, dashes'),
  });
  if (p.isCancel(name)) process.exit(0);

  let source: Source;
  if (mode === 'url') {
    const url = await p.text({ message: 'URL?', validate: (s) => (/^https?:\/\//.test(s) ? undefined : 'must be http(s)://') });
    if (p.isCancel(url)) process.exit(0);
    source = { type: 'url', url: url as string };
  } else if (mode === 'image') {
    const path = await p.text({ message: 'Path to image:' });
    if (p.isCancel(path)) process.exit(0);
    const bytes = new Uint8Array(await readFile(path as string));
    const mediaType = (path as string).toLowerCase().endsWith('.png')
      ? 'image/png'
      : (path as string).toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    source = { type: 'image', bytes, mediaType };
  } else {
    const text = await p.text({ message: 'Describe the look you want:' });
    if (p.isCancel(text)) process.exit(0);
    source = { type: 'description', text: text as string };
  }

  const s = p.spinner();
  s.start('Generating theme…');
  await generateTheme(name as string, source);
  s.stop(`Theme "${name}" generated.`);
  return name as string;
}
```

- [ ] **Step 2: Build, manually test by sharing with a generated theme**

Run: `npm run build && node dist/index.js share some.html`
Expected: pick `+ generate from a reference…`, pick `description`, type "warm earth tones, serif headings", get a generated theme applied to the deploy.

- [ ] **Step 3: Commit**

```bash
git add alpha/src/flows/prompts.ts
git commit -m "feat(alpha): generate a theme from reference inside share flow"
```

---

## Phase 9: `list` command

### Task 9.1: List + actions

**Files:**
- Modify: `alpha/src/flows/list.ts`

- [ ] **Step 1: Implement `list.ts`**

```ts
import * as p from '@clack/prompts';
import clipboard from 'clipboardy';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readConfig, removeDoc, writeConfig } from '../config.js';
import { paths } from '../paths.js';
import { buildSite } from '../site/build.js';
import { deployProd } from '../site/vercel.js';

export async function runList(): Promise<void> {
  const config = await readConfig();
  if (!config || config.docs.length === 0) {
    console.log('No docs yet. Run `mirador share <file>` to publish one.');
    return;
  }

  const pick = await p.select({
    message: 'Your docs:',
    options: config.docs
      .slice()
      .reverse()
      .map((d) => ({ value: d.slug, label: `${d.title}  ${d.url}` })),
  });
  if (p.isCancel(pick)) return;
  const slug = pick as string;
  const doc = config.docs.find((d) => d.slug === slug);
  if (!doc) return;

  const action = await p.select({
    message: doc.title,
    options: [
      { value: 'copy', label: 'copy URL' },
      { value: 'open', label: 'open in browser' },
      { value: 'delete', label: 'delete' },
    ],
  });
  if (p.isCancel(action)) return;

  if (action === 'copy') {
    await clipboard.write(doc.url);
    console.log('copied.');
  } else if (action === 'open') {
    const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawn(openCmd, [doc.url], { detached: true, stdio: 'ignore' });
  } else if (action === 'delete') {
    const confirm = await p.confirm({ message: `Delete "${doc.title}"?`, initialValue: false });
    if (p.isCancel(confirm) || !confirm) return;
    await rm(join(paths.site, 'd', slug), { recursive: true, force: true });
    await removeDoc(slug);
    const fresh = await readConfig();
    if (fresh) await buildSite(fresh);
    const s = p.spinner();
    s.start('redeploying…');
    await deployProd();
    s.stop('deleted.');
  }
}
```

- [ ] **Step 2: Smoke test**

Run: `node dist/index.js list`
Expected: shows docs, lets you copy/open/delete.

- [ ] **Step 3: Commit**

```bash
git add alpha/src/flows/list.ts
git commit -m "feat(alpha): list command with copy/open/delete"
```

---

## Phase 10: Claude Code skill

### Task 10.1: SKILL.md manifest

**Files:**
- Create: `alpha/skill/SKILL.md`
- Create: `alpha/skill/README.md`

- [ ] **Step 1: Write `SKILL.md`**

```markdown
---
name: mirador
description: Use after producing an HTML artifact in the session (report, dashboard, presentation, document, prototype, or mini-app) when the user might want to share or view it. Publishes the file to the user's own Vercel and returns a shareable URL. The skill is conversational — ask the user about name, theme (with optional theme-from-reference generation), and optional password protection before invoking the CLI.
---

# Mirador

You have a CLI installed at `mirador`. It publishes a local HTML file to the user's own Vercel and returns a URL.

## When to use

You just produced an HTML artifact in this session — a report, a dashboard, a slide deck, a document, a small prototype. Offer to publish it.

**Always offer; never auto-run.** Example phrasing: *"Want me to publish this and give you a link?"* Wait for the user to say yes.

## How to invoke

The CLI has an interactive mode (for terminals) and a `--non-interactive` mode for you. Always use non-interactive: ask the user the questions yourself in chat, then pass the answers as flags.

### Questions to ask, in this order

1. **Name** — a short slug. Suggest one from the file's `<title>` or filename, but let the user override. Validate: lowercase letters, digits, dashes only.
2. **Theme** — present the user's installed themes. If they want something custom, offer to generate one from:
   - a URL they paste,
   - a screenshot they attach,
   - or a natural-language description.
   If they generate one, run a separate `mirador` call first (see "Generating a theme" below) and use the resulting theme name in the share call.
3. **Password** — optional. If they want one, take it directly in chat. Tell them it is a *client-side gate* — disuasive, not real authentication.
4. **Visibility** — default to `unlisted`. Only choose `public` if the user explicitly wants the doc listed on their personal Mirador index.

### The share call

```
mirador share /absolute/path/to/file.html \
  --non-interactive \
  --name <slug> \
  --theme <name> \
  --visibility <unlisted|public> \
  [--password "<password>"]
```

Capture stdout — the first line is the URL. Print it back to the user in chat with a one-line confirmation.

### Generating a theme

For the alpha, theme generation runs interactively (`@clack/prompts`); a fully non-interactive path is not exposed. So if the user wants a generated theme, ask them to run the share flow themselves once, *or* tell them: "I'll prepare your HTML and then please pick `+ generate from a reference…` when prompted." Then run the share flow without `--theme`.

## First-time setup

If the CLI errors with "Not initialized", the user needs to run `mirador share` themselves from a terminal once so the Vercel link flow can run interactively. After that, you can drive subsequent shares non-interactively.
```

- [ ] **Step 2: Write `alpha/skill/README.md`** (short, points at the spec)

- [ ] **Step 3: Commit**

```bash
git add alpha/skill
git commit -m "feat(alpha): Claude Code skill manifest"
```

### Task 10.2: `mirador skill install` (hidden command)

**Files:**
- Modify: `alpha/src/flows/skill.ts`

- [ ] **Step 1: Implement**

```ts
import { cp, mkdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = `${homedir()}/.claude/skills/mirador`;
const SRC = resolve(fileURLToPath(import.meta.url), '../../../skill');

export async function runSkill(action: string): Promise<void> {
  if (action === 'install') {
    await mkdir(SKILL_DIR, { recursive: true });
    await cp(SRC, SKILL_DIR, { recursive: true });
    console.log(`Installed Mirador skill to ${SKILL_DIR}`);
    return;
  }
  if (action === 'uninstall') {
    await rm(SKILL_DIR, { recursive: true, force: true });
    console.log(`Removed ${SKILL_DIR}`);
    return;
  }
  console.error(`unknown action: ${action}. use install | uninstall.`);
  process.exit(1);
}
```

- [ ] **Step 2: Manual test**

Run: `node dist/index.js skill install`
Expected: copies `alpha/skill/` to `~/.claude/skills/mirador/`.

- [ ] **Step 3: Commit**

```bash
git add alpha/src/flows/skill.ts
git commit -m "feat(alpha): mirador skill install (hidden command)"
```

---

## Phase 11: Installer + README + polish

### Task 11.1: `install.sh`

**Files:**
- Create: `alpha/install.sh`

- [ ] **Step 1: Write `install.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

need() {
  command -v "$1" >/dev/null 2>&1 || { echo >&2 "missing: $1"; exit 1; }
}

require_node20() {
  local v
  v="$(node -v 2>/dev/null || true)"
  [[ -z "$v" ]] && { echo "Node 20+ is required. Install from https://nodejs.org/"; exit 1; }
  local major="${v#v}"; major="${major%%.*}"
  if (( major < 20 )); then echo "Node 20+ required (you have $v)."; exit 1; fi
}

require_npm_global_writable() {
  local prefix
  prefix="$(npm config get prefix)"
  if [[ ! -w "$prefix" ]]; then
    cat >&2 <<EOF
npm global prefix is not user-writable: $prefix

Refusing to run with sudo silently. Either:
  - Use a user-level Node manager (nvm, volta, fnm), which keeps globals in your home dir, OR
  - Re-run this installer with sudo (you accept responsibility), OR
  - Reconfigure npm prefix to a user-writable path: https://docs.npmjs.com/resolving-eacces-permissions-errors
EOF
    exit 1
  fi
}

require_node20
need npm
require_npm_global_writable

echo "Installing @mirador/cli…"
npm i -g @mirador/cli
mirador skill install
echo
echo "Done. Quickstart:"
echo "  mirador share path/to/your.html"
```

- [ ] **Step 2: Mark executable**

Run: `chmod +x alpha/install.sh`

- [ ] **Step 3: Commit**

```bash
git add alpha/install.sh
git commit -m "feat(alpha): user-friendly install.sh that refuses silent sudo"
```

### Task 11.2: README

**Files:**
- Modify: `alpha/README.md`
- Modify: `README.md` (repo root) — add a small pointer to `alpha/` and the V1 spec

- [ ] **Step 1: Write `alpha/README.md`**

Cover: what Mirador alpha is (1 paragraph), install (3 lines), quickstart (the 5 steps), commands (just `share` and `list`), themes section, security note about the password gate, link to the spec. Keep under 200 lines.

- [ ] **Step 2: Add a tiny root `README.md`**

Two sections: "What's in this repo" (alpha/ + docs/) and "Status" (alpha in active development; V1 design lives in `docs/superpowers/specs/`).

- [ ] **Step 3: Commit**

```bash
git add alpha/README.md README.md
git commit -m "docs: alpha quickstart README + repo root README"
```

### Task 11.3: GIF demo (manual)

Out of scope of this plan: record a 20-second screen capture of share → URL → opened in browser. Save to `alpha/docs/demo.gif`. Mention in `alpha/README.md`.

### Task 11.4: Make repo public

Manual step. The CI workflow can come later; the alpha needs no automated tests in CI before going public, just a clean `npm test` locally.

---

## Phase 12: Pre-release verification

Before declaring the alpha shippable, walk through the success criteria from the spec:

- [ ] On a fresh macOS user account (or a fresh Docker container), `curl ... | sh` results in a working `mirador` in under 2 minutes.
- [ ] From inside Claude Code, after generating an HTML artifact, asking the agent to "publish this" produces a URL in under 60 seconds (excluding Vercel deploy time).
- [ ] Theme generation from a screenshot of 10 real-world reference sites; at least 8 produce visibly resembling output.
- [ ] Strong-password gate withstands 30 minutes of view-source-and-poke by the author.
- [ ] README quickstart works on macOS and Ubuntu.

If any item fails, return to the relevant Phase and fix; commit with a `fix(alpha): ...` message.

---

## Notes for the implementer

- DRY: shared theme structures (`Theme`, `ThemeMeta`) are exported from `theme/` and reused everywhere; don't re-declare them in flows.
- YAGNI: this plan deliberately omits multi-doc atomic re-deploys, content scanning, Vercel Pro detection, multi-page themes, theme editing UIs, comment threads — every one of those will tempt you. They live in the V1 spec, not here.
- Frequent commits: every step that ends with "commit" should be its own commit. Don't batch.
- Tests are co-located (`foo.ts` next to `foo.test.ts`) and run via `npm test`. Vitest auto-detects.
- Logs: `~/.mirador/logs/deploys.log` is mentioned in the spec — write a one-line entry per deploy from `flows/share.ts`. Not test-covered; trivial.
- Anthropic model is `claude-sonnet-4-6`. If a newer model is available at execution time, confirm with the user before swapping; cost/quality is the dial.
- We are *not* writing CI yet. Manual `npm test` + manual smoke tests gate each phase.

---

## Out of scope (will become the V1 plan, separately)

- Multi-player editing, comments, forks, versioned history, server-side AI edit endpoint
- Our own hosted runtime
- Accounts / SSO
- Custom domains
- Analytics
- Audit log
- Mobile / embed widgets

Those are covered by `docs/superpowers/specs/2026-05-12-mirador-design.md` and will get their own plan document.
