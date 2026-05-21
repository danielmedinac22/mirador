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

export async function addCollaborator(repo: string, handle: string): Promise<void> {
  try {
    await execa('gh', [
      'api',
      '-X',
      'PUT',
      `/repos/${repo}/collaborators/${handle}`,
      '-f',
      'permission=push',
    ]);
  } catch (err) {
    throw new MiradorError(
      ERRORS.GITHUB_API,
      `Failed to add collaborator ${handle}: ${(err as Error).message}`,
    );
  }
}

export async function archiveRepo(repo: string): Promise<void> {
  try {
    await execa('gh', ['api', '-X', 'PATCH', `/repos/${repo}`, '-F', 'archived=true']);
  } catch (err) {
    throw new MiradorError(
      ERRORS.GITHUB_API,
      `Failed to archive ${repo}: ${(err as Error).message}`,
    );
  }
}

export async function resolveEmailToHandle(email: string): Promise<string | null> {
  // GitHub search by email. Falls back to using the local-part as handle.
  try {
    const { stdout } = await execa('gh', [
      'api',
      `/search/users?q=${encodeURIComponent(`${email} in:email`)}`,
    ]);
    const data = JSON.parse(stdout) as { items?: Array<{ login: string }> };
    return data.items?.[0]?.login ?? null;
  } catch {
    return null;
  }
}
