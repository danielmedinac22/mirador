import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_POINTER = join(homedir(), '.mirador-home');

export function pointerPath(): string {
  return process.env.MIRADOR_POINTER ?? DEFAULT_POINTER;
}

export function resolveRoot(): string {
  if (process.env.MIRADOR_HOME) return process.env.MIRADOR_HOME;
  const p = pointerPath();
  if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  return join(homedir(), '.mirador');
}

export function paths() {
  const root = resolveRoot();
  return {
    root,
    config: join(root, 'config.json'),
    site: join(root, 'site'),
    themes: join(root, 'themes'),
    templates: join(root, 'templates'),
    scripts: join(root, 'scripts'),
    logs: join(root, 'logs'),
  } as const;
}
