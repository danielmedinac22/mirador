#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Build a sample Mirador "site" under /tmp/mirador-design-preview so we can
 * eyeball B2 (landing + 5 themes + gate + index) end-to-end in the browser.
 *
 * Run:  node v1/scripts/smoke-design.mjs
 * Open: file:///tmp/mirador-design-preview/index.html
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(here, '..', 'site-assets');
const SITE = '/tmp/mirador-design-preview';

const ensureDir = (p) => mkdir(p, { recursive: true });
const writeFileSafe = async (path, body) => {
  await ensureDir(dirname(path));
  await writeFile(path, body, 'utf8');
};

async function installChrome() {
  await rm(SITE, { recursive: true, force: true });
  await ensureDir(SITE);
  for (const f of ['tokens.css', 'reset.css', 'fonts.css', 'chrome.css', 'style.css']) {
    await cp(join(ASSETS, f), join(SITE, f), { force: true });
  }
  for (const dir of ['fonts', 'assets', 'themes']) {
    await cp(join(ASSETS, dir), join(SITE, dir), { recursive: true, force: true });
  }
}

const APERTURE_SVG = `<svg class="mark mark-anim" viewBox="0 0 24 24" aria-hidden="true">
  <rect class="outer" x="0.75" y="0.75" width="22.5" height="22.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect class="inner" x="14" y="4" width="6" height="6" fill="#2541B2"/>
</svg>`;

const LOCKUP = `<a href="/" class="lockup" aria-label="mirador">
  ${APERTURE_SVG}
  <span class="wordmark">m<span class="i-stem">i<span class="i-dot" aria-hidden="true">·</span></span>rador<span class="terminator">.</span></span>
</a>`;

const SHELL_HEAD = `<header class="shell-head">${LOCKUP}</header>`;
const SHELL_FOOT = `<footer class="shell-foot">What's this? <a href="https://mirador.dev">mirador.dev</a>.</footer>`;

/* ─── Landing ──────────────────────────────────────────────────────── */

function landingHtml(slug, theme) {
  const seed = `@mirador-invitation
slug: ${slug}
from: danielm <daniel.medina@simetrik.com>
role: reviewer
note: take a look before tomorrow's session
sent: 2026-05-25T10:30:00Z
repo: https://github.com/danielm/${slug}
preview: /d/${slug}/
landing: /i/${slug}/`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>danielm · ${slug}</title>
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: light)" href="/assets/aperture-favicon.svg">
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: dark)" href="/assets/aperture-favicon-dark.svg">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="shell">
${SHELL_HEAD}
<main class="shell-main">
<section class="hero">
  <p class="hero-eyebrow">invitation · review</p>
  <h1 class="hero-title">danielm sent you ${slug}.</h1>
  <p class="hero-sub">Open in Claude Code to read it with context.</p>

  <div class="hero-actions">
    <button type="button" class="cta-primary" id="cta" data-state="idle">Open in Claude Code</button>
    <a class="cta-secondary" href="/d/${slug}/">Or just read it.</a>
  </div>

  <p class="cta-hint">Copies a prompt to your clipboard. Paste it into <a href="https://claude.ai/code" target="_blank" rel="noopener">Claude Code</a> to start.</p>

  <div class="note" style="margin-top: var(--space-6);">
    <span class="note-label">note from sender</span>
    take a look before tomorrow's session
  </div>

  <section class="preview-frame-section">
    <div class="preview-frame-header">
      <span class="preview-label">preview · theme ${theme}</span>
      <a href="/d/${slug}/" target="_blank" rel="noopener">open in new tab ↗</a>
    </div>
    <iframe class="preview-frame" src="/d/${slug}/" loading="lazy" title="${slug} preview"></iframe>
  </section>

  <details class="seed-fallback">
    <summary>Use a different agent?</summary>
    <p class="seed-explainer">Copy this seed and paste it into Codex, Cursor, or any LLM that understands <code>@mirador-invitation</code> prompts.</p>
    <pre class="seed" id="seed" aria-label="prompt seed"><span class="seed-label">seed</span>${seed}</pre>
  </details>
