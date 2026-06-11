import type { ThemeName } from './document/index.js';
import { renderContent } from './document/markdown.js';
import { renderShell } from './document/shell.js';
import type { ArtifactState, GitMeta, IntentNote, ParsedDoc, SectionState } from './view.js';

export interface ViewPageInput {
  title: string;
  theme: ThemeName;
  docs: ParsedDoc[];
  vision: { owner: string | null; text: string };
  state: ArtifactState;
  intents: IntentNote[];
  git: GitMeta;
  generatedAt: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Brand chrome per docs/design/spec.md — cobalt #2541B2, IBM Plex, archetype
   "dev-tool minimalist + 10% magic": staggered reveal on load, the mark pulses
   on copy. Light + dark intrinsic. Content below stays theme territory. */
const CHROME_STYLE = `<style>
:root{
  --mv-cobalt:#2541B2;--mv-cobalt-bright:#4F7DF3;
  --mv-grad:linear-gradient(135deg,#2541B2 0%,#4F7DF3 100%);
  --mv-bg:#fafafa;--mv-fg:#0a0a0a;--mv-muted:#666;--mv-border:#e5e5e5;
  --mv-card:#ffffff;--mv-mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,monospace;
  --mv-ease:cubic-bezier(.2,.8,.2,1);
}
@media (prefers-color-scheme:dark){:root{
  --mv-bg:#0f0f0f;--mv-fg:#fafafa;--mv-muted:#999;--mv-border:#1f1f1f;--mv-card:#0a0a0a;
}}
.mv{background:var(--mv-bg);color:var(--mv-fg);border-bottom:1px solid var(--mv-border);
  font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:.9375rem;line-height:1.5}
.mv *{box-sizing:border-box}
.mv-col{max-width:720px;margin:0 auto;padding:2rem 1.5rem 2.5rem}
.mv a{color:inherit}
.mv :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(79,125,243,.35);border-radius:4px}

.mv-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:2.25rem}
.mv-lockup{display:inline-flex;align-items:center;gap:.5em;font-weight:600;
  letter-spacing:-.04em;font-size:.9375rem;text-decoration:none}
.mv-ap{width:1.05em;height:1.05em;position:relative;top:-.04em}
.mv-ap .ap-inner{fill:var(--mv-cobalt)}
.mv-ap.pulse .ap-inner{animation:mv-pulse 320ms var(--mv-ease)}
@keyframes mv-pulse{50%{fill:var(--mv-cobalt-bright)}}
.mv-lockup .dot{color:var(--mv-cobalt)}
.mv-updated{font-family:var(--mv-mono);font-size:.75rem;color:var(--mv-muted)}

.mv-title{margin:0 0 .5rem;font-size:2rem;font-weight:600;letter-spacing:-.015em;line-height:1.25}
.mv-meta{display:flex;gap:.75em;flex-wrap:wrap;font-family:var(--mv-mono);font-size:.75rem;
  color:var(--mv-muted);margin-bottom:1.75rem}
.mv-meta .sep{color:var(--mv-border)}

.mv-label{display:block;font-family:var(--mv-mono);font-size:.6875rem;text-transform:uppercase;
  letter-spacing:.1em;color:var(--mv-muted);margin-bottom:.45rem}
.mv-vision{border-left:2px solid var(--mv-cobalt);padding:.1rem 0 .1rem 1.1rem;margin:0 0 1.5rem}
.mv-vision p{margin:0;font-size:1rem;line-height:1.6}
.mv-vision .mv-owner-tag{font-family:var(--mv-mono);font-size:.6875rem;color:var(--mv-muted)}

.mv-seed{position:relative;border-radius:8px;padding:1px;background:var(--mv-grad);margin:0 0 1.5rem}
.mv-seed-in{background:var(--mv-card);border-radius:7px;padding:1.1rem 1.25rem}
.mv-seed pre{margin:.1rem 0 .9rem;font-family:var(--mv-mono);font-size:.8125rem;line-height:1.55;
  white-space:pre-wrap;word-break:break-word;color:var(--mv-fg)}
.mv-seed pre .at{color:var(--mv-cobalt);font-weight:500}
.mv-copy{font-family:inherit;font-size:.8125rem;font-weight:500;color:#fff;
  background:var(--mv-grad);border:none;border-radius:6px;padding:.5em 1.1em;cursor:pointer;
  transition:transform 200ms ease-out,box-shadow 200ms ease-out}
.mv-copy:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(37,65,178,.3)}
.mv-copy:active{transform:translateY(0)}
.mv-seed-hint{font-size:.8125rem;color:var(--mv-muted);margin-left:.85em}

.mv-grid{display:grid;gap:1rem;grid-template-columns:1fr;margin-bottom:.25rem}
@media (min-width:720px){.mv-grid{grid-template-columns:1fr 1fr}}
.mv-card{background:var(--mv-card);border:1px solid var(--mv-border);border-radius:8px;
  padding:1.1rem 1.25rem;min-width:0}

.mv-sections{list-style:none;margin:0;padding:0}
.mv-sections li{display:flex;align-items:baseline;gap:.6em;padding:.3rem 0;font-size:.875rem}
.mv-doc-name{font-family:var(--mv-mono);font-size:.6875rem;color:var(--mv-muted);
  margin:.8rem 0 .2rem}
.mv-doc-name:first-of-type{margin-top:0}
.mv-dot{width:.5em;height:.5em;border-radius:99px;flex-shrink:0;position:relative;top:-.08em;
  border:1.5px solid var(--mv-muted);background:transparent}
.mv-dot-locked{background:var(--mv-cobalt);border-color:var(--mv-cobalt)}
.mv-dot-contested{background:#b45309;border-color:#b45309}
.mv-sections .st{font-family:var(--mv-mono);font-size:.6875rem;color:var(--mv-muted);margin-left:auto;flex-shrink:0}
.mv-sections .st-contested{color:#b45309}
.mv-sections .st-locked{color:var(--mv-cobalt)}

.mv-intent{padding:.65rem 0;border-top:1px solid var(--mv-border)}
.mv-intent:first-of-type{border-top:none;padding-top:0}
.mv-intent-meta{display:flex;align-items:baseline;gap:.7em;flex-wrap:wrap;margin-bottom:.25rem}
.mv-intent-meta time{font-family:var(--mv-mono);font-size:.6875rem;color:var(--mv-muted)}
.mv-intent-meta .who{font-weight:600;font-size:.8125rem}
.mv-move{font-family:var(--mv-mono);font-size:.625rem;text-transform:uppercase;letter-spacing:.08em;
  color:var(--mv-cobalt);border:1px solid currentColor;border-radius:99px;padding:.05em .6em}
.mv-intent p{margin:0;font-size:.875rem;line-height:1.55}
.mv-intent .secs{font-family:var(--mv-mono);font-size:.6875rem;color:var(--mv-muted)}
.mv-more{font-family:var(--mv-mono);font-size:.6875rem;color:var(--mv-muted);padding-top:.6rem}

.mv-docnav{display:flex;gap:.5em;flex-wrap:wrap;margin-top:1.25rem}
.mv-docnav a{font-family:var(--mv-mono);font-size:.75rem;text-decoration:none;
  border:1px solid var(--mv-border);border-radius:6px;padding:.35em .8em;color:var(--mv-muted);
  transition:border-color 200ms ease-out,color 200ms ease-out}
.mv-docnav a:hover{border-color:var(--mv-cobalt);color:var(--mv-fg)}

.mv-doc-sep{max-width:680px;margin:3rem auto 0;padding:1.25rem 1.5rem 0;display:flex;
  align-items:center;gap:.6em;font-family:var(--mv-mono);font-size:.6875rem;text-transform:uppercase;
  letter-spacing:.1em;color:var(--mv-muted);border-top:1px solid var(--mv-border)}
.mv-doc-sep .mv-ap{width:.9em;height:.9em}
.mv-footer{max-width:680px;margin:4rem auto 2.5rem;padding:0 1.5rem;display:flex;align-items:center;
  gap:.5em;font-family:var(--mv-mono);font-size:.6875rem;color:var(--mv-muted)}
.mv-footer .mv-ap{width:.95em;height:.95em}

@media (prefers-reduced-motion:no-preference){
  .mv-reveal{opacity:0;transform:translateY(8px);
    animation:mv-in 320ms var(--mv-ease) forwards}
  @keyframes mv-in{to{opacity:1;transform:none}}
  .mv-d1{animation-delay:60ms}.mv-d2{animation-delay:120ms}.mv-d3{animation-delay:180ms}
  .mv-d4{animation-delay:240ms}.mv-d5{animation-delay:300ms}
}
</style>`;

const APERTURE = `<svg class="mv-ap" viewBox="0 0 24 24" aria-hidden="true"><rect x="0.75" y="0.75" width="22.5" height="22.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect class="ap-inner" x="14" y="4" width="6" height="6"/></svg>`;

const COPY_SCRIPT = `<script>
(function(){var b=document.querySelector('.mv-copy');if(!b)return;
b.addEventListener('click',function(){
navigator.clipboard.writeText(document.getElementById('mv-seed-text').textContent).then(function(){
b.textContent='Copied. Paste it in.';
var ap=document.querySelector('.mv-lockup .mv-ap');
if(ap){ap.classList.remove('pulse');void ap.offsetWidth;ap.classList.add('pulse');}
setTimeout(function(){b.textContent='Copy'},2200);});});})();
</script>`;

function docId(file: string): string {
  return `doc-${file
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}`;
}

function lockup(): string {
  return `<span class="mv-lockup">${APERTURE}<span>mirador<span class="dot">.</span></span></span>`;
}

function sectionRows(sections: SectionState[]): string {
  return sections
    .map((s) => {
      const dot = s.status === 'open' ? '' : ` mv-dot-${s.status}`;
      const st =
        s.status === 'open'
          ? ''
          : `<span class="st st-${s.status}">${s.status}${s.owner ? ` · ${esc(s.owner)}` : ''}</span>`;
      return `<li><span class="mv-dot${dot}"></span><span>${esc(s.title)}</span>${st}</li>`;
    })
    .join('\n');
}

function statePanel(state: ArtifactState): string {
  const entries = Object.entries(state.docs).filter(([, d]) => d.sections.length > 0);
  if (!entries.length) return '';
  const all = entries.flatMap(([, d]) => d.sections);
  const contested = all.filter((s) => s.status === 'contested').length;
  const locked = all.filter((s) => s.status === 'locked').length;
  const counts = [
    contested ? `${contested} contested` : null,
    locked ? `${locked} locked` : null,
    `${all.length - contested - locked} open`,
  ]
    .filter(Boolean)
    .join(' · ');
  const body = entries
    .map(
      ([file, d]) =>
        `<div class="mv-doc-name">${esc(file)}</div>\n<ul class="mv-sections">\n${sectionRows(d.sections)}\n</ul>`,
    )
    .join('\n');
  return `<section class="mv-card mv-reveal mv-d4">
<span class="mv-label">Sections — ${counts}</span>
${body}
</section>`;
}

function intentsPanel(intents: IntentNote[]): string {
  if (!intents.length) return '';
  const items = intents
    .slice(0, 8)
    .map((n) => {
      const move = n.move ? `<span class="mv-move">${esc(n.move)}</span>` : '';
      const secs = n.sections.length
        ? `<span class="secs">§${n.sections.map(esc).join(' §')}</span>`
        : '';
      return `<div class="mv-intent">
<div class="mv-intent-meta"><time>${esc(n.date)}</time><span class="who">${esc(n.author)}</span>${move}${secs}</div>
<p>${esc(n.body).replace(/\n/g, '<br>')}</p>
</div>`;
    })
    .join('\n');
  const more =
    intents.length > 8
      ? `<div class="mv-more">+ ${intents.length - 8} earlier in .mirador/intents/</div>`
      : '';
  return `<section class="mv-card mv-reveal mv-d5">
<span class="mv-label">Why it changed</span>
${items}
${more}
</section>`;
}

function seedCard(git: GitMeta): string {
  if (!git.remoteUrl) return '';
  const seedBody = [
    `repo: ${git.remoteUrl}`,
    git.branch ? `branch: ${git.branch}` : null,
    git.artifactPath ? `artifact: ${git.artifactPath}` : null,
    'do: clone the repo (or pull), check out the branch, read .claude/skills/mirador/SKILL.md, then run its BRIEF protocol on the artifact for me.',
  ]
    .filter(Boolean)
    .join('\n');
  return `<section class="mv-seed mv-reveal mv-d3">
<div class="mv-seed-in">
<span class="mv-label">Open it with your agent</span>
<pre id="mv-seed-text"><span class="at">@mirador-view</span>\n${esc(seedBody)}</pre>
<button class="mv-copy" type="button">Copy</button><span class="mv-seed-hint">paste it into Claude Code, Codex or Gemini — it briefs you in your own context.</span>
</div>
</section>`;
}

export function buildViewPage(input: ViewPageInput): string {
  const { title, theme, docs, vision, state, intents, git, generatedAt } = input;

  const metaBits = [
    git.branch ? esc(git.branch) : null,
    git.artifactPath && git.artifactPath !== '.' ? esc(git.artifactPath) : null,
    `${docs.length} doc${docs.length === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join('<span class="sep">/</span>');

  const visionBlock = vision.text
    ? `<div class="mv-vision mv-reveal mv-d2">
<span class="mv-label">Vision${vision.owner ? ` <span class="mv-owner-tag">— ${esc(vision.owner)}</span>` : ''}</span>
<p>${esc(vision.text).replace(/\n/g, '<br>')}</p>
</div>`
    : '';

  const docNav =
    docs.length > 1
      ? `<nav class="mv-docnav mv-reveal mv-d5">${docs
          .map((d) => `<a href="#${docId(d.file)}">${esc(d.file)}</a>`)
          .join('')}</nav>`
      : '';

  const rendered = docs
    .map(
      (d) =>
        `<div class="mv-doc-sep" id="${docId(d.file)}">${APERTURE}${esc(d.file)}</div>\n${renderContent(d.model)}`,
    )
    .join('\n');

  const updated = `updated ${esc(generatedAt.slice(0, 10))}`;

  const body = `${CHROME_STYLE}
<header class="mv">
<div class="mv-col">
<div class="mv-top mv-reveal">${lockup()}<span class="mv-updated">${updated}</span></div>
<h1 class="mv-title mv-reveal mv-d1">${esc(title)}</h1>
<div class="mv-meta mv-reveal mv-d1">${metaBits}</div>
${visionBlock}
${seedCard(git)}
<div class="mv-grid">
${statePanel(state)}
${intentsPanel(intents)}
</div>
${docNav}
</div>
</header>
${rendered}
<footer class="mv-footer">${APERTURE}<span>the artifact lives in git — this is just a view.</span></footer>
${COPY_SCRIPT}`;

  return renderShell(body, theme, `${title} · mirador`);
}
