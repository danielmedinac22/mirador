import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldBrain } from './brain.js';

describe('services/brain', () => {
  let tmp: string;
  const original = process.env.MIRADOR_HOME_OVERRIDE;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-brain-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.MIRADOR_HOME_OVERRIDE = original;
  });

  it('writes MEMORY.md + 3 brain files in workspace/brain/', async () => {
    await scaffoldBrain({
      role: 'PEM',
      reviewFocus: 'scope and timelines',
      authorAudience: 'company-wide',
      domain: 'fintech LatAm',
      preferences: 'tables not prose',
    });

    const root = join(tmp, 'workspace', 'brain');
    const memory = await readFile(join(root, 'MEMORY.md'), 'utf8');
    const prefs = await readFile(join(root, 'preferences.md'), 'utf8');
    const author = await readFile(join(root, 'role-author.md'), 'utf8');
    const reviewer = await readFile(join(root, 'role-reviewer.md'), 'utf8');

    expect(memory).toContain('preferences');
    expect(memory).toContain('role-author');
    expect(memory).toContain('role-reviewer');

    expect(prefs).toContain('fintech LatAm');
    expect(prefs).toContain('tables not prose');
    expect(prefs).toMatch(/^---\nname: preferences/);

    expect(author).toContain('company-wide');
    expect(author).toContain('PEM');
    expect(author).toMatch(/applies_to_role: author/);

    expect(reviewer).toContain('scope and timelines');
    expect(reviewer).toMatch(/applies_to_role: reviewer/);
  });

  it('falls back to defaults when answers are empty', async () => {
    await scaffoldBrain({
      role: '',
      reviewFocus: '',
      authorAudience: '',
      domain: '',
      preferences: '',
    });

    const root = join(tmp, 'workspace', 'brain');
    const prefs = await readFile(join(root, 'preferences.md'), 'utf8');
    const reviewer = await readFile(join(root, 'role-reviewer.md'), 'utf8');

    expect(prefs).toContain('general knowledge work');
    expect(prefs).toContain('Prefer tables over prose');
    expect(reviewer).toContain('scope, timelines, and failure modes');
  });
});
