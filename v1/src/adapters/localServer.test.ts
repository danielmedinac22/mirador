import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CockpitServer, startCockpitServer } from './localServer.js';

function fetchText(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let body = '';
      res.on('data', (c) => {
        body += c;
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    }).on('error', reject);
  });
}

interface Sse {
  next: () => Promise<string>;
  close: () => void;
}
function openSse(url: string): Promise<Sse> {
  return new Promise((resolve, reject) => {
    const req = get(url, (res) => {
      let buffer = '';
      const waiters: Array<(s: string) => void> = [];
      const tryDeliver = (): void => {
        const idx = buffer.indexOf('event:');
        if (idx >= 0 && buffer.includes('\n\n', idx)) {
          const w = waiters.shift();
          if (w) {
            w(buffer);
            buffer = '';
          }
        }
      };
      res.on('data', (c) => {
        buffer += c.toString();
        tryDeliver();
      });
      resolve({
        next: () =>
          new Promise<string>((r) => {
            waiters.push(r);
            tryDeliver();
          }),
        close: () => req.destroy(),
      });
    });
    req.on('error', reject);
  });
}

describe('adapters/localServer', () => {
  let server: CockpitServer;
  let staticRoot: string;

  beforeEach(async () => {
    staticRoot = await mkdtemp(join(tmpdir(), 'mirador-static-'));
    await mkdir(join(staticRoot, 'themes', 'page'), { recursive: true });
    await writeFile(join(staticRoot, 'themes', 'page', 'theme.css'), '.x{}');
    server = await startCockpitServer({
      shell: () => '<!doctype html><title>cockpit-shell</title>',
      view: () => '<p>the-view</p>',
      staticRoot,
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(staticRoot, { recursive: true, force: true });
  });

  it('binds localhost and serves shell / view / static / 404', async () => {
    expect(server.url).toContain('127.0.0.1');
    expect((await fetchText(`${server.url}/`)).body).toContain('cockpit-shell');
    expect((await fetchText(`${server.url}/view`)).body).toContain('the-view');
    const css = await fetchText(`${server.url}/themes/page/theme.css`);
    expect(css.status).toBe(200);
    expect(css.body).toContain('.x{}');
    expect((await fetchText(`${server.url}/nope`)).status).toBe(404);
  });

  it('pushes one-way SSE events', async () => {
    const sse = await openSse(`${server.url}/events`);
    const got = sse.next();
    server.push('reload', { source: 'test' });
    const ev = await got;
    expect(ev).toContain('event: reload');
    expect(ev).toContain('"source":"test"');
    sse.close();
  });
});
