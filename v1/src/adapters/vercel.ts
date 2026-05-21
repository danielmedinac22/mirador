import { execa } from 'execa';
import { ERRORS, MiradorError } from '../shared/errors.js';

export async function vercelWhoami(): Promise<{ user: string }> {
  try {
    const { stdout } = await execa('vercel', ['whoami']);
    return { user: stdout.trim() };
  } catch {
    throw new MiradorError(
      ERRORS.PREFLIGHT_VERCEL_AUTH,
      'Vercel CLI not authenticated.',
      'Run `vercel login` and retry.',
    );
  }
}

// Lazy: actual project creation happens on first deploy in VS-04.
// At init time we just commit to the intended project name.
export async function ensureProject(name: string): Promise<{ projectName: string }> {
  return { projectName: name };
}
