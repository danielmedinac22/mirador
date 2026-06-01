import { execa } from 'execa';

export async function clone(repoUrl: string, dest: string): Promise<void> {
  await execa('git', ['clone', repoUrl, dest]);
}

export async function init(dir: string): Promise<void> {
  await execa('git', ['init'], { cwd: dir });
}

export async function add(dir: string, paths: string[]): Promise<void> {
  await execa('git', ['add', ...paths], { cwd: dir });
}

export async function commit(dir: string, message: string): Promise<void> {
  await execa('git', ['commit', '-m', message], { cwd: dir });
}

export async function setRemote(dir: string, name: string, url: string): Promise<void> {
  await execa('git', ['remote', 'add', name, url], { cwd: dir });
}

export async function push(dir: string, branch = 'main', upstream = true): Promise<void> {
  const args = ['push'];
  if (upstream) args.push('-u', 'origin', branch);
  await execa('git', args, { cwd: dir });
}

export async function setMainBranch(dir: string): Promise<void> {
  await execa('git', ['branch', '-M', 'main'], { cwd: dir });
}

export async function gitVersion(): Promise<string> {
  const { stdout } = await execa('git', ['--version']);
  return stdout.trim();
}

export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--git-dir'], { cwd: dir });
    return true;
  } catch {
    return false;
  }
}

export async function hasUncommittedChanges(dir: string): Promise<boolean> {
  const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: dir });
  return stdout.trim().length > 0;
}

/** True if the repo has at least one configured remote. */
export async function hasRemote(dir: string): Promise<boolean> {
  try {
    const { stdout } = await execa('git', ['remote'], { cwd: dir });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/** Absolute path of the repo root containing `dir`, or null if not in a repo. */
export async function repoRoot(dir: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], { cwd: dir });
    return stdout.trim();
  } catch {
    return null;
  }
}

/** The current HEAD sha, or null if not a repo / no commits yet. */
export async function headSha(dir: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['rev-parse', 'HEAD'], { cwd: dir });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Commit shas in `(since, head]` (newest first). `since=null` → all of `head`'s
 * history. Returns [] if the range can't be resolved.
 */
export async function commitsBetween(
  dir: string,
  since: string | null,
  head = 'HEAD',
): Promise<string[]> {
  const range = since ? `${since}..${head}` : head;
  try {
    const { stdout } = await execa('git', ['log', '--format=%H', range], { cwd: dir });
    return stdout.trim() ? stdout.trim().split('\n') : [];
  } catch {
    return [];
  }
}

/**
 * Contents of `relPathFromRoot` at git `ref` (e.g. `HEAD`), or null if the file
 * does not exist at that ref / the dir is not a repo. `relPathFromRoot` is
 * resolved from the repo root with forward slashes, as `git show ref:path` expects.
 */
export async function showFileAtRef(
  dir: string,
  ref: string,
  relPathFromRoot: string,
): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['show', `${ref}:${relPathFromRoot}`], { cwd: dir });
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Commit ALL tracked + untracked changes under one paths spec. Returns the new
 * HEAD SHA. Used to auto-commit a workspace before subtree-split so the split
 * captures the latest state.
 */
export async function commitAll(dir: string, pathspec: string, message: string): Promise<string> {
  await execa('git', ['add', pathspec], { cwd: dir });
  await execa('git', ['commit', '-m', message], { cwd: dir });
  const { stdout } = await execa('git', ['rev-parse', 'HEAD'], { cwd: dir });
  return stdout.trim();
}

/**
 * Run `git subtree split --prefix=<prefix> HEAD` and return the SHA of the
 * resulting commit graph. The workspace tree is untouched; only a new commit
 * graph is created internally. Caller can push that SHA to a remote.
 */
export async function subtreeSplit(dir: string, prefix: string): Promise<string> {
  const { stdout } = await execa('git', ['subtree', 'split', `--prefix=${prefix}`, 'HEAD'], {
    cwd: dir,
  });
  return stdout.trim();
}

/**
 * Push a specific SHA to a remote ref. Used when we have a subtree-split SHA
 * and want it to become the main branch of a freshly-created remote repo.
 *
 * Example: pushRefspec('/path/to/workspace', 'https://github.com/x/y.git',
 *                       '<sha>', 'refs/heads/main')
 */
export async function pushRefspec(
  dir: string,
  remoteUrl: string,
  src: string,
  dest: string,
): Promise<void> {
  await execa('git', ['push', remoteUrl, `${src}:${dest}`], { cwd: dir });
}
