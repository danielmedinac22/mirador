import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists, readText, writeFileAtomic } from '../adapters/fs.js';

// Renders the artifact's HTML (if present) wrapped in a minimal themed shell.
// Falls back to a generic "no preview available" page when there's no html.
export async function renderPreview(artifactPath: string, theme = 'default'): Promise<string> {
  const indexHtml = await findIndexHtml(artifactPath);
  if (!indexHtml) return renderNoPreview(theme);
  const body = await readText(indexHtml);
  return wrapInTheme(body, theme);
}

async function findIndexHtml(dir: string): Promise<string | null> {
  const candidates = ['index.html', 'README.html', 'main.html'];
  for (const c of candidates) {
    const full = join(dir, c);
    if (await pathExists(full)) return full;
  }
  const entries = await readdir(dir).catch(() => []);
  for (const e of entries) {
    if (e.endsWith('.html')) return join(dir, e);
  }
  return null;
}

function renderNoPreview(theme: string): string {
  return wrapInTheme(
    '<div class="mirador-content"><p>No HTML preview available for this artifact.</p></div>',
    theme,
  );
}

function wrapInTheme(body: string, theme: string): string {
  // VS-04 placeholder: real theme application carries over from alpha later.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mirador preview</title>
<meta data-mirador-theme="${theme}">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #1a1a1a; }
.mirador-content { padding: 2rem 0; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
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
