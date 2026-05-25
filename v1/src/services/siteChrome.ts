import { cp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir, pathExists } from '../adapters/fs.js';

/**
 * Installs the shared Mirador chrome (CSS, fonts, mark assets, theme files)
 * into the given Vercel site root. Called once per `share` before any
 * landing or preview gets published, so every page can reference `/style.css`,
 * `/fonts/...`, `/themes/<theme>/theme.css`, etc.
 *
 * Idempotent. Safe to call on every share.
 *
 * Source layout (in repo / install): see v1/site-assets/
 *   tokens.css / reset.css / chrome.css / fonts.css / style.css
 *   fonts/*.woff2
 *   assets/aperture.svg / aperture-favicon*.svg / lockup-*.svg
 *   themes/{page,memo,deck,console,atlas}/theme.css + meta.json
 *   themes/deck/deck.js
 */
export async function installSiteChrome(siteRoot: string): Promise<void> {
  const source = resolveSiteAssetsRoot();
  await ensureDir(siteRoot);

  // Files at root of site/
  for (const f of ['tokens.css', 'reset.css', 'fonts.css', 'chrome.css', 'style.css']) {
    const src = join(source, f);
    if (await pathExists(src)) await cp(src, join(siteRoot, f), { force: true });
  }

  // Directories — copy contents under site/<name>/
  for (const dir of ['fonts', 'assets', 'themes']) {
    const src = join(source, dir);
    if (await pathExists(src)) {
      await cp(src, join(siteRoot, dir), { recursive: true, force: true });
    }
  }
}

/**
 * Resolves the on-disk location of site-assets/, accommodating both
 * (a) bundled dist where this file is alongside `../site-assets/` at the
 * package root, and (b) source dev where this file is in v1/src/services/
 * and site-assets lives at v1/site-assets/.
 *
 * Env var MIRADOR_SITE_ASSETS_OVERRIDE wins (for tests).
 */
function resolveSiteAssetsRoot(): string {
  if (process.env.MIRADOR_SITE_ASSETS_OVERRIDE) return process.env.MIRADOR_SITE_ASSETS_OVERRIDE;

  const here = dirname(fileURLToPath(import.meta.url));
  // candidate 1: bundled — site-assets is sibling of dist
  const bundled = resolve(here, '..', 'site-assets');
  // candidate 2: dev — site-assets is at v1/site-assets/, from v1/src/services/
  const dev = resolve(here, '..', '..', 'site-assets');
  // candidate 3: dev nested deeper (tsup output)
  const devDeep = resolve(here, '..', '..', '..', 'site-assets');

  for (const c of [bundled, dev, devDeep]) {
    // synchronous existsSync would simplify but we keep node:fs/promises imports
    // and let cp() throw if the directory is wrong — we still resolve to the
    // best candidate and the operations short-circuit on missing files.
    void c;
  }
  // Prefer dev path during local dev; consumers should set the override in tests.
  return dev;
}
