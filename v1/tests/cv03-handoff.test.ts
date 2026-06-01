import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDir } from '../src/adapters/fs.js';
import { assembleHandoff, renderHandoff } from '../src/services/handoff.js';
import { commitRefinement } from '../src/services/refine.js';
import { openSession } from '../src/services/session.js';
import { readLastSeen, updateLastSeen } from '../src/shared/lastSeen.js';

const ENV = ['MIRADOR_HOME_OVERRIDE', 'MIRADOR_AGENT', 'MIRADOR_PROJECT_OVERRIDE'] as const;

describe('CV-03 — handoff packet + open wiring (real git)', () => {
  let tmp: string;
  let workspace: string;
  let artifactPath: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const k of ENV) saved[k] = process.env[k];
    tmp = await mkdtemp(join(tmpdir(), 'mirador-cv03-'));
    workspace = join(tmp, 'workspace');
    artifactPath = join(workspace, 'artifacts', 'demo');
    await ensureDir(artifactPath);
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
    process.env.MIRADOR_AGENT = 'generic';
    process.env.MIRADOR_PROJECT_OVERRIDE = join(tmp, 'project'); // empty → generic pointer

    await execa('git', ['init'], { cwd: workspace });
    await execa('git', ['config', 'user.email', 't@e.com'], { cwd: workspace });
    await execa('git', ['config', 'user.name', 'T'], { cwd: workspace });
    const base =
      '---\nvision: board-ready Q3 narrative\n---\n\n# Overview {#overview}\n\nintro\n\n## Timeline {#timeline}\n\nLaunch in Q3.\n\n## Retention {#retention}\n\nNRR is fine.\n';
    await writeFile(join(artifactPath, 'source.md'), base);
    await execa('git', ['add', '-A'], { cwd: workspace });
    await execa('git', ['commit', '-m', 'seed'], { cwd: workspace });
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('assembles diff + intents + brain pointer since last-seen (no brain content)', async () => {
    const sha0 = (await execa('git', ['rev-parse', 'HEAD'], { cwd: workspace })).stdout.trim();
    await updateLastSeen('demo', {
      last_open_at: new Date().toISOString(),
      last_open_commit: sha0,
    });

    const src = join(artifactPath, 'source.md');
    const before = await readFile(src, 'utf8');
    await writeFile(src, before.replace('NRR is fine.', 'NRR is 112% (Q2 board deck).'));
    const res = await commitRefinement(artifactPath, {
      intent: 'Back the retention claim with the Q2 NRR figure.',
      move: 'tighten',
      author: 'maria',
      offline: true,
    });

    const packet = await assembleHandoff('demo');
    expect(packet.since).toBe(sha0);
    expect(packet.diff.changes).toEqual([
      { anchor: 'retention', headingText: 'Retention', kind: 'modified' },
    ]);
    expect(packet.intents.map((i) => i.sha)).toContain(res.sha);
    expect(packet.intents[0]?.note.sections).toEqual(['retention']);
    expect(packet.vision).toContain('board-ready');
    // brain pointer only — no content
    expect(packet.brainSource.agent).toBe('generic');
    expect(Object.keys(packet.brainSource).sort()).toEqual(['agent', 'label']);

    const text = renderHandoff(packet);
    expect(text).toContain('CHANGED SECTIONS');
    expect(text).toContain('§retention');
    expect(text).toContain('maria: Back the retention');
    expect(text).not.toContain('tighten'); // the move stays internal
  });

  it('open surfaces the handoff and advances last-seen to HEAD', async () => {
    const { brief } = await openSession('demo');
    expect(brief).toContain('handoff');
    const head = (await execa('git', ['rev-parse', 'HEAD'], { cwd: workspace })).stdout.trim();
    const store = await readLastSeen();
    expect(store.demo?.last_open_commit).toBe(head);
  });
});
