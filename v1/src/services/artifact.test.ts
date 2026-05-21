import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createArtifact, resolveArtifactPath } from './artifact.js';

describe('services/artifact', () => {
  let tmp: string;
  const original = process.env.MIRADOR_HOME_OVERRIDE;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-artifact-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.MIRADOR_HOME_OVERRIDE = original;
  });

  it('createArtifact creates folder + CONTEXT.md', async () => {
    const { path } = await createArtifact({
      slug: 'q2-draft',
      purpose: 'Q2 forecast',
      audience: 'the board',
    });
    expect(path).toContain('q2-draft');
    const ctx = await readFile(join(path, 'CONTEXT.md'), 'utf8');
    expect(ctx).toContain('# q2-draft');
    expect(ctx).toContain('Q2 forecast');
    expect(ctx).toContain('the board');
  });

  it('createArtifact uses placeholders when fields are omitted', async () => {
    const { path } = await createArtifact({ slug: 'untitled-1' });
    const ctx = await readFile(join(path, 'CONTEXT.md'), 'utf8');
    expect(ctx).toContain('(not specified yet');
  });

  it('createArtifact errors when artifact already exists', async () => {
    await createArtifact({ slug: 'dupe' });
    await expect(createArtifact({ slug: 'dupe' })).rejects.toThrow(/already exists/);
  });

  it('rejects invalid slugs', async () => {
    await expect(createArtifact({ slug: 'BadName' })).rejects.toThrow(/Invalid|invalid/);
    await expect(createArtifact({ slug: 'no_underscore' })).rejects.toThrow();
    await expect(createArtifact({ slug: '-leading' })).rejects.toThrow();
    await expect(createArtifact({ slug: 'trailing-' })).rejects.toThrow();
    await expect(createArtifact({ slug: '' })).rejects.toThrow();
  });

  it('accepts valid slugs', async () => {
    await expect(createArtifact({ slug: 'q3-forecast' })).resolves.toBeTruthy();
    await expect(createArtifact({ slug: 'plan2026' })).resolves.toBeTruthy();
    await expect(createArtifact({ slug: 'a' })).resolves.toBeTruthy();
    await expect(createArtifact({ slug: 'q' })).resolves.toBeTruthy();
  });

  it('resolveArtifactPath returns folder for existing artifact', async () => {
    await createArtifact({ slug: 'present' });
    expect(await resolveArtifactPath('present')).toContain('present');
  });

  it('resolveArtifactPath errors for missing artifact', async () => {
    await expect(resolveArtifactPath('missing')).rejects.toThrow(/not found/);
  });
});
