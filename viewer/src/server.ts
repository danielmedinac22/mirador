import { existsSync, readFileSync, statSync } from 'node:fs';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { FileStore, isValidSlug } from './store.js';

export interface ViewerOptions {
  dataDir: string;
  maxBytes?: number;
  publicBaseUrl?: string;
  assetsDir?: string;
}

const ASSET_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

/** Resolve a URL path inside assetsDir, refusing anything that escapes it. */
function resolveAsset(assetsDir: string, urlPath: string): string | null {
  const cleaned = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const full = resolve(assetsDir, cleaned);
  if (full !== resolve(assetsDir) && !full.startsWith(resolve(assetsDir) + sep)) return null;
  if (!existsSync(full) || !statSync(full).isFile()) return null;
  return full;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

const NOT_FOUND_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>mirador — not found</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#101014;color:#e8e8ec}
main{text-align:center;padding:2rem}h1{font-size:1.2rem;font-weight:600}p{color:#9a9aa4}</style></head>
<body><main><h1>This view doesn't exist (or was never pushed).</h1>
<p>Ask the artifact owner for a fresh link.</p></main></body></html>`;

const LANDING_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>mirador viewer</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#101014;color:#e8e8ec}
main{text-align:center;padding:2rem}h1{font-size:1.2rem;font-weight:600}p{color:#9a9aa4}code{background:#1c1c22;padding:.15em .4em;border-radius:4px}</style></head>
<body><main><h1>mirador viewer</h1>
<p>Views are pushed here by <code>mirador-cli</code> and served at unlisted URLs.<br>There is nothing to browse.</p></main></body></html>`;

function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer | 'too_large'> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        resolve('too_large');
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'x-robots-tag': 'noindex, nofollow',
    'referrer-policy': 'no-referrer',
  });
  res.end(html);
}

function bearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

export function createViewerServer(options: ViewerOptions): Server {
  const store = new FileStore(options.dataDir);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    try {
      if (req.method === 'GET' && path === '/healthz') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('ok');
        return;
      }

      if (req.method === 'GET' && path === '/') {
        sendHtml(res, 200, LANDING_PAGE);
        return;
      }

      if (req.method === 'POST' && path === '/api/artifacts') {
        const body = await readBody(req, 16 * 1024);
        if (body === 'too_large') {
          sendJson(res, 413, { error: 'payload_too_large' });
          return;
        }
        let title = 'untitled';
        if (body.length > 0) {
          try {
            const parsed = JSON.parse(body.toString('utf8')) as { title?: unknown };
            if (typeof parsed.title === 'string' && parsed.title.trim()) {
              title = parsed.title.trim().slice(0, 200);
            }
          } catch {
            sendJson(res, 400, { error: 'invalid_json' });
            return;
          }
        }
        const { slug, writeToken } = store.create(title);
        const base = options.publicBaseUrl ?? `http://${req.headers.host ?? 'localhost'}`;
        sendJson(res, 201, { slug, writeToken, url: `${base}/v/${slug}` });
        return;
      }

      const putMatch = path.match(/^\/api\/artifacts\/([^/]+)$/);
      if (req.method === 'PUT' && putMatch) {
        const slug = putMatch[1] ?? '';
        if (!isValidSlug(slug)) {
          sendJson(res, 404, { error: 'not_found' });
          return;
        }
        const token = bearerToken(req);
        if (!token) {
          sendJson(res, 401, { error: 'missing_token' });
          return;
        }
        const body = await readBody(req, maxBytes);
        if (body === 'too_large') {
          sendJson(res, 413, { error: 'payload_too_large', maxBytes });
          return;
        }
        const result = store.put(slug, token, body.toString('utf8'));
        if (result === 'not_found') {
          sendJson(res, 404, { error: 'not_found' });
          return;
        }
        if (result === 'unauthorized') {
          sendJson(res, 401, { error: 'bad_token' });
          return;
        }
        res.writeHead(204);
        res.end();
        return;
      }

      const viewMatch = path.match(/^\/v\/([^/]+)$/);
      if (req.method === 'GET' && viewMatch) {
        const html = store.getHtml(viewMatch[1] ?? '');
        if (html === null) {
          sendHtml(res, 404, NOT_FOUND_PAGE);
          return;
        }
        sendHtml(res, 200, html);
        return;
      }

      if (path.startsWith('/api/')) {
        sendJson(res, 404, { error: 'not_found' });
        return;
      }

      if (req.method === 'GET' && options.assetsDir) {
        const type = ASSET_TYPES[extname(path)];
        const file = type ? resolveAsset(options.assetsDir, path) : null;
        if (file && type) {
          res.writeHead(200, {
            'content-type': type,
            'cache-control': 'public, max-age=86400',
          });
          res.end(readFileSync(file));
          return;
        }
      }

      sendHtml(res, 404, NOT_FOUND_PAGE);
    } catch {
      sendJson(res, 500, { error: 'internal' });
    }
  });
}
