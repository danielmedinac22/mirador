#!/usr/bin/env node
/**
 * Tiny static HTTP server for the design preview at /tmp/mirador-design-preview.
 * Serves with the absolute paths the chrome CSS expects (/style.css, /fonts/...).
 * Keeps running until killed.
 *
 *   node v1/scripts/serve-design.mjs [port]
 */
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const PORT = Number(process.argv[2] ?? 7100);
const ROOT = '/tmp/mirador-design-preview';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const full = join(ROOT, p);
    if (!full.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    const s = await stat(full).catch(() => null);
    if (!s) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end(`404 ${p}`);
    }
    if (s.isDirectory()) {
      res.writeHead(302, { location: `${p}/` });
      return res.end();
    }
    const body = await readFile(full);
    const ct = MIME[extname(full).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': ct, 'cache-control': 'no-cache' });
    return res.end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(e?.message ?? e));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mirador design preview at http://127.0.0.1:${PORT}/`);
});
