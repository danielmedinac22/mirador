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

const CHROME_STYLE = `<style>
.mv-chrome{max-width:680px;margin:2.5rem auto 0;padding:0 1.5rem;font-size:.95rem}
.mv-chrome h1{margin:0 0 .35rem;font-size:1.6rem;line-height:1.2}
.mv-meta{color:var(--page-fg-muted,#666);font-size:.82rem;display:flex;gap:.6em;flex-wrap:wrap}
.mv-vision{border-left:3px solid var(--page-accent,#2541B2);background:rgba(37,65,178,.05);padding:.7rem 1rem;margin:1.25rem 0;border-radius:0 6px 6px 0}
.mv-vision .mv-label{display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--page-fg-muted,#666);margin-bottom:.25rem}
.mv-panel{border:1px solid var(--page-border,#e5e5e5);border-radius:8px;padding:.9rem 1.1rem;margin:1rem 0}
.mv-panel summary{cursor:pointer;font-weight:600;font-size:.9rem}
.mv-panel[open] summary{margin-bottom:.6rem}
.mv-sections{list-style:none;padding:0;margin:.4rem 0 0}
.mv-sections li{display:flex;align-items:baseline;gap:.6em;padding:.18rem 0;font-size:.88rem}
.mv-doc-name{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--page-fg-muted,#666);margin:.7rem 0 .15rem}
.mv-badge{font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;padding:.1em .55em;border-radius:99px;border:1px solid var(--page-border,#e5e5e5);color:var(--page-fg-muted,#666);flex-shrink:0}
.mv-badge-contested{border-color:#b45309;color:#b45309;background:rgba(180,83,9,.08)}
.mv-badge-locked{border-color:var(--page-accent,#2541B2);color:var(--page-accent,#2541B2);background:rgba(37,65,178,.07)}
.mv-owner{color:var(--page-fg-subtle,#888);font-size:.78rem;margin-left:auto}
.mv-intent{border-top:1px solid var(--page-border,#e5e5e5);padding:.6rem 0;font-size:.88rem}
.mv-intent:first-of-type{border-top:none}
.mv-intent-meta{color:var(--page-fg-muted,#666);font-size:.78rem;display:flex;gap:.6em;flex-wrap:wrap;margin-bottom:.2rem}
.mv-move{border:1px solid var(--page-border,#e5e5e5);border-radius:99px;padding:0 .5em;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}
.mv-seed pre{white-space:pre-wrap;word-break:break-word;font-size:.78rem;background:var(--page-code-bg,#f5f5f5);color:var(--page-code-fg,#0a0a0a);padding:.8rem;border-radius:6px;margin:.4rem 0 .5rem}
.mv-copy{font:inherit;font-size:.8rem;padding:.3em .9em;border-radius:6px;border:1px solid var(--page-border,#e5e5e5);background:transparent;color:inherit;cursor:pointer}
.mv-copy:hover{border-color:var(--page-accent,#2541B2)}
.mv-docnav{display:flex;gap:.5em;flex-wrap:wrap;margin:1.2rem 0 0;font-size:.85rem}
.mv-docnav a{text-decoration:none;border:1px solid var(--page-border,#e5e5e5);border-radius:6px;padding:.25em .7em;color:inherit}
.mv-doc-sep{max-width:680px;margin:2.5rem auto 1rem;padding:0 1.5rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--page-fg-subtle,#888)}
.mv-footer{max-width:680px;margin:3rem auto 2rem;padding:0 1.5rem;font-size:.78rem;color:var(--page-fg-subtle,#888)}
</style>`;

function docId(file: string): string {
  return `doc-${file
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}`;
}

function sectionBadges(sections: SectionState[]): string {
  return sections
    .map((s) => {
      const badge =
        s.status === 'open'
          ? '<span class="mv-badge">open</span>'
          : `<span class="mv-badge mv-badge-${s.status}">${s.status}</span>`;
      const owner = s.owner ? `<span class="mv-owner">${esc(s.owner)}</span>` : '';
      return `<li>${badge}<span>${esc(s.title)}</span>${owner}</li>`;
    })
    .join('\n');
}

