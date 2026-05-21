import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { paths } from './paths.js';

export interface MiradorConfig {
  version: 1;
  github: {
    handle: string;
    workspaceRepo: string;
    sharedReposNamespace: string;
  };
  vercel: {
    project: string;
    domain: string;
  };
  brain: {
    location: 'workspace' | 'separate-repo';
    repo?: string;
  };
  defaults: {
    theme: string;
    passwordPolicy: 'never' | 'always-ask' | 'always-on';
    visibility: 'unlisted' | 'public';
  };
  docs: never[];
}

export async function readConfig(): Promise<MiradorConfig | null> {
  try {
    const raw = await readFile(paths.configFile(), 'utf8');
    return JSON.parse(raw) as MiradorConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeConfig(cfg: MiradorConfig): Promise<void> {
  await mkdir(dirname(paths.configFile()), { recursive: true });
  await writeFile(paths.configFile(), `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
}
