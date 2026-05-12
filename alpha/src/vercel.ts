import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function checkInstalled(): Promise<{ ok: true; version: string } | { ok: false }> {
  try {
    const { stdout } = await run('vercel', ['--version']);
    return { ok: true, version: stdout.trim() };
  } catch {
    return { ok: false };
  }
}

export async function checkAuth(): Promise<{ ok: true; user: string } | { ok: false }> {
  try {
    const { stdout } = await run('vercel', ['whoami']);
    return { ok: true, user: stdout.trim() };
  } catch {
    return { ok: false };
  }
}

export function loginInteractive(): number {
  const r = spawnSync('vercel', ['login'], { stdio: 'inherit' });
  return r.status ?? 1;
}

export interface LinkResult {
  projectId: string;
  orgId: string;
}

export async function linkProject(projectName: string): Promise<LinkResult> {
  const stage = mkdtempSync(join(tmpdir(), 'mirador-link-'));
  const r = spawnSync('vercel', ['link', '--yes', '--name', projectName], {
    cwd: stage,
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error(`vercel link failed (status ${r.status})`);
  const raw = await readFile(join(stage, '.vercel', 'project.json'), 'utf8');
  const parsed = JSON.parse(raw) as { projectId: string; orgId: string };
  return parsed;
}

interface RunResult {
  stdout: string;
  stderr: string;
}

function run(cmd: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (b) => {
      stdout += b.toString();
    });
    proc.stderr.on('data', (b) => {
      stderr += b.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.trim()}`));
    });
  });
}
