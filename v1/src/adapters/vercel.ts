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

/**
 * Vercel free-tier accounts get URLs shaped like:
 *   https://<project>-<deployHash>-<scope>.vercel.app  ← deployment-specific
 *   https://<project>-<scope>.vercel.app               ← stable production alias
 *   https://<project>.vercel.app                       ← only on paid/single-account setups
 *
 * Derive the stable production URL by stripping the deployment-hash segment.
 * Returns the original deployUrl when we can't confidently parse it.
 */
export function deriveProductionUrl(deployUrl: string, projectName: string): string {
  let url: URL;
  try {
    url = new URL(deployUrl);
  } catch {
    return deployUrl;
  }
  const host = url.hostname;
  const tld = '.vercel.app';
  if (!host.endsWith(tld)) return deployUrl;
  const prefix = host.slice(0, -tld.length);
  if (!prefix.startsWith(`${projectName}-`)) {
    return prefix === projectName ? deployUrl : deployUrl;
  }
  const rest = prefix.slice(projectName.length + 1);
  const dashIdx = rest.indexOf('-');
  if (dashIdx === -1) {
    // No scope segment — fall back to bare project URL.
    return `https://${projectName}.vercel.app`;
  }
  const scope = rest.slice(dashIdx + 1);
  return `https://${projectName}-${scope}.vercel.app`;
}
