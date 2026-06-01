import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDir, pathExists } from '../src/adapters/fs.js';
import { createArtifact } from '../src/services/artifact.js';
import { renderPreview } from '../src/services/staticPreview.js';
import { planUpgrade, runUpgrade } from '../src/services/upgrade.js';
import { paths } from '../src/shared/paths.js';

const ENV = [
  'MIRADOR_HOME_OVERRIDE',
  'MIRADOR_AGENT',
  'MIRADOR_PROJECT_OVERRIDE',
  'CLAUDE_HOME_OVERRIDE',
] as const;

describe('CV-08 — migration from the publish-era', () => {
  let tmp: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const k of ENV) saved[k] = process.env[k];
    tmp = await mkdtemp(join(tmpdir(), 'mirador-cv08-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
    process.env.MIRADOR_AGENT = 'generic';
    process.env.MIRADOR_PROJECT_OVERRIDE = join(tmp, 'project');
    process.env.CLAUDE_HOME_OVERRIDE = join(tmp, '.claude');
    // A publish-era (alpha, non-v1) install: a config with a docs array + a
    // published HTML doc under site/d/<slug>/.
    await ensureDir(tmp);
    await writeFile(
      paths.configFile(),
      JSON.stringify({
        docs: [
          {
            slug: 'q2-report',
            title: 'Q2',
            url: 'https://x.vercel.app/d/q2-report/',
            visibility: 'unlisted',
          },
        ],
        vercel: { project: 'mirador-danielm', domain: 'mirador-danielm.vercel.app' },
        defaults: { theme: 'page' },
      }),
    );
    await ensureDir(join(tmp, 'site', 'd', 'q2-report'));
    await writeFile(
      join(tmp, 'site', 'd', 'q2-report', 'index.html'),
      '<h1>Q2 Report</h1><p>broadcast HTML</p>',
    );
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('plans broadcast migration + shim install, no brain-store seed', async () => {
    const kinds = (await planUpgrade()).map((a) => a.kind);
    expect(kinds).toContain('migrate-doc');
    expect(kinds).toContain('install-shim');
    expect(kinds).not.toContain('seed-brain');
  });

  it('keeps published HTML as broadcast-only; new artifacts are markdown++', async () => {
    const res = await runUpgrade({ ghHandle: 'danielm' });
    expect(res.migrated).toContain('q2-report');
    expect(res.shimAgent).toBe('claude'); // generic → fullest shim

    // Broadcast HTML survives, with a broadcast marker + preserved URL.
    const artDir = join(tmp, 'workspace', 'artifacts', 'q2-report');
    expect(await readFile(join(artDir, 'index.html'), 'utf8')).toContain('broadcast HTML');
    const legacy = JSON.parse(await readFile(join(artDir, '.mirador', 'legacy.json'), 'utf8'));
    expect(legacy.broadcast_only).toBe(true);
    expect(legacy.alpha_url).toContain('/d/q2-report/');

    // It renders via the escape hatch (viewable), with no markdown++ source.
    const view = await renderPreview(artDir, 'page');
    expect(view).toContain('broadcast HTML');
    expect(view).toContain('mirador-content');
    expect(await pathExists(join(artDir, 'source.md'))).toBe(false);

    // No brain store was created (brain = agent memory now).
    expect(await pathExists(join(tmp, 'workspace', 'brain'))).toBe(false);
    // The shim was installed.
    expect(await pathExists(join(tmp, '.claude', 'skills', 'mirador', 'SKILL.md'))).toBe(true);

    // New artifacts default to markdown++.
    await createArtifact({ slug: 'new-doc', purpose: 'fresh' });
    const newView = await renderPreview(join(tmp, 'workspace', 'artifacts', 'new-doc'), 'page');
    expect(newView).toContain('<h1 id="overview">new-doc</h1>');
  });

  it('harvests an old brain store once (hint), then leaves it', async () => {
    await ensureDir(join(tmp, 'workspace', 'brain'));
    await writeFile(join(tmp, 'workspace', 'brain', 'old.md'), '# old notes');
    const res = await runUpgrade({ ghHandle: 'danielm' });
    expect(res.brainHarvest).toMatch(/old brain store/);
  });
});
