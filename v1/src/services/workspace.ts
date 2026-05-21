import { join } from 'node:path';
import { ensureDir, pathExists, writeFileAtomic } from '../adapters/fs.js';
import * as git from '../adapters/git.js';
import * as github from '../adapters/github.js';
import { paths } from '../shared/paths.js';

export interface CreateWorkspaceInput {
  ghUser: string;
  repoName: string;
  owner: string;
}

export async function createWorkspaceRepo(
  input: CreateWorkspaceInput,
): Promise<{ fullName: string }> {
  const fullName = `${input.owner}/${input.repoName}`;
  const existing = await github.repoExists(fullName);

  if (existing) {
    if (!(await pathExists(paths.workspaceClone()))) {
      await git.clone(`https://github.com/${fullName}.git`, paths.workspaceClone());
    }
    return { fullName };
  }

  const repo = await github.createRepo({
    name: input.repoName,
    org: input.owner === input.ghUser ? undefined : input.owner,
    private: true,
    description: 'My personal Mirador workspace.',
  });
  await git.clone(repo.cloneUrl, paths.workspaceClone());
  return { fullName: repo.fullName };
}

export async function scaffoldWorkspace(): Promise<void> {
  const root = paths.workspaceClone();
  await ensureDir(join(root, 'brain'));
  await ensureDir(join(root, 'artifacts'));
  await ensureDir(join(root, 'incoming-requests'));
  await ensureDir(join(root, 'outgoing-requests'));
  await ensureDir(join(root, 'logs'));
  await writeFileAtomic(join(root, 'README.md'), DEFAULT_WORKSPACE_README);
  await writeFileAtomic(join(root, '.gitignore'), 'logs/\nnode_modules/\n');
}

const DEFAULT_WORKSPACE_README = `# My Mirador workspace

This is my private Mirador workspace. Drafts, brain, and request stubs live here.
Shared artifacts get promoted to standalone repos when I run \`mirador share\`.

Source of truth for the design: https://github.com/danielmedinac22/mirador
`;
