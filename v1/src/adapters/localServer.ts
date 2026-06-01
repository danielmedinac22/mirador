import { readFile } from 'node:fs/promises';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { pathExists } from './fs.js';

/**
 * The cockpit's local server (design §12, §18): a tiny **localhost-only**,
 * **one-way** HTTP + SSE server. It serves the rendered view and pushes reload /
 * handoff events to the browser. It is a window onto the session — never an
 * editing channel, never published. Bound to 127.0.0.1 by default.
 */

export interface CockpitServer {
  url: string;
  port: number;
  /** Push a one-way SSE event to all connected browsers. */
  push: (event: string, data: unknown) => void;
  close: () => Promise<void>;
}

export interface ServeOptions {
  /** The cockpit chrome page (served at `/`). */
  shell: () => string;
  /** The current rendered artifact HTML (served at `/view`). */
  view: () => string | Promise<string>;
  /** Optional static root (site-assets) for theme css / fonts / icons. */
  staticRoot?: string;
  port?: number;
  host?: string;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
};

export async function startCockpitServer(opts: ServeOptions): Promise<CockpitServer> {
  const host = opts.host ?? '127.0.0.1';
  const clients = new Set<ServerResponse>();

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = (req.url ?? '/').split('?')[0] ?? '/';
    if (url === '/' || url === '/index.html') {
      send(res, 200, 'text/html; charset=utf-8', opts.shell());
      return;
    }
    if (url === '/view') {
      send(res, 200, 'text/html; charset=utf-8', await opts.view());
      return;
    }
    if (url === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (opts.staticRoot && (await serveStatic(opts.staticRoot, url, res))) return;
    send(res, 404, 'text/plain; charset=utf-8', 'not found');
  }

  await new Promise<void>((resolve) => {
    server.listen(opts.port ?? 0, host, () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;

  return {
    url: `http://${host}:${port}`,
    port,
    push(event, data) {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const c of clients) c.write(payload);
    },
    close() {
      return new Promise<void>((resolve) => {
        for (const c of clients) c.end();
        clients.clear();
        server.close(() => resolve());
      });
    },
  };
}

function send(res: ServerResponse, code: number, type: string, body: string): void {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
}

async function serveStatic(root: string, url: string, res: ServerResponse): Promise<boolean> {
  const rel = normalize(decodeURIComponent(url)).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = join(root, rel);
  if (!full.startsWith(root)) return false; // path-traversal guard
  if (!(await pathExists(full))) return false;
  const buf = await readFile(full).catch(() => null);
  if (!buf) return false;
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream',
  });
  res.end(buf);
  return true;
}
