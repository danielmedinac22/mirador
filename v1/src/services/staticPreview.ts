import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists, readText, writeFileAtomic } from '../adapters/fs.js';
import * as document from './document/index.js';
import { renderShell } from './document/shell.js';

// Themes are document renderers now (design §7.3); the canonical theme list and
// `normaliseTheme` live in the document seam. Re-exported here so existing
// callers (services/share.ts) keep importing them from staticPreview.
export type { ThemeName } from './document/index.js';
export { normaliseTheme } from './document/index.js';

/** The markdown++ source of truth for an artifact. */
export const SOURCE_FILE = 'source.md';

/**
 * Renders the artifact's HTML view wrapped in its theme.
 *
 * Two paths:
 *   1. **markdown++** — if `source.md` exists, parse + `document.render` (the
 *      convergence-era default; co-refinable, diffable, mergeable).
 *   2. **raw-HTML escape hatch** — otherwise fall back to the publish-era path:
 *      find an HTML index and wrap it (broadcast-only; no diff/merge, design §7.4).
 *
 * The wrapper references shared chrome at `/themes/<theme>/theme.css`, installed
 * under the Vercel site root by services/siteChrome.ts before publish.
 */
export async function renderPreview(artifactPath: string, theme = 'page'): Promise<string> {
  const themeName = document.normaliseTheme(theme);

  const sourcePath = join(artifactPath, SOURCE_FILE);
  if (await pathExists(sourcePath)) {
    const model = document.parse(await readText(sourcePath));
    return document.render(model, themeName);
  }

  const indexHtml = await findIndexHtml(artifactPath);
  if (!indexHtml) return renderShell(noPreviewContent(themeName), themeName);
  const body = await readText(indexHtml);
  return renderShell(ensureWrapper(body, themeName), themeName);
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

function noPreviewContent(theme: document.ThemeName): string {
  const inner =
    '<div class="mirador-content"><h1>No preview</h1><p>This artifact has no markdown++ source or HTML index.</p></div>';
  return theme === 'none'
    ? '<h1>No preview</h1><p>This artifact has no markdown++ source or HTML index.</p>'
    : inner;
}

/**
 * If the raw body is a full HTML document, extract its <body> contents, then
 * ensure it's wrapped in `.mirador-content` so theme styles apply. `none`
 * publishes verbatim.
 */
function ensureWrapper(raw: string, theme: document.ThemeName): string {
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
