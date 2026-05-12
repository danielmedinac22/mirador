import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { paths } from './paths.js';

export type AgentKey = 'claude-code' | 'codex' | 'other';
export type PasswordPolicy = 'always-ask' | 'never' | 'always-on';
export type Visibility = 'unlisted' | 'public';

export interface VercelInfo {
  projectId: string;
  projectName: string;
  domain: string;
  orgId: string;
}

export interface DocRecord {
  slug: string;
  title: string;
  theme: string;
  passwordProtected: boolean;
  visibility: Visibility;
  url: string;
  createdAt: string;
}

export interface Config {
  version: 1;
  storage_path: string;
  vercel: VercelInfo;
  agents: AgentKey[];
  defaults: {
    theme: string;
    password_policy: PasswordPolicy;
    visibility: Visibility;
  };
  docs: DocRecord[];
}

export async function readConfig(): Promise<Config | null> {
  try {
    const raw = await readFile(paths().config, 'utf8');
    return JSON.parse(raw) as Config;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function writeConfig(c: Config): Promise<void> {
  await mkdir(dirname(paths().config), { recursive: true });
  await writeFile(paths().config, JSON.stringify(c, null, 2), 'utf8');
}
