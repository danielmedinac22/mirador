import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { execa } from 'execa';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerView } from '../src/commands/view.js';
import { generateState, parseDocs, readIntents, readState } from '../src/services/view.js';

// ── a stub viewer: register + put, stores the last pushed html ───────────────

let stub: Server;
let stubUrl: string;
const pushed = new Map<string, string>();
let issuedToken = '';

beforeAll(async () => {
  stub = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      if (req.method === 'POST' && req.url === '/api/artifacts') {
        issuedToken = `tok-${Math.random().toString(36).slice(2)}`;
        const slug = `slug-${Math.random().toString(36).slice(2, 10)}`;
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ slug, writeToken: issuedToken, url: `${stubUrl}/v/${slug}` }));
        return;
      }
      const m = req.url?.match(/^\/api\/artifacts\/([^/]+)$/);
      if (req.method === 'PUT' && m) {
        if (req.headers.authorization !== `Bearer ${issuedToken}`) {
          res.writeHead(401);
          res.end();
          return;
        }
        pushed.set(m[1] ?? '', body);
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });
  await new Promise<void>((resolve) => stub.listen(0, resolve));
  const address = stub.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  stubUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise((resolve) => stub.close(resolve));
});

// ── fixture: a doc folder inside a real git repo with a remote ───────────────

const FUNCIONAL = `---
title: Definición funcional — Close Management × CLI
---

# Definición funcional {#definicion-funcional}

Intro del feature.

## Contexto y propósito

Los operadores del cierre certifican en batch.

## Alcance

Primera ola: reconciliar, justificar, certificar.
`;

const RFC = `# RFC BE {#rfc-be}

## Contratos

El envelope es {ok, data}.
`;

let tmp: string;
let repo: string;
let artifact: string;

function program(): Command {
  const p = new Command();
  p.exitOverride();
  registerView(p);
  return p;
}

async function run(args: string[]): Promise<void> {
  await program().parseAsync(['view', ...args], { from: 'user' });
}

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'mirador-vl02-'));
  repo = join(tmp, 'docs-repo');
  artifact = join(repo, 'versiones', 'close-cli');
  await execa('mkdir', ['-p', artifact]);
  await execa('git', ['init'], { cwd: repo });
  await execa('git', ['config', 'user.email', 't@e.com'], { cwd: repo });
  await execa('git', ['config', 'user.name', 'daniel'], { cwd: repo });
  await execa('git', ['remote', 'add', 'origin', 'https://github.com/acme/docs.git'], {
    cwd: repo,
  });
  await writeFile(join(artifact, 'definicion-funcional.md'), FUNCIONAL);
  await writeFile(join(artifact, 'rfc-be.md'), RFC);
  await execa('git', ['add', '-A'], { cwd: repo });
  await execa('git', ['commit', '-m', 'seed'], { cwd: repo });
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('VL-02 — view init', () => {
  it('scaffolds .mirador/, installs the skill at the repo root, registers and pushes', async () => {
    await run(['init', artifact, '--viewer', stubUrl, '--title', 'Close Management × CLI']);

    expect(existsSync(join(artifact, '.mirador', 'config.json'))).toBe(true);
    expect(existsSync(join(artifact, '.mirador', 'vision.md'))).toBe(true);
    expect(existsSync(join(artifact, '.mirador', 'state.yml'))).toBe(true);
    expect(existsSync(join(repo, '.claude', 'skills', 'mirador', 'SKILL.md'))).toBe(true);

    const config = JSON.parse(await readFile(join(artifact, '.mirador', 'config.json'), 'utf8'));
    expect(config.viewer).toBe(stubUrl);
    expect(config.docs).toEqual(['definicion-funcional.md', 'rfc-be.md']);

    const html = pushed.get(config.slug);
    expect(html).toBeDefined();
    expect(html).toContain('Close Management × CLI');
    expect(html).toContain('Los operadores del cierre certifican en batch.');
    expect(html).toContain('El envelope es {ok, data}.');
    expect(html).toContain('@mirador-view');
    expect(html).toContain('https://github.com/acme/docs.git');
    expect(html).toContain('versiones/close-cli');
    expect(html).toContain('/themes/page/theme.css');
  });

  it('never leaks the write token into the rendered page', async () => {
    await run(['init', artifact, '--viewer', stubUrl]);
    const config = JSON.parse(await readFile(join(artifact, '.mirador', 'config.json'), 'utf8'));
    const html = pushed.get(config.slug) ?? '';
    expect(config.writeToken.length).toBeGreaterThan(5);
    expect(html).not.toContain(config.writeToken);
  });

  it('generates one open section per heading (depth ≤ 2)', async () => {
    const docs = await parseDocs(artifact, ['definicion-funcional.md']);
    const state = generateState(docs);
    const sections = state.docs['definicion-funcional.md']?.sections ?? [];
    expect(sections.map((s) => s.anchor)).toEqual([
      'definicion-funcional',
      'contexto-y-proposito',
      'alcance',
    ]);
    expect(sections.every((s) => s.status === 'open')).toBe(true);
  });

  it('refuses a second init (the link already exists)', async () => {
    await run(['init', artifact, '--viewer', stubUrl]);
    await expect(run(['init', artifact, '--viewer', stubUrl])).rejects.toThrow(
      /already has a registered view/,
    );
  });

  it('refuses a folder without markdown documents', async () => {
    const empty = join(tmp, 'empty');
    await execa('mkdir', ['-p', empty]);
    await expect(run(['init', empty, '--viewer', stubUrl])).rejects.toThrow(/No markdown/);
  });
});

