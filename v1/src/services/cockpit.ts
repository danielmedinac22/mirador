import { type FSWatcher, watch } from 'node:fs';
import { join } from 'node:path';
import { pathExists, readText } from '../adapters/fs.js';
import { fetchRemote, headSha, repoRoot } from '../adapters/git.js';
import { type CockpitServer, startCockpitServer } from '../adapters/localServer.js';
import { resolveArtifactPath } from './artifact.js';
import * as document from './document/index.js';
import { assembleHandoff, renderHandoff } from './handoff.js';
import { resolveSiteAssetsRoot } from './siteChrome.js';
import { SOURCE_FILE } from './staticPreview.js';

/**
 * The live cockpit (design §12): a local, read-only mirror. File-watch the
 * source → re-render → hot-reload the browser (the solo loop). A remote poll
 * loop surfaces incoming handoffs when convergence lands via git (the multi
 * loop). Mirror is local; what syncs is git. Nothing is published.
 */

export interface Cockpit {
  url: string;
  /** Force a browser reload (manual). */
  refresh: () => void;
  /** Fetch + detect new commits → surface the handoff brief. Returns true if it did. */
  checkRemote: () => Promise<boolean>;
  stop: () => Promise<void>;
}

export interface CockpitOptions {
  slug: string;
  theme?: string;
  port?: number;
  host?: string;
}

export async function startCockpit(opts: CockpitOptions): Promise<Cockpit> {
  const artifactPath = await resolveArtifactPath(opts.slug);
  const sourcePath = join(artifactPath, SOURCE_FILE);
  const themeName = document.normaliseTheme(opts.theme ?? 'page');

  const view = async (): Promise<string> => {
    if (!(await pathExists(sourcePath))) {
      return '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:2rem;color:#666">No <code>source.md</code> yet — the mirror updates as your agent writes it.</body>';
    }
    return document.render(document.parse(await readText(sourcePath)), themeName);
  };

  const server: CockpitServer = await startCockpitServer({
    shell: () => cockpitShell(opts.slug),
    view,
    staticRoot: resolveSiteAssetsRoot(),
    port: opts.port,
    host: opts.host,
  });

  const watcher: FSWatcher | null = (await pathExists(sourcePath))
    ? watch(sourcePath, () => server.push('reload', { source: 'local' }))
    : null;

  const root = await repoRoot(artifactPath);
  let lastHead = root ? await headSha(root) : null;

  async function checkRemote(): Promise<boolean> {
    if (!root) return false;
    await fetchRemote(root);
    const head = await headSha(root);
    if (head && head !== lastHead) {
      lastHead = head;
      const packet = await assembleHandoff(opts.slug);
      server.push('handoff', { brief: renderHandoff(packet) });
      server.push('reload', { source: 'remote' });
      return true;
    }
    return false;
  }

  return {
    url: server.url,
    refresh: () => server.push('reload', { source: 'manual' }),
    checkRemote,
    stop: async () => {
      watcher?.close();
      await server.close();
    },
  };
}

/** Run a started cockpit until SIGINT/SIGTERM, polling the remote each interval. */
export function keepCockpitAlive(cockpit: Cockpit, pollSeconds: number): Promise<void> {
  const timer = setInterval(() => {
    void cockpit.checkRemote();
  }, Math.max(2, pollSeconds) * 1000);
  return new Promise<void>((resolve) => {
    const stop = (): void => {
      clearInterval(timer);
      void cockpit.stop().then(resolve);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

function cockpitShell(slug: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>mirador · cockpit · ${slug}</title>
<style>
  :root{--bg:#fafafa;--fg:#0a0a0a;--muted:#666;--accent:#2541B2;--border:#e5e5e5}
  @media (prefers-color-scheme:dark){:root{--bg:#0a0a0a;--fg:#fafafa;--muted:#999;--accent:#4F7DF3;--border:#1f1f1f}}
  *{box-sizing:border-box}html,body{margin:0;height:100%}
  body{display:flex;flex-direction:column;font-family:'IBM Plex Sans',-apple-system,system-ui,sans-serif;background:var(--bg);color:var(--fg)}
  header{display:flex;align-items:center;gap:.5rem;padding:.5rem .9rem;border-bottom:1px solid var(--border);font-size:.8rem}
  header .mark{width:11px;height:11px;border:1.5px solid var(--fg);position:relative;flex:none}
  header .mark::after{content:'';position:absolute;width:3px;height:3px;background:var(--accent);top:1.5px;right:1.5px}
  header .ro{margin-left:auto;color:var(--muted)}
  #brief{white-space:pre-wrap;font:500 .8rem/1.5 'IBM Plex Mono',ui-monospace,monospace;background:color-mix(in srgb,var(--accent) 8%,transparent);border-bottom:1px solid var(--border);padding:.75rem .9rem;margin:0}
  iframe{flex:1;border:0;width:100%;background:#fff}
  @media (prefers-color-scheme:dark){iframe{background:#0a0a0a}}
</style></head>
<body>
  <header><span class="mark"></span><strong>mirador</strong>&nbsp;cockpit · ${slug}<span class="ro">read-only mirror</span></header>
  <pre id="brief" hidden></pre>
  <iframe id="view" src="/view" title="rendered artifact"></iframe>
  <script>
    const ev = new EventSource('/events');
    ev.addEventListener('reload', function () {
      var f = document.getElementById('view'); if (f && f.contentWindow) f.contentWindow.location.reload();
    });
    ev.addEventListener('handoff', function (e) {
      try { var d = JSON.parse(e.data); var b = document.getElementById('brief'); b.textContent = d.brief; b.hidden = false; } catch (err) { /* ignore */ }
    });
  </script>
</body></html>`;
}