</section>
</main>
${SHELL_FOOT}
</div>
<script>
(function () {
  const cta = document.getElementById('cta');
  const seed = document.getElementById('seed');
  const mark = document.querySelector('.mark-anim');
  const text = seed ? seed.textContent.replace(/^seed/, '').trim() : '';
  const orig = cta.textContent;
  let timer = null;
  cta.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); } catch (e) {}
    cta.dataset.state = 'copied';
    cta.textContent = 'Copied. Paste it in.';
    if (seed) {
      seed.dataset.state = 'highlighted';
      setTimeout(() => { seed.dataset.state = 'idle'; }, 240);
    }
    if (mark) {
      mark.classList.remove('mark-pulsed');
      void mark.offsetWidth;
      mark.classList.add('mark-pulsed');
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { cta.dataset.state = 'idle'; cta.textContent = orig; }, 4500);
  });
})();
</script>
</body>
</html>`;
}

/* ─── Gate ─────────────────────────────────────────────────────────── */

function gateHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Locked · mirador</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="gate">
<form class="gate-card stack" id="gate-form" autocomplete="off">
${APERTURE_SVG.replace('class="mark mark-anim"', 'class="gate-mark mark-anim"')}
<h1 class="gate-title">Locked.</h1>
<input id="gate-input" class="gate-input" type="password" placeholder="Password" autofocus required>
<button type="submit" class="cta-primary gate-submit">Unlock</button>
<div class="gate-error" id="gate-error" role="alert"></div>
<p class="gate-foot">Client-side gate. Deters viewers, not attackers.</p>
</form>
</div>
<script>
document.getElementById('gate-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = document.getElementById('gate-error');
  const mark = document.querySelector('.mark-anim');
  err.textContent = 'Wrong password.';
  if (mark) { mark.classList.remove('mark-pulsed'); void mark.offsetWidth; mark.classList.add('mark-pulsed'); }
});
</script>
</body>
</html>`;
}

/* ─── Site index ───────────────────────────────────────────────────── */

