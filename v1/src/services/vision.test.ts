import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOwner, isPlaceholderVision, readVision, setVision } from './vision.js';

describe('services/vision', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mirador-vision-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads the frontmatter vision and flags the scaffold placeholder', async () => {
    await writeFile(
      join(dir, 'source.md'),
      '---\nvision: TODO — one line on what this artifact is converging toward\n---\n\n# A {#a}\n\nx',
    );
    expect(isPlaceholderVision(await readVision(dir))).toBe(true);
  });

  it('setVision rewrites frontmatter while preserving sections', async () => {
    await writeFile(
      join(dir, 'source.md'),
      '---\nvision: TODO draft\n---\n\n# A {#a}\n\nalpha\n\n## B {#b}\n\nbravo',
    );
    await setVision(dir, 'board-ready Q3 narrative anchored on NRR');

    const v = await readVision(dir);
    expect(v).toBe('board-ready Q3 narrative anchored on NRR');
    expect(isPlaceholderVision(v)).toBe(false);

    const src = await readFile(join(dir, 'source.md'), 'utf8');
    expect(src).toContain('# A {#a}');
    expect(src).toContain('## B {#b}');
    expect(src).toContain('bravo');
  });

  it('isOwner: unshared (no manifest) is yours; a declared owner gates it', async () => {
    expect(await isOwner(dir, 'anyone')).toBe(true);
    await mkdir(join(dir, '.mirador'), { recursive: true });
    await writeFile(
      join(dir, '.mirador', 'manifest.json'),
      JSON.stringify({ slug: 'x', owner: 'daniel' }),
    );
    expect(await isOwner(dir, 'daniel')).toBe(true);
    expect(await isOwner(dir, 'maria')).toBe(false);
  });
});
