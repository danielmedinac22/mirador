import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../adapters/github.js', () => ({
  repoExists: vi.fn(),
  createRepo: vi.fn(),
}));

vi.mock('../adapters/git.js', () => ({
  clone: vi.fn(),
}));

const { createWorkspaceRepo, scaffoldWorkspace } = await import('./workspace.js');
const github = await import('../adapters/github.js');
const git = await import('../adapters/git.js');

describe('services/workspace', () => {
  let tmp: string;
  const original = process.env.MIRADOR_HOME_OVERRIDE;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-ws-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.MIRADOR_HOME_OVERRIDE = original;
  });

  describe('createWorkspaceRepo', () => {
    it('creates a new repo when it does not exist', async () => {
      vi.mocked(github.repoExists).mockResolvedValue(false);
      vi.mocked(github.createRepo).mockResolvedValue({
        fullName: 'alice/alice-mirador',
        cloneUrl: 'https://github.com/alice/alice-mirador.git',
      });
      vi.mocked(git.clone).mockResolvedValue();

      const result = await createWorkspaceRepo({
        ghUser: 'alice',
        repoName: 'alice-mirador',
        owner: 'alice',
      });

      expect(result.fullName).toBe('alice/alice-mirador');
      expect(github.createRepo).toHaveBeenCalledWith({
        name: 'alice-mirador',
        org: undefined,
        private: true,
        description: expect.any(String),
      });
      expect(git.clone).toHaveBeenCalledOnce();
    });

    it('passes org through when owner !== ghUser', async () => {
      vi.mocked(github.repoExists).mockResolvedValue(false);
      vi.mocked(github.createRepo).mockResolvedValue({
        fullName: 'simetrik/alice-mirador',
        cloneUrl: 'https://github.com/simetrik/alice-mirador.git',
      });
      vi.mocked(git.clone).mockResolvedValue();

      await createWorkspaceRepo({
        ghUser: 'alice',
        repoName: 'alice-mirador',
        owner: 'simetrik',
      });

      expect(github.createRepo).toHaveBeenCalledWith({
        name: 'alice-mirador',
        org: 'simetrik',
        private: true,
        description: expect.any(String),
      });
    });

    it('skips create when repo already exists and clone is present', async () => {
      vi.mocked(github.repoExists).mockResolvedValue(true);
      // Make pathExists return true by pre-creating the clone dir
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(tmp, 'workspace'), { recursive: true });

      const result = await createWorkspaceRepo({
        ghUser: 'alice',
        repoName: 'alice-mirador',
        owner: 'alice',
      });

      expect(result.fullName).toBe('alice/alice-mirador');
      expect(github.createRepo).not.toHaveBeenCalled();
      expect(git.clone).not.toHaveBeenCalled();
    });

    it('clones when repo exists but local clone is missing', async () => {
      vi.mocked(github.repoExists).mockResolvedValue(true);
      vi.mocked(git.clone).mockResolvedValue();

      await createWorkspaceRepo({
        ghUser: 'alice',
        repoName: 'alice-mirador',
        owner: 'alice',
      });

      expect(github.createRepo).not.toHaveBeenCalled();
      expect(git.clone).toHaveBeenCalledOnce();
    });
  });

  describe('scaffoldWorkspace', () => {
    it('creates required directories + README + .gitignore', async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(tmp, 'workspace'), { recursive: true });

      await scaffoldWorkspace();

      const root = join(tmp, 'workspace');
      const readme = await readFile(join(root, 'README.md'), 'utf8');
      const gitignore = await readFile(join(root, '.gitignore'), 'utf8');

      expect(readme).toContain('mirador workspace');
      expect(gitignore).toContain('logs/');

      const { access } = await import('node:fs/promises');
      await expect(access(join(root, 'brain'))).resolves.toBeUndefined();
      await expect(access(join(root, 'artifacts'))).resolves.toBeUndefined();
      await expect(access(join(root, 'incoming-requests'))).resolves.toBeUndefined();
      await expect(access(join(root, 'outgoing-requests'))).resolves.toBeUndefined();
      await expect(access(join(root, 'logs'))).resolves.toBeUndefined();
    });
  });
});