function convergencePanel(state: ArtifactState): string {
  const entries = Object.entries(state.docs).filter(([, d]) => d.sections.length > 0);
  if (!entries.length) return '';
  const contested = entries.flatMap(([, d]) => d.sections).filter((s) => s.status === 'contested');
  const locked = entries.flatMap(([, d]) => d.sections).filter((s) => s.status === 'locked');
  const summaryBits = [
    contested.length ? `${contested.length} contested` : null,
    locked.length ? `${locked.length} locked` : null,
  ].filter(Boolean);
  const summary = summaryBits.length ? ` — ${summaryBits.join(' · ')}` : '';
  const body = entries
    .map(
      ([file, d]) =>
        `<div class="mv-doc-name">${esc(file)}</div>\n<ul class="mv-sections">\n${sectionBadges(d.sections)}\n</ul>`,
    )
    .join('\n');
  return `<details class="mv-panel"${contested.length ? ' open' : ''}>
<summary>Sections${summary}</summary>
${body}
</details>`;
}

function intentsPanel(intents: IntentNote[]): string {
  if (!intents.length) return '';
  const items = intents
    .slice(0, 8)
    .map((n) => {
      const move = n.move ? `<span class="mv-move">${esc(n.move)}</span>` : '';
      const sections = n.sections.length ? `<span>§${n.sections.map(esc).join(' §')}</span>` : '';
      return `<div class="mv-intent">
<div class="mv-intent-meta"><span>${esc(n.date)}</span><strong>${esc(n.author)}</strong>${move}${sections}</div>
${esc(n.body).replace(/\n/g, '<br>')}
</div>`;
    })
    .join('\n');
  const more =
    intents.length > 8
      ? `<div class="mv-intent-meta">… ${intents.length - 8} earlier in .mirador/intents/</div>`
      : '';
  return `<details class="mv-panel" open>
<summary>Why it changed — ${intents.length} intent${intents.length === 1 ? '' : 's'}</summary>
${items}
${more}
</details>`;
}

function agentSeed(input: ViewPageInput): string {
  const { git } = input;
  if (!git.remoteUrl) return '';
  const seed = [
    '@mirador-view',
    `repo: ${git.remoteUrl}`,
    git.branch ? `branch: ${git.branch}` : null,
    git.artifactPath ? `artifact: ${git.artifactPath}` : null,
    'do: clone the repo (or pull), check out the branch, read .claude/skills/mirador/SKILL.md, then run its BRIEF protocol on the artifact for me.',
  ]
    .filter(Boolean)
    .join('\n');
  return `<details class="mv-panel mv-seed" open>
<summary>Open it with your agent</summary>
<pre id="mv-seed-text">${esc(seed)}</pre>
<button class="mv-copy" type="button" onclick="navigator.clipboard.writeText(document.getElementById('mv-seed-text').textContent).then(()=>{this.textContent='copied';setTimeout(()=>{this.textContent='copy'},1500)})">copy</button>
<span class="mv-intent-meta" style="display:inline;margin-left:.6em">paste it into Claude Code, Codex or Gemini — it onboards you and briefs you in your own context.</span>
</details>`;
}

export function buildViewPage(input: ViewPageInput): string {
  const { title, theme, docs, vision, state, intents, git, generatedAt } = input;

  const meta = [
    `updated ${esc(generatedAt.slice(0, 16).replace('T', ' '))} UTC`,
    git.branch ? esc(git.branch) : null,
    git.artifactPath && git.artifactPath !== '.' ? esc(git.artifactPath) : null,
    `${docs.length} doc${docs.length === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .map((m) => `<span>${m}</span>`)
    .join('<span>·</span>');

  const visionBlock = vision.text
    ? `<div class="mv-vision"><span class="mv-label">vision${vision.owner ? ` — ${esc(vision.owner)}` : ''}</span>${esc(vision.text).replace(/\n/g, '<br>')}</div>`
    : '';

  const docNav =
    docs.length > 1
      ? `<nav class="mv-docnav">${docs
          .map((d) => `<a href="#${docId(d.file)}">${esc(d.file)}</a>`)
          .join('')}</nav>`
      : '';

  const rendered = docs
    .map(
      (d) =>
        `<div class="mv-doc-sep" id="${docId(d.file)}">${esc(d.file)}</div>\n${renderContent(d.model)}`,
    )
    .join('\n');

  const body = `${CHROME_STYLE}
<header class="mv-chrome">
<h1>${esc(title)}</h1>
<div class="mv-meta">${meta}</div>
${visionBlock}
${agentSeed(input)}
${convergencePanel(state)}
${intentsPanel(intents)}
${docNav}
</header>
${rendered}
<footer class="mv-footer">rendered by mirador — the artifact lives in git; this is just a view.</footer>`;

  return renderShell(body, theme, title);
}