describe('VL-02 — view push', () => {
  it('refuses to push before init', async () => {
    await expect(run(['push', artifact])).rejects.toThrow(/no registered view/);
  });

  it('re-renders state, vision and intents into the updated view', async () => {
    await run(['init', artifact, '--viewer', stubUrl, '--title', 'Close CLI']);
    const config = JSON.parse(await readFile(join(artifact, '.mirador', 'config.json'), 'utf8'));

    await writeFile(
      join(artifact, '.mirador', 'vision.md'),
      '---\nowner: daniel\n---\n\nDefinición funcional v2.9 lista para convergencia.\n',
    );
    const state = await readState(artifact);
    const fSections = state.docs['definicion-funcional.md']?.sections ?? [];
    const alcance = fSections.find((s) => s.anchor === 'alcance');
    if (alcance) {
      alcance.status = 'contested';
      alcance.owner = 'po';
    }
    const { stringify } = await import('yaml');
    await writeFile(join(artifact, '.mirador', 'state.yml'), stringify(state));
    await writeFile(
      join(artifact, '.mirador', 'intents', '2026-06-10-po-alcance.md'),
      '---\nauthor: po\ndate: 2026-06-10\ndocs: [definicion-funcional.md]\nsections: [alcance]\nmove: challenge\n---\nLa primera ola debería incluir coa diff — es la cuña competitiva.\n',
    );

    await run(['push', artifact]);
    const html = pushed.get(config.slug) ?? '';
    expect(html).toContain('Definición funcional v2.9 lista para convergencia.');
    expect(html).toContain('contested');
    expect(html).toContain('La primera ola debería incluir coa diff');
    expect(html).toContain('challenge');
  });

  it('reads intents newest-first', async () => {
    await run(['init', artifact, '--viewer', stubUrl]);
    await writeFile(
      join(artifact, '.mirador', 'intents', '2026-06-08-daniel-a.md'),
      '---\nauthor: daniel\ndate: 2026-06-08\n---\nold\n',
    );
    await writeFile(
      join(artifact, '.mirador', 'intents', '2026-06-10-po-b.md'),
      '---\nauthor: po\ndate: 2026-06-10\n---\nnew\n',
    );
    const intents = await readIntents(artifact);
    expect(intents.map((i) => i.body)).toEqual(['new', 'old']);
  });
});
