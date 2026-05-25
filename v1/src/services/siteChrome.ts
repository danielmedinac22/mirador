import { existsSync } from 'node:fs';
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

  let copied = 0;

  // Files at root of site/
  for (const f of ['tokens.css', 'reset.css', 'fonts.css', 'chrome.css', 'style.css']) {
    const src = join(source, f);
    if (await pathExists(src)) {
      await cp(src, join(siteRoot, f), { force: true });
      copied++;
    }
  }

  // Directories — copy contents under site/<name>/
  for (const dir of ['fonts', 'assets', 'themes']) {
    const src = join(source, dir);
    if (await pathExists(src)) {
      await cp(src, join(siteRoot, dir), { recursive: true, force: true });
      copied++;
    }
  }

  if (copied === 0) {
    throw new Error(
      `installSiteChrome: no chrome assets found at "${source}". ` +
        `Check that v1/site-assets/ ships with the install ` +
        `(package.json "files" must include "site-assets"), or set ` +
        `MIRADOR_SITE_ASSETS_OVERRIDE to the absolute path.`,
    );
  }
}

/**
 * Resolves the on-disk location of site-assets/. Walks a small list of
 * candidate paths and returns the first that exists, accommodating:
 *
 *   1. Bundled dist  — dist/index.js sits next to site-assets/ (npm install)
 *   2. Dev source    — src/services/*.ts → v1/site-assets/
 *   3. Test fixtures — vitest can override via env var
 *
 * Env var MIRADOR_SITE_ASSETS_OVERRIDE wins (used by tests).
 */
function resolveSiteAssetsRoot(): string {
  if (process.env.MIRADOR_SITE_ASSETS_OVERRIDE) return process.env.MIRADOR_SITE_ASSETS_OVERRIDE;

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '..', 'site-assets'), // dist/index.js → ../site-assets/
    resolve(here, '..', '..', 'site-assets'), // src/services/X.ts → ../../site-assets/
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Nothing matched — return the most-likely candidate so the downstream
  // error message points at a realistic path.
  return candidates[0] ?? '';
}
