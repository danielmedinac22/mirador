import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { structuredDiff } from '../src/services/changeLog.js';
import { readIntentNote } from '../src/services/intentNote.js';
import { commitRefinement } from '../src/services/refine.js';

/**
 * CV-02 integration: a refinement committed via the refine service writes an
 * intent sidecar + a one-line move trailer, and produces the structured diff the
 * next reader's handoff (CV-03) will consume.
 */
describe('CV-02 — refine → push (real git)', () => {
  let repo: string;

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'mirador-cv02-'));
    await execa('git', ['init'], { cwd: repo });
    await execa('git', ['config', 'user.email', 't@e.com'], { cwd: repo });
    await execa('git', ['config', 'user.name', 'T'], { cwd: repo });
    const base =
      '---\nvision: board-ready Q3 narrative\n---\n\n# Overview {#overview}\n\nalpha\n\n## Retention {#retention}\n\nNRR is fine.\n';
    await writeFile(join(repo, 'source.md'), base);
    await execa('git', ['add', '-A'], { cwd: repo });
    await execa('git', ['commit', '-m', 'init'], { cwd: repo });
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('writes the intent sidecar + move trailer; diff reports only the refined section', async () => {
    const sourcePath = join(repo, 'source.md');
    const base = await readFile(sourcePath, 'utf8');
    const edited = base.replace('NRR is fine.', 'NRR is 112% (source: Q2 board deck).');
    await writeFile(sourcePath, edited);

    const res = await commitRefinement(repo, {
      intent: 'Back the retention claim with the Q2 NRR figure and its source.',
      move: 'tighten',
      author: 'maria',
      offline: true,
    });

    expect(res.move).toBe('tighten');
    expect(res.pushed).toBe(false); // no remote

    // Sidecar keyed by the refinement sha.
    const note = await readIntentNote(repo, res.sha);
    expect(note?.author).toBe('maria');
    expect(note?.move).toBe('tighten');
    expect(note?.body).toContain('Q2 NRR figure');

    // The refinement commit carries the one-line move trailer; subject is the summary.
    const { stdout: msg } = await execa('git', ['show', '-s', '--format=%B', res.sha], {
      cwd: repo,
    });
    expect(msg).toMatch(/^Back the retention claim/);
    expect(msg).toContain('Mirador-Move: tighten');

    // The structured diff the next reader consumes: only §retention changed.
    const d = structuredDiff(base, edited);
    expect(d.changes).toEqual([
      { anchor: 'retention', headingText: 'Retention', kind: 'modified' },
    ]);
  });
});
