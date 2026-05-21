import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDir, writeFileAtomic } from '../adapters/fs.js';
import { brainRoot, listBrain, loadBrain } from './brain.js';

describe('services/brain — privacy boundary (structural)', () => {
  let tmp: string;
  const original = process.env.MIRADOR_HOME_OVERRIDE;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-brainpriv-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
    const brainDir = join(tmp, 'workspace', 'brain');
    await ensureDir(brainDir);
    await writeFileAtomic(
      join(brainDir, 'preferences.md'),
      '---\nname: preferences\ndescription: t\nmetadata:\n  type: brain\n---\nsecret content',
    );
    // Simulate a shared-clones dir to verify nothing gets written there
    await ensureDir(join(tmp, 'shared', 'fake-artifact'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.MIRADOR_HOME_OVERRIDE = original;
  });

  it('listBrain only touches files under workspace/brain/', async () => {
    const root = await brainRoot();
    const entries = await listBrain();
    for (const entry of entries) {
      expect(entry.path.startsWith(root)).toBe(true);
    }
  });

  it('loadBrain output never references a shared-repo path', async () => {
    const file = await loadBrain('preferences');
    expect(file.path).not.toContain(`${tmp}/shared/`);
    expect(file.path).toContain(`${tmp}/workspace/brain/`);
  });

  it('shared/ remains empty after brain operations', async () => {
    await listBrain();
    await loadBrain('preferences');
    const sharedSubs = await readdir(join(tmp, 'shared'));
    const fakeArtifactContents = await readdir(join(tmp, 'shared', 'fake-artifact'));
    expect(sharedSubs).toEqual(['fake-artifact']); // pre-existing dir untouched
    expect(fakeArtifactContents).toEqual([]); // nothing was written inside
  });
});
