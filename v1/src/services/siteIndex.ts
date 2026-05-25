import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists, writeFileAtomic } from '../adapters/fs.js';

export interface SiteIndexEntry {
  slug: string;
  theme?: string;
  publishedAt?: string;
}

/**
 * Renders the Vercel project root — a minimal list of artifacts the user
 * has shared. Chrome-system styled. Voice spec compliant.
 */
export function renderSiteIndex(entries: SiteIndexEntry[], owner: string): string {
  const sorted = [...entries].sort((a, b) =>
    (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
  );

  const listHtml =
    sorted.length === 0
      ? `<p class="index-empty">Nothing here yet.</p>`
      : `<ul class="index-list">${sorted
          .map(
            (e) =>
              `<li><a class="slug" href="/d/${escapeAttr(e.slug)}/">${escapeHtml(e.slug)}</a><span class="meta">${escapeHtml(e.theme ?? 'page')}${e.publishedAt ? ` · ${escapeHtml(e.publishedAt.slice(0, 10))}` : ''}</span></li>`,
          )
          .join('')}</ul>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(owner)} · mirador</title>
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: light)" href="/assets/aperture-favicon.svg">
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: dark)" href="/assets/aperture-favicon-dark.svg">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="shell">
  <header class="shell-head">
    <a href="/" class="lockup" aria-label="mirador">
      <svg class="mark mark-anim" viewBox="0 0 24 24" aria-hidden="true">
        <rect class="outer" x="0.75" y="0.75" width="22.5" height="22.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <rect class="inner" x="14" y="4" width="6" height="6" style="fill: var(--mirador-cobalt, #2541B2);"/>
      </svg>
      <span class="wordmark">m<span class="i-stem">i<span class="i-dot" aria-hidden="true">·</span></span>rador<span class="terminator">.</span></span>
    </a>
  </header>

  <main class="shell-main">
    <div class="index-page">
      <h1>${escapeHtml(owner)}</h1>
      <p class="index-sub">Shared via mirador.</p>
      ${listHtml}
    </div>
  </main>

  <footer class="shell-foot">
    <a href="https://mirador.dev">mirador.dev</a>
  </footer>
</div>
</body>
</html>
`;
}

export async function publishSiteIndex(
  siteRoot: string,
  owner: string,
  entries: SiteIndexEntry[],
): Promise<{ localPath: string }> {
  const html = renderSiteIndex(entries, owner);
  const file = join(siteRoot, 'index.html');
  await writeFileAtomic(file, html);
  return { localPath: file };
}

/**
 * Discovers artifact slugs already published at <siteRoot>/d/<slug>/. Used to
 * keep the site index in sync without a persistent registry.
 */
export async function discoverPublishedSlugs(siteRoot: string): Promise<SiteIndexEntry[]> {
  const dRoot = join(siteRoot, 'd');
  if (!(await pathExists(dRoot))) return [];
  const entries = await readdir(dRoot, { withFileTypes: true }).catch(() => []);
  const out: SiteIndexEntry[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    out.push({ slug: e.name });
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
