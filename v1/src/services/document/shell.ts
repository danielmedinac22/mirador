import type { ThemeName } from './types.js';

/**
 * The HTML view shell — the `<!doctype>` wrapper around already-`.mirador-content`
 * wrapped body HTML. Mirrors the publish-era wrapper so the themed look is
 * unchanged; both the markdown++ renderer and the raw-HTML escape hatch
 * (services/staticPreview.ts) build the view through here.
 *
 * The shell links only `/themes/<theme>/theme.css` (which `@import`s fonts.css),
 * exactly as before. Rich-block primitives (`callout`/`chart`) ship as a small
 * inline style here, because the artifact view never loads tokens.css.
 */

export const THEMES_WITH_SCRIPTS: Partial<Record<ThemeName, string[]>> = {
  deck: ['/themes/deck/deck.js'],
};

/** Minimal, theme-var-aware primitives for fenced callout/chart blocks. */
const BLOCK_PRIMITIVES = `<style>
.mirador-content .callout{border-left:3px solid var(--page-accent,#2541B2);background:rgba(37,65,178,.05);padding:.75rem 1rem;margin:1.5rem 0;border-radius:0 6px 6px 0}
.mirador-content .callout-warn{border-left-color:#b45309;background:rgba(180,83,9,.07)}
.mirador-content .callout-quote{font-style:italic}
.mirador-content .callout>:first-child{margin-top:0}
.mirador-content .callout>:last-child{margin-bottom:0}
.mirador-content .chart{display:flex;flex-direction:column;gap:.45rem;margin:1.5rem 0}
.mirador-content .chart-row{display:grid;grid-template-columns:minmax(5rem,9rem) 1fr auto;align-items:center;gap:.75rem;font-size:.9rem}
.mirador-content .chart-label{color:var(--page-fg-muted,#666);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mirador-content .chart-track{background:rgba(37,65,178,.1);border-radius:4px;overflow:hidden}
.mirador-content .chart-bar{display:block;height:1.2rem;background:var(--page-accent,#2541B2);width:var(--v,0%);min-width:2px;border-radius:4px}
.mirador-content .chart-val{font-variant-numeric:tabular-nums;color:var(--page-fg-muted,#666);font-size:.85rem}
</style>`;

export function renderShell(bodyHtml: string, theme: ThemeName): string {
  const themeLink =
    theme === 'none' ? '' : `<link rel="stylesheet" href="/themes/${theme}/theme.css">`;

  const scripts = (THEMES_WITH_SCRIPTS[theme] ?? [])
    .map((src) => `<script src="${src}" defer></script>`)
    .join('\n');

  return `<!doctype html>
<html lang="en" data-mirador-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mirador · preview</title>
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: light)" href="/assets/aperture-favicon.svg">
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: dark)" href="/assets/aperture-favicon-dark.svg">
${themeLink}
${BLOCK_PRIMITIVES}
${scripts}
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}
