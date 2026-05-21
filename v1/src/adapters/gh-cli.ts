import { execa } from 'execa';
import { ERRORS, MiradorError } from '../shared/errors.js';

export async function ghAuthStatus(): Promise<{ user: string }> {
  try {
    const { stdout } = await execa('gh', ['api', 'user', '-q', '.login']);
    return { user: stdout.trim() };
  } catch {
    throw new MiradorError(
      ERRORS.PREFLIGHT_GH_AUTH,
      'GitHub CLI not authenticated.',
      'Run `gh auth login` and retry.',
    );
  }
}

export async function ghToken(): Promise<string> {
  const { stdout } = await execa('gh', ['auth', 'token']);
  return stdout.trim();
}
