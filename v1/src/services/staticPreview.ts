import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists, readText, writeFileAtomic } from '../adapters/fs.js';

export type ThemeName = 'page' | 'memo' | 'deck' | 'console' | 'atlas' | 'none';

const KNOWN_THEMES: readonly ThemeName[] = [
  'page',
  'memo',
  'deck',
  'console',
  'atlas',
  'none',
] as const;

const THEMES_WITH_SCRIPTS: Partial<Record<ThemeName, string[]>> = {
  deck: ['/themes/deck/deck.js'],
};

/**
 * Renders the artifact's HTML wrapped in its theme.
 *
 * Wrapper references shared chrome assets at `/style.css` and
 * `/themes/<theme>/theme.css` — installed under the Vercel site root by
 * services/siteChrome.ts before publish.
 *
 * Themes catalogued in docs/design/spec.md.
 */
export async function renderPreview(artifactPath: string, theme = 'page'): Promise<string> {
  const themeName = normaliseTheme(theme);
  const indexHtml = await findIndexHtml(artifactPath);
  if (!indexHtml) return renderNoPreview(themeName);
  const body = await readText(indexHtml);
  return wrapInTheme(body, themeName);
}

export function normaliseTheme(theme: string): ThemeName {
  const lower = (theme || '').toLowerCase().trim();
  if ((KNOWN_THEMES as readonly string[]).includes(lower)) return lower as ThemeName;
  // Legacy alpha names → V1 themes
  if (lower === 'default') return 'page';
  return 'page';
}

async function findIndexHtml(dir: string): Promise<string | null> {
  const candidates = ['index.html', 'README.html', 'main.html'];
  for (const c of candidates) {
    const full = join(dir, c);
    if (await pathExists(full)) return full;
  }
  const entries = await readdir(dir).catch(() => []);
  for (const e of entries) {
    if (typeof e === 'string' && e.endsWith('.html')) return join(dir, e);
  }
  return null;
}

function renderNoPreview(theme: ThemeName): string {
  const body =
    '<div class="mirador-content"><h1>No preview</h1><p>This artifact has no HTML index.</p></div>';
  return wrapInTheme(body, theme);
}

function wrapInTheme(bodyHtml: string, theme: ThemeName): string {
  const themeLink =
    theme === 'none' ? '' : `<link rel="stylesheet" href="/themes/${theme}/theme.css">`;

  const scripts = (THEMES_WITH_SCRIPTS[theme] ?? [])
    .map((src) => `<script src="${src}" defer></script>`)
    .join('\n');

  const wrapped = ensureWrapper(bodyHtml, theme);

  return `<!doctype html>
<html lang="en" data-mirador-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mirador · preview</title>
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: light)" href="/assets/aperture-favicon.svg">
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: dark)" href="/assets/aperture-favicon-dark.svg">
${themeLink}
${scripts}
</head>
<body>
${wrapped}
</body>
</html>
`;
}

/**
 * If the artifact body is a full HTML document, extract its <body> contents.
 * Then ensure the content is wrapped in `.mirador-content` so theme styles apply.
 * `none` skips wrapping (publish verbatim).
 */
function ensureWrapper(raw: string, theme: ThemeName): string {
  let inner = raw;
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) inner = bodyMatch[1] ?? raw;

  if (theme === 'none') return inner;

  if (/class\s*=\s*["'][^"']*\bmirador-content\b/.test(inner)) return inner;

  return `<div class="mirador-content">${inner}</div>`;
}

export async function publishPreview(
  workspaceVercelSiteDir: string,
  slug: string,
  html: string,
): Promise<{ localPath: string }> {
  const dir = join(workspaceVercelSiteDir, 'd', slug);
  const file = join(dir, 'index.html');
  await writeFileAtomic(file, html);
  return { localPath: file };
}
