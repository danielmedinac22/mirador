import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViewerServer } from '../src/server.js';

let server: Server;
let base: string;
let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'mirador-viewer-'));
  server = createViewerServer({
    dataDir,
    maxBytes: 64 * 1024,
    assetsDir: new URL('../static', import.meta.url).pathname,
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(dataDir, { recursive: true, force: true });
});

async function register(title?: string) {
  const res = await fetch(`${base}/api/artifacts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: title ? JSON.stringify({ title }) : undefined,
  });
  return res;
}

describe('healthz + landing', () => {
  it('healthz responds ok', async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('root serves a landing page with nothing to browse', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing to browse');
  });
});

describe('register', () => {
  it('returns slug, writeToken and url', async () => {
    const res = await register('definicion-funcional');
    expect(res.status).toBe(201);
    const body = (await res.json()) as { slug: string; writeToken: string; url: string };
    expect(body.slug).toMatch(/^[A-Za-z0-9_-]{8,}$/);
    expect(body.writeToken.length).toBeGreaterThanOrEqual(32);
    expect(body.url).toContain(`/v/${body.slug}`);
  });

  it('rejects malformed JSON', async () => {
    const res = await fetch(`${base}/api/artifacts`, { method: 'POST', body: '{nope' });
    expect(res.status).toBe(400);
  });
});

describe('push + view', () => {
  it('full loop: register → put → get serves the html verbatim', async () => {
    const { slug, writeToken } = (await (await register()).json()) as {
      slug: string;
      writeToken: string;
    };
    const html = '<!doctype html><html><body><h1>v0.4 — close management</h1></body></html>';
    const put = await fetch(`${base}/api/artifacts/${slug}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${writeToken}`, 'content-type': 'text/html' },
      body: html,
    });
    expect(put.status).toBe(204);

    const view = await fetch(`${base}/v/${slug}`);
    expect(view.status).toBe(200);
    expect(view.headers.get('content-type')).toContain('text/html');
    expect(view.headers.get('x-robots-tag')).toContain('noindex');
    expect(await view.text()).toBe(html);
  });

  it('a second put overwrites the view', async () => {
    const { slug, writeToken } = (await (await register()).json()) as {
      slug: string;
      writeToken: string;
    };
    const auth = { authorization: `Bearer ${writeToken}` };
    await fetch(`${base}/api/artifacts/${slug}`, { method: 'PUT', headers: auth, body: 'one' });
    await fetch(`${base}/api/artifacts/${slug}`, { method: 'PUT', headers: auth, body: 'two' });
    expect(await (await fetch(`${base}/v/${slug}`)).text()).toBe('two');
  });

  it('rejects a put without token', async () => {
    const { slug } = (await (await register()).json()) as { slug: string };
    const res = await fetch(`${base}/api/artifacts/${slug}`, { method: 'PUT', body: 'x' });
    expect(res.status).toBe(401);
  });

  it('rejects a put with the wrong token', async () => {
    const { slug } = (await (await register()).json()) as { slug: string };
    const res = await fetch(`${base}/api/artifacts/${slug}`, {
      method: 'PUT',
      headers: { authorization: 'Bearer not-the-token' },
      body: 'x',
    });
    expect(res.status).toBe(401);
  });

  it('one artifact token cannot push to another artifact', async () => {
    const a = (await (await register()).json()) as { slug: string; writeToken: string };
    const b = (await (await register()).json()) as { slug: string };
    const res = await fetch(`${base}/api/artifacts/${b.slug}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${a.writeToken}` },
      body: 'x',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a body over the size cap with 413', async () => {
    const { slug, writeToken } = (await (await register()).json()) as {
      slug: string;
      writeToken: string;
    };
    const res = await fetch(`${base}/api/artifacts/${slug}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${writeToken}` },
      body: 'x'.repeat(80 * 1024),
    });
    expect(res.status).toBe(413);
  });

  it('unknown slug 404s on put and view', async () => {
    const put = await fetch(`${base}/api/artifacts/AAAAAAAAAAAAAAAA`, {
      method: 'PUT',
      headers: { authorization: 'Bearer whatever' },
      body: 'x',
    });
    expect(put.status).toBe(404);
    const view = await fetch(`${base}/v/AAAAAAAAAAAAAAAA`);
    expect(view.status).toBe(404);
  });

  it('rejects path-traversal-shaped slugs', async () => {
    const view = await fetch(`${base}/v/..%2F..%2Fetc%2Fpasswd`);
    expect(view.status).toBe(404);
  });
});

describe('theme assets', () => {
  it('serves theme css with the right content-type', async () => {
    const res = await fetch(`${base}/themes/page/theme.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/css');
    expect(await res.text()).toContain('--page-accent');
  });

  it('serves fonts.css and woff2 files', async () => {
    const css = await fetch(`${base}/fonts.css`);
    expect(css.status).toBe(200);
    const woff = await fetch(`${base}/fonts/ibm-plex-sans-latin-400-normal.woff2`);
    expect(woff.status).toBe(200);
    expect(woff.headers.get('content-type')).toBe('font/woff2');
  });

  it('refuses asset paths that escape the assets dir', async () => {
    const res = await fetch(`${base}/themes/..%2F..%2Fpackage.json`);
    expect(res.status).toBe(404);
    const res2 = await fetch(`${base}/..%2Fpackage.json`);
    expect(res2.status).toBe(404);
  });
});
