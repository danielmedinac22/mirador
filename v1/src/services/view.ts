import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { MiradorError } from '../shared/errors.js';
import { type DocModel, type ThemeName, parse } from './document/index.js';
import { renderContent } from './document/markdown.js';
import { renderShell } from './document/shell.js';

// ── types ────────────────────────────────────────────────────────────────────

export interface ViewConfig {
  viewer: string;
  slug: string;
  writeToken: string;
  title?: string;
  theme?: ThemeName;
  docs?: string[];
}

export type SectionStatus = 'open' | 'contested' | 'locked';

export interface SectionState {
  anchor: string;
  title: string;
  status: SectionStatus;
  owner?: string;
}

export interface ArtifactState {
  docs: Record<string, { sections: SectionState[] }>;
}

export interface IntentNote {
  author: string;
  date: string;
  docs: string[];
  sections: string[];
  move?: string;
  body: string;
  file: string;
}

export interface ParsedDoc {
  file: string;
  model: DocModel;
}

export interface GitMeta {
  remoteUrl: string | null;
  branch: string | null;
  artifactPath: string | null;
}

const MIRADOR_DIR = '.mirador';

export function defaultViewerUrl(): string {
  return process.env.MIRADOR_VIEWER_URL ?? 'https://mirador-viewer-production-a126.up.railway.app';
}

// ── artifact folder reading ──────────────────────────────────────────────────

export async function discoverDocs(dir: string, preferred?: string[]): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const all = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  if (!preferred?.length) return all;
  const head = preferred.filter((f) => all.includes(f));
  const rest = all.filter((f) => !head.includes(f));
  return [...head, ...rest];
}

export async function parseDocs(dir: string, files: string[]): Promise<ParsedDoc[]> {
  const docs: ParsedDoc[] = [];
  for (const file of files) {
    const source = await readFile(join(dir, file), 'utf8');
    docs.push({ file, model: parse(source) });
  }
  return docs;
}

export async function readViewConfig(dir: string): Promise<ViewConfig | null> {
  const path = join(dir, MIRADOR_DIR, 'config.json');
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf8')) as ViewConfig;
}

