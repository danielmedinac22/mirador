import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists, writeFileAtomic } from '../adapters/fs.js';
import type { ShareEntry } from './shareRegistry.js';

export interface PublishSiteIndexOpts {
  /** Production base URL (e.g. "https://mirador-danielmedinac22.vercel.app"). */
  baseUrl: string;
}

/**
 * Renders the Vercel project root — a dashboard of every artifact the user has
 * published, sourced from `.shares.json` (the share registry). Each row carries
 * the slug, the publish date, the theme/role/recipients, and three action
 * affordances: open preview, open landing, copy invitation link.
 *
 * Legacy slugs (directories under /d/ with no registry entry — pre-dashboard
 * shares) render with "—" for the date so the user can see them and decide
 * whether to re-share to bring them into the registry.
 */
export function renderSiteIndex(
  entries: ShareEntry[],
  owner: string,
  opts: PublishSiteIndexOpts,
  legacySlugs: readonly string[] = [],
): string {
  const merged = mergeForRender(entries, legacySlugs);
  const total = merged.length;
  const registered = merged.filter((m) => !m.legacy);
  const legacy = merged.filter((m) => m.legacy);

  const listHtml =
    total === 0
      ? `<p class="dashboard-empty">Nothing here yet. Run <code>mirador share &lt;slug&gt;</code> to publish.</p>`
      : [
          registered.length > 0
            ? `<ul class="dashboard">${registered.map((e) => renderRow(e, opts.baseUrl)).join('')}</ul>`
            : '',
          legacy.length > 0
            ? `<h2 class="dashboard-section-head">unregistered — re-share to track</h2>
               <ul class="dashboard">${legacy.map((e) => renderRow(e, opts.baseUrl)).join('')}</ul>`
            : '',
        ]
          .filter(Boolean)
          .join('');

  const sub = renderSubtitle(registered.length, legacy.length);

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
      <p class="index-sub">${escapeHtml(sub)}</p>
      ${listHtml}
    </div>
  </main>

  <footer class="shell-foot">
    <a href="https://github.com/danielmedinac22/mirador" target="_blank" rel="noopener">github.com/danielmedinac22/mirador</a>
  </footer>
</div>

<script>
(function () {
  document.querySelectorAll('.copy-action').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.url;
      if (!url) return;
      try { await navigator.clipboard.writeText(url); } catch (e) {}
      const original = btn.dataset.label || btn.textContent;
      btn.dataset.label = original;
      btn.dataset.state = 'copied';
      btn.textContent = 'Copied.';
      setTimeout(() => {
        btn.dataset.state = '';
        btn.textContent = original;
      }, 2000);
    });
  });
})();
</script>
</body>
</html>
`;
}

interface RenderEntry {
  slug: string;
  kind: 'share' | 'request';
  publishedAt: string;
  theme?: string;
  role?: string;
  sharedWith?: string[];
  to?: string;
  by?: string;
  legacy: boolean;
}

function mergeForRender(
  registry: readonly ShareEntry[],
  legacySlugs: readonly string[],
): RenderEntry[] {
  const known = new Set(registry.map((s) => s.slug));
  const fromRegistry: RenderEntry[] = registry.map((s) => ({
    slug: s.slug,
    kind: s.kind,
    publishedAt: s.publishedAt,
    theme: s.theme,
    role: s.role,
    sharedWith: s.sharedWith,
    to: s.to,
    by: s.by,
    legacy: false,
  }));
  const legacy: RenderEntry[] = legacySlugs
    .filter((slug) => !known.has(slug))
    .map((slug) => ({ slug, kind: 'share' as const, publishedAt: '', legacy: true }));
  // Registry entries are already publishedAt DESC; legacy items go to the bottom
  // (no date to sort on).
  return [...fromRegistry, ...legacy.sort((a, b) => a.slug.localeCompare(b.slug))];
}

function renderRow(e: RenderEntry, baseUrl: string): string {
  const landingPath = e.kind === 'share' ? `/i/${escapeAttr(e.slug)}/` : `/r/${escapeAttr(e.slug)}/`;
  const previewPath = `/d/${escapeAttr(e.slug)}/`;
  const landingUrl = `${baseUrl}${landingPath}`;

  const date = e.publishedAt ? formatDate(e.publishedAt) : '—';

  return `
<li class="dashboard-item${e.legacy ? ' is-legacy' : ''}">
  <div class="dashboard-row">
    <a class="slug" href="${escapeAttr(previewPath)}">${escapeHtml(e.slug)}</a>
    <span class="date">${escapeHtml(date)}</span>
  </div>
  <div class="dashboard-meta">
    ${renderKindPill(e)}
    ${renderRecipients(e)}
  </div>
  <div class="dashboard-actions">
    ${e.kind === 'share' ? `<a href="${escapeAttr(previewPath)}">open preview</a>` : ''}
    <a href="${escapeAttr(landingPath)}">open ${e.kind === 'request' ? 'request' : 'landing'}</a>
    ${e.legacy ? '' : `<button type="button" class="copy-action primary" data-url="${escapeAttr(landingUrl)}">copy ${e.kind === 'request' ? 'request' : 'invitation'} link</button>`}
  </div>
</li>`;
}

function renderSubtitle(registered: number, legacy: number): string {
  if (registered === 0 && legacy === 0) return 'Shared via mirador.';
  const parts: string[] = [];
  if (registered > 0) parts.push(`${registered} published`);
  if (legacy > 0) parts.push(`${legacy} unregistered`);
  return `${parts.join(' · ')} via mirador.`;
}

function renderKindPill(e: RenderEntry): string {
  if (e.kind === 'request') {
    return `<span class="kind-pill request">request</span>`;
  }
  if (e.theme) {
    return `<span class="kind-pill">${escapeHtml(e.theme)}</span>`;
  }
  return `<span class="kind-pill">share</span>`;
}

function renderRecipients(e: RenderEntry): string {
  if (e.kind === 'request') {
    const to = e.to ? `to ${escapeHtml(e.to)}` : '';
    const by = e.by ? ` · by ${escapeHtml(e.by)}` : '';
    return `<span class="recipients">${to}${by}</span>`;
  }
  const list = e.sharedWith ?? [];
  if (list.length === 0) return '';
  if (list.length === 1) return `<span class="recipients">shared with ${escapeHtml(list[0] ?? '')}</span>`;
  return `<span class="recipients">shared with ${list.length} people</span>`;
}

function formatDate(iso: string): string {
  // iso like "2026-05-25T17:19:06.228Z" → "2026-05-25"
  return iso.slice(0, 10);
}

export async function publishSiteIndex(
  siteRoot: string,
  owner: string,
  entries: ShareEntry[],
  opts: PublishSiteIndexOpts,
): Promise<{ localPath: string }> {
  const legacySlugs = await discoverPublishedSlugs(siteRoot);
  const html = renderSiteIndex(entries, owner, opts, legacySlugs);
  const file = join(siteRoot, 'index.html');
  await writeFileAtomic(file, html);
  return { localPath: file };
}

/**
 * Discovers artifact slugs already published at <siteRoot>/d/<slug>/. Used to
 * surface pre-dashboard artifacts in the index until they're re-shared.
 */
export async function discoverPublishedSlugs(siteRoot: string): Promise<string[]> {
  const dRoot = join(siteRoot, 'd');
  if (!(await pathExists(dRoot))) return [];
  const entries = await readdir(dRoot, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    out.push(ent.name);
  }
  return out.sort();
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
