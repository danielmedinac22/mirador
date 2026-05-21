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

export async function ensureProject(name: string): Promise<{ projectName: string }> {
  return { projectName: name };
}

export async function deploySite(
  localDir: string,
  projectName: string,
): Promise<{ deployedUrl: string }> {
  try {
    const { stdout } = await execa('vercel', [
      'deploy',
      '--prod',
      localDir,
      '--yes',
      '--no-clipboard',
      `--name=${projectName}`,
    ]);
    const url = stdout.trim().split(/\s+/).pop() ?? '';
    return { deployedUrl: url };
  } catch (err) {
    throw new MiradorError(
      ERRORS.VERCEL_DEPLOY,
      `Vercel deploy failed: ${(err as Error).message}`,
      'Re-run with `mirador-v1 config --diagnose` to inspect.',
    );
  }
}
