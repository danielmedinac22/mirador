import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureDir } from './fs.js';
import {
  add,
  commit,
  commitAll,
  hasUncommittedChanges,
  init,
  isGitRepo,
  setMainBranch,
  subtreeSplit,
} from './git.js';

describe('adapters/git (real git, in tmp)', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-git-test-'));
    await init(tmp);
    await setMainBranch(tmp);
    // Configure a minimal git identity so commits don't fail in CI.
    const { execa } = await import('execa');
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: tmp });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: tmp });
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('isGitRepo true inside a repo, false outside', async () => {
    expect(await isGitRepo(tmp)).toBe(true);
    const outside = await mkdtemp(join(tmpdir(), 'mirador-no-git-'));
    try {
      expect(await isGitRepo(outside)).toBe(false);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('hasUncommittedChanges reflects working-tree state', async () => {
    expect(await hasUncommittedChanges(tmp)).toBe(false);
    await writeFile(join(tmp, 'a.txt'), 'hi');
    expect(await hasUncommittedChanges(tmp)).toBe(true);
    await add(tmp, ['a.txt']);
    await commit(tmp, 'init');
    expect(await hasUncommittedChanges(tmp)).toBe(false);
  });

  it('commitAll returns the new HEAD sha', async () => {
    await writeFile(join(tmp, 'a.txt'), 'one');
    const sha = await commitAll(tmp, '.', 'first');
    expect(sha).toMatch(/^[0-9a-f]{7,40}$/);
  });

  it('subtreeSplit returns the SHA of the subtree-only history', async () => {
    // Build a repo with two artifacts; each has one commit.
    await ensureDir(join(tmp, 'artifacts', 'q2'));
    await ensureDir(join(tmp, 'artifacts', 'q3'));
    await writeFile(join(tmp, 'artifacts', 'q2', 'a.md'), 'q2 first');
    await commitAll(tmp, '.', 'q2 first');
    await writeFile(join(tmp, 'artifacts', 'q3', 'a.md'), 'q3 first');
    await commitAll(tmp, '.', 'q3 first');
    await writeFile(join(tmp, 'artifacts', 'q2', 'a.md'), 'q2 second');
    await commitAll(tmp, '.', 'q2 second');

    const sha = await subtreeSplit(tmp, 'artifacts/q2');
    expect(sha).toMatch(/^[0-9a-f]{7,40}$/);

    // Verify the split SHA's tree contains only q2's files.
    const { execa } = await import('execa');
    const { stdout } = await execa('git', ['ls-tree', '-r', '--name-only', sha], { cwd: tmp });
    const files = stdout.trim().split('\n');
    expect(files).toEqual(['a.md']);

    // Verify the split log has 2 commits (q2 first, q2 second), not the q3 one.
    const { stdout: log } = await execa('git', ['log', '--oneline', sha], { cwd: tmp });
    const lines = log.trim().split('\n');
    expect(lines.length).toBe(2);
    expect(lines.join(' ')).toMatch(/q2 second.*q2 first/);
  });
});
