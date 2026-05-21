import { execa } from 'execa';
import { ERRORS, MiradorError } from '../shared/errors.js';

export interface CreateRepoOptions {
  name: string;
  org?: string;
  private: boolean;
  description?: string;
}

export async function createRepo(
  opts: CreateRepoOptions,
): Promise<{ fullName: string; cloneUrl: string }> {
  const endpoint = opts.org ? `/orgs/${opts.org}/repos` : '/user/repos';
  const args = ['api', '-X', 'POST', endpoint, '-f', `name=${opts.name}`];
  if (opts.private) args.push('-F', 'private=true');
  else args.push('-F', 'private=false');
  if (opts.description) args.push('-f', `description=${opts.description}`);

  try {
    const { stdout } = await execa('gh', args);
    const data = JSON.parse(stdout) as { full_name: string; clone_url: string };
    return { fullName: data.full_name, cloneUrl: data.clone_url };
  } catch (err) {
    throw new MiradorError(
      ERRORS.GITHUB_API,
      `Failed to create repo: ${(err as Error).message}`,
      'Verify your gh auth has `repo` scope.',
    );
  }
}

export async function repoExists(fullName: string): Promise<boolean> {
  try {
    await execa('gh', ['api', `/repos/${fullName}`]);
    return true;
  } catch {
    return false;
  }
}
