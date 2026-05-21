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

export function renderLanding(input: LandingInput): string {
  const heading =
    input.kind === 'invitation'
      ? `${input.from} shared "${input.slug}" with you`
      : `${input.from} requests "${input.slug}"`;
  const sub =
    input.kind === 'invitation'
      ? `Role expected: ${input.role ?? '—'}`
      : 'Asking you to author this artifact';
  const noteOrContext = input.note ?? input.context ?? '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mirador · ${input.slug}</title>
<style>
:root { --bg:#fafafa; --fg:#1a1a1a; --muted:#666; --accent:#0a5; --border:#e5e5e5; }
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background:var(--bg); color:var(--fg); margin:0; padding:3rem 1.5rem; }
main { max-width:640px; margin:0 auto; }
h1 { margin:0 0 .5rem; font-size:1.5rem; }
.sub { color:var(--muted); margin-bottom:1.5rem; }
.note { background:#fff; border:1px solid var(--border); border-radius:8px; padding:1rem 1.25rem; margin-bottom:2rem; }
.cta-primary { display:inline-block; background:var(--fg); color:#fff; padding:.75rem 1.25rem; border-radius:6px; text-decoration:none; font-weight:600; cursor:pointer; border:0; font-size:1rem; }
.cta-secondary { display:inline-block; margin-left:1rem; color:var(--muted); text-decoration:underline; font-size:.95rem; }
.seed { background:#f5f5f5; border:1px solid var(--border); padding:1rem; border-radius:6px; white-space:pre-wrap; word-break:break-word; font-family:ui-monospace, monospace; font-size:.85rem; margin-top:2rem; }
.footer { margin-top:3rem; color:var(--muted); font-size:.85rem; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(heading)}</h1>
  <p class="sub">${escapeHtml(sub)}</p>
  ${noteOrContext ? `<div class="note">${escapeHtml(noteOrContext)}</div>` : ''}
  <button class="cta-primary" id="copy">Open in Claude Code</button>
  ${input.previewUrl ? `<a class="cta-secondary" href="${escapeHtml(input.previewUrl)}">Just view it (read-only)</a>` : ''}
  <pre class="seed" id="seed">${escapeHtml(input.seedText)}</pre>
  <p class="footer">What is Mirador? Visit <a href="https://mirador.dev">mirador.dev</a>.</p>
</main>
<script>
document.getElementById('copy').addEventListener('click', () => {
  const text = document.getElementById('seed').textContent;
  navigator.clipboard.writeText(text).then(() => {
    document.getElementById('copy').textContent = 'Copied! Paste into Claude Code.';
  });
});
</script>
</body>
</html>
`;
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