export async function readVision(dir: string): Promise<{ owner: string | null; text: string }> {
  const path = join(dir, MIRADOR_DIR, 'vision.md');
  if (!existsSync(path)) return { owner: null, text: '' };
  const raw = await readFile(path, 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  let owner: string | null = null;
  let text = raw;
  if (fm?.[1] !== undefined) {
    try {
      const data = parseYaml(fm[1]) as { owner?: unknown } | null;
      if (data && typeof data.owner === 'string') owner = data.owner;
    } catch {
      // tolerate malformed frontmatter — the vision text still renders
    }
    text = raw.slice(fm[0].length);
  }
  return { owner, text: text.trim() };
}

export async function readState(dir: string): Promise<ArtifactState> {
  const path = join(dir, MIRADOR_DIR, 'state.yml');
  if (!existsSync(path)) return { docs: {} };
  try {
    const data = parseYaml(await readFile(path, 'utf8')) as ArtifactState | null;
    if (data && typeof data === 'object' && data.docs) return data;
  } catch {
    // tolerate a hand-edited broken state file — render without badges
  }
  return { docs: {} };
}

export async function readIntents(dir: string): Promise<IntentNote[]> {
  const intentsDir = join(dir, MIRADOR_DIR, 'intents');
  if (!existsSync(intentsDir)) return [];
  const entries = await readdir(intentsDir);
  const notes: IntentNote[] = [];
  for (const file of entries.filter((f) => f.endsWith('.md')).sort()) {
    const raw = await readFile(join(intentsDir, file), 'utf8');
    const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!fm?.[1]) continue;
    try {
      const data = parseYaml(fm[1]) as Record<string, unknown> | null;
      if (!data) continue;
      notes.push({
        author: typeof data.author === 'string' ? data.author : 'unknown',
        date: typeof data.date === 'string' ? data.date : String(data.date ?? ''),
        docs: Array.isArray(data.docs) ? data.docs.map(String) : [],
        sections: Array.isArray(data.sections) ? data.sections.map(String) : [],
        move: typeof data.move === 'string' ? data.move : undefined,
        body: raw.slice(fm[0].length).trim(),
        file,
      });
    } catch {
      // a malformed intent never blocks the view
    }
  }
  return notes.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function generateState(docs: ParsedDoc[]): ArtifactState {
  const state: ArtifactState = { docs: {} };
  for (const { file, model } of docs) {
    state.docs[file] = {
      sections: model.sections
        .filter((s) => s.depth >= 1 && s.depth <= 2)
        .map((s) => ({ anchor: s.anchor, title: s.headingText, status: 'open' as const })),
    };
  }
  return state;
}

export async function gitMeta(dir: string): Promise<GitMeta> {
  const run = async (args: string[]): Promise<string | null> => {
    try {
      const { stdout } = await execa('git', args, { cwd: dir });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  };
  const root = await run(['rev-parse', '--show-toplevel']);
  return {
    remoteUrl: await run(['config', '--get', 'remote.origin.url']),
    branch: await run(['rev-parse', '--abbrev-ref', 'HEAD']),
    artifactPath: root ? relative(root, dir) || '.' : null,
  };
}

// ── scaffolding (view init) ──────────────────────────────────────────────────

export async function scaffoldMiradorDir(
  dir: string,
  docs: ParsedDoc[],
  owner: string | null,
): Promise<void> {
  const miradorDir = join(dir, MIRADOR_DIR);
  await mkdir(join(miradorDir, 'intents'), { recursive: true });

  const statePath = join(miradorDir, 'state.yml');
  if (!existsSync(statePath)) {
    await writeFile(statePath, stringifyYaml(generateState(docs)), 'utf8');
  }

  const visionPath = join(miradorDir, 'vision.md');
  if (!existsSync(visionPath)) {
    const fm = owner ? `---\nowner: ${owner}\n---\n\n` : '';
    await writeFile(
      visionPath,
      `${fm}_No vision yet. The owner states where this artifact is going — one screen max._\n`,
      'utf8',
    );
  }

  const keepPath = join(miradorDir, 'intents', '.gitkeep');
  if (!existsSync(keepPath)) await writeFile(keepPath, '', 'utf8');
}

/**
 * Inline the theme stylesheet into the pushed page so the view never depends
 * on the viewer serving theme assets — only fonts and favicons stay external.
 */
export async function inlineThemeCss(html: string, theme: ThemeName): Promise<string> {
  if (theme === 'none') return html;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', 'site-assets', 'themes', theme, 'theme.css'),
    join(here, '..', '..', 'site-assets', 'themes', theme, 'theme.css'),
  ];
  const cssPath = candidates.find((c) => existsSync(c));
  if (!cssPath) return html;
  const css = (await readFile(cssPath, 'utf8')).replace(
    /@import url\(['"][./]*fonts\.css['"]\);?/,
    "@import url('/fonts.css');",
  );
  return html.replace(
    `<link rel="stylesheet" href="/themes/${theme}/theme.css">`,
    `<style>\n${css}\n</style>`,
  );
}

/** The packaged convention skill — resolved both from src (tests) and dist (bundle). */
export function conventionSkillPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', 'convention', 'SKILL.md'),
    join(here, '..', '..', 'convention', 'SKILL.md'),
  ];
  const found = candidates.find((c) => existsSync(c));
  if (!found) {
    throw new MiradorError(
      'CONVENTION_MISSING',
      'The packaged convention skill was not found.',
      'Reinstall mirador-cli — the convention/ directory ships with the package.',
    );
  }
  return found;
}

export async function installConventionSkill(repoRoot: string): Promise<string | null> {
  const dest = join(repoRoot, '.claude', 'skills', 'mirador', 'SKILL.md');
  if (existsSync(dest)) return null;
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, await readFile(conventionSkillPath(), 'utf8'), 'utf8');
  return dest;
}

// ── viewer client ────────────────────────────────────────────────────────────

export interface Registration {
  slug: string;
  writeToken: string;
  url: string;
}

export async function registerWithViewer(viewerUrl: string, title: string): Promise<Registration> {
  let res: Response;
  try {
    res = await fetch(`${viewerUrl.replace(/\/$/, '')}/api/artifacts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  } catch {
    throw new MiradorError(
      'VIEWER_UNREACHABLE',
      `Could not reach the viewer at ${viewerUrl}.`,
      'Check the URL (--viewer or MIRADOR_VIEWER_URL) and your connection.',
    );
  }
  if (res.status !== 201) {
    throw new MiradorError(
      'VIEWER_REGISTER_FAILED',
      `The viewer refused the registration (${res.status}).`,
      'Check the viewer URL — it must be a mirador viewer.',
    );
  }
  return (await res.json()) as Registration;
}

export async function pushToViewer(config: ViewConfig, html: string): Promise<string> {
  const base = config.viewer.replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/api/artifacts/${config.slug}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${config.writeToken}`,
        'content-type': 'text/html; charset=utf-8',
      },
      body: html,
    });
  } catch {
    throw new MiradorError(
      'VIEWER_UNREACHABLE',
      `Could not reach the viewer at ${config.viewer}.`,
      'Check your connection, then run `mirador view push` again.',
    );
  }
  if (res.status === 401) {
    throw new MiradorError(
      'VIEWER_BAD_TOKEN',
      'The viewer rejected the write token.',
      'The artifact may have been re-registered. Run `mirador view init` again.',
    );
  }
  if (res.status !== 204) {
    throw new MiradorError(
      'VIEWER_PUSH_FAILED',
      `The viewer refused the push (${res.status}).`,
      'Run `mirador view push` again; if it persists, re-run `mirador view init`.',
    );
  }
  return `${base}/v/${config.slug}`;
}
