import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDir } from '../src/adapters/fs.js';
import { createArtifact, resolveArtifactPath } from '../src/services/artifact.js';
import { sourceAtRef, structuredDiff } from '../src/services/changeLog.js';
import { renderPreview } from '../src/services/staticPreview.js';

/**
 * CV-00 integration: the substrate shift (markdown++ source → rendered view)
 * and the structured-diff path the `mirador diff` command runs.
 */
describe('CV-00 — document seam integration', () => {
  let tmp: string;
  const original = process.env.MIRADOR_HOME_OVERRIDE;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-cv00-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
    await ensureDir(join(tmp, 'workspace', 'artifacts'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.MIRADOR_HOME_OVERRIDE = original;
  });

  it('new → preview round-trips a markdown++ source into themed HTML', async () => {
    await createArtifact({
      slug: 'q3-strategy',
      purpose: 'Board Q3 narrative',
      audience: 'the board',
    });
    const artifactPath = await resolveArtifactPath('q3-strategy');

    const html = await renderPreview(artifactPath, 'atlas');
    expect(html).toContain('data-mirador-theme="atlas"');
    expect(html).toContain('<link rel="stylesheet" href="/themes/atlas/theme.css">');
    expect(html).toContain('<div class="mirador-content">');
    expect(html).toContain('<h1 id="overview">q3-strategy</h1>');
    expect(html).toContain('Board Q3 narrative');
    expect(html).toContain('<h2 id="audience">Audience</h2>');
  });

  it('diff (working source vs HEAD) reports only the edited section', async () => {
    const repo = join(tmp, 'repo');
    await ensureDir(repo);
    await execa('git', ['init'], { cwd: repo });
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: repo });

    const sourcePath = join(repo, 'source.md');
    const base = `${['# Overview {#overview}', '', 'alpha', '', '## Risks {#risks}', '', 'bravo'].join('\n')}\n`;
    await writeFile(sourcePath, base);
    await execa('git', ['add', 'source.md'], { cwd: repo });
    await execa('git', ['commit', '-m', 'init'], { cwd: repo });

    // Edit only §Risks in the working tree.
    const edited = base.replace('bravo', 'bravo — now with a churn note');
    await writeFile(sourcePath, edited);

    // The diff command's core: working tree vs HEAD via the shared resolver.
    const headSource = await sourceAtRef(repo, 'source.md', 'HEAD');
    if (headSource === null) throw new Error('HEAD source not found');

    const d = structuredDiff(headSource, edited);
    expect(d.changes).toEqual([{ anchor: 'risks', headingText: 'Risks', kind: 'modified' }]);
  });
});