function indexHtml(entries) {
  const list = entries
    .map(
      ({ slug, theme }) =>
        `<li><a class="slug" href="/d/${slug}/">${slug}</a><span class="meta">${theme} · 2026-05-25</span></li>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>danielm · mirador</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="shell">
${SHELL_HEAD}
<main class="shell-main">
<div class="index-page">
<h1>danielm</h1>
<p class="index-sub">Shared via mirador.</p>
<ul class="index-list">${list}</ul>
</div>
</main>
${SHELL_FOOT}
</div>
</body>
</html>`;
}

/* ─── Artifact bodies per theme (realistic sample content) ─────────── */

const ARTIFACT_BODIES = {
  page: `<h1>Q2 product review</h1>
<p>This is the safe canvas — Plex Sans, 680px column, the default theme that does not apologize. It should read cleanly for any general-purpose AI-generated content.</p>
<h2>What we shipped</h2>
<p>The team closed the design polish track of Mirador V1. Five themes, a self-hosted type system, a custom mark, and a wow moment that lands in under two seconds.</p>
<h3>Risks</h3>
<ul>
<li>Pricing pressure from incumbent collaboration tools.</li>
<li>Onboarding friction for receivers who are not Claude Code natives.</li>
<li>Theme drift if we ship a sixth without re-establishing the system.</li>
</ul>
<h2>The math</h2>
<p>Three KPIs moved this quarter — none decisively. Worth keeping at it.</p>
<table>
<thead><tr><th>Metric</th><th>Q1</th><th>Q2</th><th>Δ</th></tr></thead>
<tbody>
<tr><td>Active workspaces</td><td>1,240</td><td>1,890</td><td>+52%</td></tr>
<tr><td>Shares per week</td><td>3.1</td><td>5.4</td><td>+74%</td></tr>
<tr><td>Receivers opening Claude Code</td><td>61%</td><td>68%</td><td>+7pt</td></tr>
</tbody>
</table>
<blockquote>The link is the product. Everything else exists to make the link exist.</blockquote>
<p>Sample code:</p>
<pre><code>mirador share q2-review --with daniel@simetrik.com --role reviewer</code></pre>`,

  memo: `<h1>A note from danielm</h1>
<p>Mirador began as a way to publish AI-generated HTML in under a minute. It has, in the months since, become the way I think about the lifecycle of a piece of agent-produced work. Not the act of creating it — that is the agent's domain. But the act of <em>placing it</em>: deciding where it lives, who sees it, and how the receiver should approach it before they read.</p>
<p>The memo theme exists for the case where the artifact wants to be read slowly. Newsreader, with its old-style figures and the small architectural details its designer carried over from book typography, signals to the reader that this is not a dashboard or a deck — this is something the author meant for you to sit with.</p>
<h2>The detail of the drop cap</h2>
<p>I argued for a while about whether to ship the drop cap at all. It is an editorial conceit, and Mirador is, ultimately, a dev tool. But the receiver does not see Mirador as a dev tool — the receiver sees a memo. The drop cap tells them, before they read a word, that someone cared.</p>
<blockquote>Care is contagious. It is also detectable. A reader can feel it inside a second.</blockquote>
<p>If we get the small details right — the punctuation marks (⁂) that replace the horizontal rule, the signature block at the end, the warm sepia that softens long reading sessions — then the receiver does not have to ask what kind of thing they are reading. They already know.</p>
<footer class="signature">danielm · 2026-05-25 · q2-letter</footer>`,

  deck: `<section>
<h1>mirador.</h1>
<h3>The link is the product.</h3>
</section>
<section>
<h2>What it is</h2>
<p>A CLI + Claude Code skill that turns any AI-generated HTML into a shareable link in under a minute.</p>
</section>
<section>
<h2>What it is not</h2>
<ul>
<li>A SaaS.</li>
<li>A document format.</li>
<li>An attempt to replace Notion.</li>
</ul>
</section>
<section>
<h2>The wedge</h2>
<p>Your agent already makes HTML.</p>
<p>Nobody knows what to do with it.</p>
<p>We make the link.</p>
</section>
<section>
<h2>Numbers</h2>
<p>1,890 active workspaces.</p>
<p>5.4 shares per week, per active user.</p>
<p>68% of receivers open Claude Code.</p>
</section>
<section>
<h2>What's next</h2>
<p>V2: the multiplayer surface.</p>
</section>`,

  console: `<h1>setup.sh</h1>
<p>Notes from the post-mortem of the V1 launch shell script. Captures what worked, what broke, and what we'd do differently.</p>

<h2>Pre-checks</h2>
<pre data-lines><code><span>#!/usr/bin/env bash</span><span>set -euo pipefail</span><span></span><span>command -v gh   &gt;/dev/null || { echo "gh not found"; exit 1; }</span><span>command -v vercel &gt;/dev/null || { echo "vercel not found"; exit 1; }</span><span>gh auth status &gt;/dev/null 2&gt;&amp;1 || gh auth login</span><span>vercel whoami  &gt;/dev/null 2&gt;&amp;1 || vercel login</span></code></pre>

<h2>The bug we shipped</h2>
<p>The release branch had a path-resolution bug that only surfaced when <code>$HOME</code> contained a space. Caught one hour after merge by a contributor on macOS Sequoia.</p>
<pre data-lines><code><span>const root = path.resolve(os.homedir(), '.mirador');</span><span>// ↑ was: const root = os.homedir() + '/.mirador';</span></code></pre>

<h3>Lessons</h3>
<ul>
<li>Never concatenate paths with <code>+</code>.</li>
<li>Add a CI matrix entry for paths with spaces.</li>
<li>The error should have surfaced in dev — we masked it with a try/catch in the wizard.</li>
</ul>

<blockquote>If a try/catch swallows a real failure, the try/catch is wrong. Not the failure.</blockquote>`,

  atlas: `<h1>V1 launch — week one</h1>
<p>Live numbers from the first seven days. Refreshed nightly. Last update: 2026-05-25 03:00 UTC.</p>

<h2>Top-line</h2>
<div class="kpi-grid">
<div class="kpi">
  <div class="kpi-label">workspaces created</div>
  <div class="kpi-value">1,890</div>
  <div class="kpi-delta up">+52% wow</div>
</div>
<div class="kpi">
  <div class="kpi-label">shares per active user</div>
  <div class="kpi-value">5.4</div>
  <div class="kpi-delta up">+74% wow</div>
</div>
<div class="kpi">
  <div class="kpi-label">activation rate</div>
  <div class="kpi-value">68%</div>
  <div class="kpi-delta up">+7 pt</div>
</div>
<div class="kpi">
  <div class="kpi-label">p50 publish latency</div>
  <div class="kpi-value">22.4s</div>
  <div class="kpi-delta down">-3.1s</div>
</div>
</div>

<h2>By cohort</h2>
<table>
<thead>
<tr><th>cohort</th><th class="num">users</th><th class="num">shares</th><th class="num">accept rate</th><th>top theme</th></tr>
</thead>
<tbody>
<tr><td>simetrik internal</td><td class="num">142</td><td class="num">821</td><td class="num">82%</td><td>atlas</td></tr>
<tr><td>indie devs</td><td class="num">1,012</td><td class="num">3,402</td><td class="num">61%</td><td>page</td></tr>
<tr><td>solo founders</td><td class="num">456</td><td class="num">2,114</td><td class="num">73%</td><td>memo</td></tr>
<tr><td>agencies</td><td class="num">280</td><td class="num">1,901</td><td class="num">68%</td><td>deck</td></tr>
</tbody>
</table>

<h3>Status</h3>
<p>
<span class="pill up">on track</span>
<span class="pill">monitoring</span>
<span class="pill down">at risk</span>
</p>`,
};

/* ─── Preview wrapper per theme ────────────────────────────────────── */

function previewHtml(slug, theme) {
  const themeLink = `<link rel="stylesheet" href="/themes/${theme}/theme.css">`;
  const script = theme === 'deck' ? `<script src="/themes/deck/deck.js" defer></script>` : '';
  const body = ARTIFACT_BODIES[theme] ?? ARTIFACT_BODIES.page;
  return `<!doctype html>
<html lang="en" data-mirador-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mirador · ${slug}</title>
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: light)" href="/assets/aperture-favicon.svg">
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: dark)" href="/assets/aperture-favicon-dark.svg">
${themeLink}
${script}
</head>
<body>
<div class="mirador-content">
${body}
</div>
</body>
</html>`;
}

/* ─── Main ─────────────────────────────────────────────────────────── */

const SAMPLES = [
  { slug: 'q2-review', theme: 'page' },
  { slug: 'q2-letter', theme: 'memo' },
  { slug: 'pitch-v1', theme: 'deck' },
  { slug: 'postmortem', theme: 'console' },
  { slug: 'launch-week', theme: 'atlas' },
];

await installChrome();

for (const { slug, theme } of SAMPLES) {
  await writeFileSafe(join(SITE, 'i', slug, 'index.html'), landingHtml(slug, theme));
  await writeFileSafe(join(SITE, 'd', slug, 'index.html'), previewHtml(slug, theme));
}

await writeFileSafe(join(SITE, 'g', 'locked', 'index.html'), gateHtml());
await writeFileSafe(join(SITE, 'index.html'), indexHtml(SAMPLES));

console.log(`Built sample site at: ${SITE}`);
console.log('');
console.log('Open these to review:');
console.log(`  Index       file://${SITE}/index.html`);
for (const { slug } of SAMPLES) {
  console.log(`  Landing     file://${SITE}/i/${slug}/index.html`);
}
console.log(`  Gate        file://${SITE}/g/locked/index.html`);
console.log('');
for (const { slug, theme } of SAMPLES) {
  console.log(`  Preview ${theme.padEnd(8)} file://${SITE}/d/${slug}/index.html`);
}
