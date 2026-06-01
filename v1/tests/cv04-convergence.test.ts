import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { arbitrationFor, computeConvergence } from '../src/services/convergence.js';
import { isConflict } from '../src/services/document/index.js';
import { markdownImpl } from '../src/services/document/markdown.js';
import { commitRefinement } from '../src/services/refine.js';

describe('CV-04 — convergence state + arbitration (real git)', () => {
  let repo: string;

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'mirador-cv04-'));
    await execa('git', ['init'], { cwd: repo });
    await execa('git', ['config', 'user.email', 't@e.com'], { cwd: repo });
    await execa('git', ['config', 'user.name', 'T'], { cwd: repo });
    const base =
      '---\nvision: board-ready Q3 narrative\n---\n\n# Overview {#overview}\n\nintro\n\n## Timeline {#timeline}\n\nQ3.\n\n## Retention {#retention}\n\nNRR fine.\n\n## Appendix {#appendix}\n\nstuff\n';
    await writeFile(join(repo, 'source.md'), base);
    await execa('git', ['add', '-A'], { cwd: repo });
    await execa('git', ['commit', '-m', 'seed'], { cwd: repo });
  });
  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  async function refine(find: string, replace: string, move: string): Promise<void> {
    const p = join(repo, 'source.md');
    await writeFile(p, (await readFile(p, 'utf8')).replace(find, replace));
    await commitRefinement(repo, {
      intent: `change ${replace}`,
      move,
      author: 'maria',
      offline: true,
    });
  }

  it('computes locked / contested / open from intent moves', async () => {
    await refine('NRR fine.', 'NRR is 112%.', 'critique'); // retention → contested
    await refine('Q3.', 'Q4 with a named owner.', 'endorse'); // timeline → locked

    const state = await computeConvergence(repo);
    const byAnchor = new Map(state.sections.map((s) => [s.anchor, s.state]));
    expect(byAnchor.get('timeline')).toBe('locked');
    expect(byAnchor.get('retention')).toBe('contested');
    expect(byAnchor.get('appendix')).toBe('open');
    expect(byAnchor.get('overview')).toBe('open');
    expect(state.vision).toContain('board-ready');
  });

  it('a later endorse locks a previously contested section', async () => {
    await refine('NRR fine.', 'NRR questionable', 'question'); // contested
    await refine('NRR questionable', 'NRR is 112% (sourced).', 'endorse'); // → locked
    const state = await computeConvergence(repo);
    expect(state.sections.find((s) => s.anchor === 'retention')?.state).toBe('locked');
  });

  it('arbitrationFor routes a same-section conflict to the owner with both sides', () => {
    const result = markdownImpl.merge(
      markdownImpl.parse('# A {#a}\n\nbase'),
      markdownImpl.parse('# A {#a}\n\nOURS'),
      markdownImpl.parse('# A {#a}\n\nTHEIRS'),
    );
    expect(isConflict(result)).toBe(true);
    if (isConflict(result)) {
      const arb = arbitrationFor(result, 'daniel');
      expect(arb).toHaveLength(1);
      expect(arb[0]).toMatchObject({
        anchor: 'a',
        owner: 'daniel',
        ours: 'OURS',
        theirs: 'THEIRS',
      });
    }
  });
});
