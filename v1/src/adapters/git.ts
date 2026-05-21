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
