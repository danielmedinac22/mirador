import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDir } from '../src/adapters/fs.js';
import { type Cockpit, startCockpit } from '../src/services/cockpit.js';

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let body = '';
      res.on('data', (c) => {
        body += c;
      });
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}
function openSse(url: string): Promise<{ next: () => Promise<string>; close: () => void }> {
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

const ENV = ['MIRADOR_HOME_OVERRIDE', 'MIRADOR_AGENT', 'MIRADOR_PROJECT_OVERRIDE'] as const;

describe('CV-05 — cockpit (mirror + convergence surface)', () => {
  let tmp: string;
  let workspace: string;
  let artifactPath: string;
  let cockpit: Cockpit | null = null;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const k of ENV) saved[k] = process.env[k];
    tmp = await mkdtemp(join(tmpdir(), 'mirador-cv05-'));
    workspace = join(tmp, 'workspace');
    artifactPath = join(workspace, 'artifacts', 'demo');
    await ensureDir(artifactPath);
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
    process.env.MIRADOR_AGENT = 'generic';
    process.env.MIRADOR_PROJECT_OVERRIDE = join(tmp, 'project');
    await execa('git', ['init'], { cwd: workspace });
    await execa('git', ['config', 'user.email', 't@e.com'], { cwd: workspace });
    await execa('git', ['config', 'user.name', 'T'], { cwd: workspace });
    await writeFile(
      join(artifactPath, 'source.md'),
      '---\nvision: board-ready\n---\n\n# Overview {#overview}\n\nintro\n\n## Timeline {#timeline}\n\nLaunch in Q3.\n',
    );
    await execa('git', ['add', '-A'], { cwd: workspace });
    await execa('git', ['commit', '-m', 'seed'], { cwd: workspace });
  });

  afterEach(async () => {
    await cockpit?.stop();
    cockpit = null;
    await rm(tmp, { recursive: true, force: true });
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('mirrors the rendered view on localhost', async () => {
    cockpit = await startCockpit({ slug: 'demo', theme: 'page' });
    expect(cockpit.url).toContain('127.0.0.1');
    const view = await fetchText(`${cockpit.url}/view`);
    expect(view).toContain('class="mirador-content"');
    expect(view).toContain('Launch in Q3');
    const shell = await fetchText(`${cockpit.url}/`);
    expect(shell).toContain('read-only mirror');
  });

  it('pushes a reload on refresh and surfaces a handoff on a new commit', async () => {
    cockpit = await startCockpit({ slug: 'demo', theme: 'page' });

    const sse = await openSse(`${cockpit.url}/events`);
    const reload = sse.next();
    cockpit.refresh();
    expect(await reload).toContain('event: reload');
    sse.close();

    // A new commit lands → checkRemote surfaces the handoff.
    const p = join(artifactPath, 'source.md');
    await writeFile(p, (await readFile(p, 'utf8')).replace('Launch in Q3.', 'Launch in Q4.'));
    await execa('git', ['commit', '-am', 'refine'], { cwd: workspace });

    const sse2 = await openSse(`${cockpit.url}/events`);
    const surfaced = sse2.next();
    const did = await cockpit.checkRemote();
    expect(did).toBe(true);
    expect(await surfaced).toContain('handoff');
    sse2.close();
  });
});
