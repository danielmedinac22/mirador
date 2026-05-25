import { join } from 'node:path';
import { writeFileAtomic } from '../adapters/fs.js';

export interface LandingInput {
  kind: 'invitation' | 'request';
  slug: string;
  from: string;
  role?: string;
  note?: string;
  context?: string;
  seedText: string;
  previewUrl?: string;
}

/**
 * Renders the invitation/request landing page.
 *
 * Uses shared chrome at `/style.css`. The themed preview iframe at
 * `/d/<slug>/` loads below the fold as part of the wow-moment choreography.
 *
 * Voice + visuals locked in docs/design/spec.md and docs/design/voice.md.
 */
export function renderLanding(input: LandingInput): string {
  const { hero, sub, eyebrow, primaryCta } = composeCopy(input);
  const noteOrContext = input.note ?? input.context ?? '';
  const noteLabel = input.kind === 'invitation' ? 'note from sender' : 'context';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.from)} · ${escapeHtml(input.slug)}</title>
<meta name="description" content="${escapeHtml(`${input.from} sent you ${input.slug} via mirador.`)}">
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
    <section class="hero">
      <p class="hero-eyebrow">${escapeHtml(eyebrow)}</p>
      <h1 class="hero-title">${escapeHtml(hero)}</h1>
      <p class="hero-sub">${escapeHtml(sub)}</p>

      <div class="hero-actions">
        <button type="button" class="cta-primary" id="cta" data-state="idle">${escapeHtml(primaryCta)}</button>
        ${input.previewUrl ? `<a class="cta-secondary" href="${escapeHtml(input.previewUrl)}">Or just read it.</a>` : ''}
      </div>

      <p class="cta-hint">Copies a prompt to your clipboard. Paste it into <a href="https://claude.ai/code" target="_blank" rel="noopener">Claude Code</a> to start.</p>

      ${noteOrContext ? `
      <div class="note" style="margin-top: var(--space-6);">
        <span class="note-label">${escapeHtml(noteLabel)}</span>
        ${escapeHtml(noteOrContext)}
      </div>` : ''}

      ${input.previewUrl ? `
      <section class="preview-frame-section">
        <div class="preview-frame-header">
          <span class="preview-label">preview</span>
          <a href="${escapeHtml(input.previewUrl)}" target="_blank" rel="noopener">open in new tab ↗</a>
        </div>
        <iframe class="preview-frame" src="${escapeHtml(input.previewUrl)}" loading="lazy" referrerpolicy="no-referrer" title="${escapeHtml(input.slug)} preview"></iframe>
      </section>` : ''}

      <details class="seed-fallback">
        <summary>Use a different agent?</summary>
        <p class="seed-explainer">Copy this seed and paste it into Codex, Cursor, or any LLM that understands <code>@mirador-invitation</code> prompts.</p>
        <pre class="seed" id="seed" aria-label="prompt seed"><span class="seed-label">seed</span>${escapeHtml(input.seedText)}</pre>
      </details>
    </section>
  </main>

  <footer class="shell-foot">
    What’s this? <a href="https://mirador.dev">mirador.dev</a>.
  </footer>
</div>

<script>
(function () {
  const cta = document.getElementById('cta');
  const seed = document.getElementById('seed');
  const mark = document.querySelector('.mark-anim');
  const seedText = seed ? seed.textContent.replace(/^seed/, '').trim() : '';
  const originalLabel = cta.textContent;
  let resetTimer = null;

  cta.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(seedText); }
    catch (e) {
      const r = document.createRange();
      r.selectNodeContents(seed);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      try { document.execCommand('copy'); } catch (_) {}
      sel.removeAllRanges();
    }

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

    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      cta.dataset.state = 'idle';
      cta.textContent = originalLabel;
    }, 4500);
  });
})();
</script>
</body>
</html>
`;
}

function composeCopy(input: LandingInput): {
  hero: string;
  sub: string;
  eyebrow: string;
  primaryCta: string;
} {
  if (input.kind === 'invitation') {
    return {
      eyebrow: input.role ? `invitation · ${input.role}` : 'invitation',
      hero: `${input.from} sent you ${input.slug}.`,
      sub: input.role
        ? `Open in Claude Code to read it with context.`
        : `Open in Claude Code to read it with context.`,
      primaryCta: 'Open in Claude Code',
    };
  }
  return {
    eyebrow: 'request to author',
    hero: `${input.from} wants you to write ${input.slug}.`,
    sub: `Open in Claude Code to begin.`,
    primaryCta: 'Open in Claude Code',
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function publishLanding(
  workspaceVercelSiteDir: string,
  slug: string,
  kind: 'invitation' | 'request',
  html: string,
): Promise<{ localPath: string }> {
  const subdir = kind === 'invitation' ? 'i' : 'r';
  const dir = join(workspaceVercelSiteDir, subdir, slug);
  const file = join(dir, 'index.html');
  await writeFileAtomic(file, html);
  return { localPath: file };
}
