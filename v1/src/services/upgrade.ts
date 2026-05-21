import { mkdir, readFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ensureDir, pathExists, writeFileAtomic } from '../adapters/fs.js';
import { readConfig, writeConfig } from '../shared/config.js';
import { paths } from '../shared/paths.js';

export interface UpgradeAction {
  kind: 'backup-alpha-config' | 'create-workspace' | 'migrate-doc' | 'seed-brain' | 'noop';
  detail: string;
}

export interface AlphaDoc {
  slug: string;
  title?: string;
  url?: string;
  visibility?: string;
}

interface AlphaConfig {
  defaults?: { theme?: string };
  docs?: AlphaDoc[];
  vercel?: { domain?: string; project?: string };
}

export async function detectAlpha(): Promise<{
  alphaConfig: AlphaConfig | null;
  v1Present: boolean;
}> {
  const cfgPath = paths.configFile();
  if (!(await pathExists(cfgPath))) return { alphaConfig: null, v1Present: false };
  const raw = await readFile(cfgPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { alphaConfig: null, v1Present: false };
  }
  const obj = parsed as {
    version?: unknown;
    docs?: AlphaDoc[];
    vercel?: { domain?: string; project?: string };
    defaults?: { theme?: string };
  };
  const isV1 = obj.version === 1;
  if (isV1) {
    return { alphaConfig: null, v1Present: true };
  }
  // Anything non-v1 with a docs array is treated as alpha.
  if (Array.isArray(obj.docs)) {
    return { alphaConfig: obj as AlphaConfig, v1Present: false };
  }
  return { alphaConfig: null, v1Present: false };
}

export async function planUpgrade(): Promise<UpgradeAction[]> {
  const { alphaConfig, v1Present } = await detectAlpha();
  if (v1Present) {
    return [{ kind: 'noop', detail: 'Already on v1 — nothing to upgrade.' }];
  }
  if (!alphaConfig) {
    return [{ kind: 'noop', detail: 'No alpha install detected.' }];
  }
  const actions: UpgradeAction[] = [];
  actions.push({
    kind: 'backup-alpha-config',
    detail: `Move ${paths.configFile()} → ${paths.configFile()}.alpha.bak`,
  });
  actions.push({
    kind: 'create-workspace',
    detail: `Create v1 workspace clone at ${paths.workspaceClone()}`,
  });
  for (const doc of alphaConfig.docs ?? []) {
    actions.push({
      kind: 'migrate-doc',
      detail: `Move alpha site/d/${doc.slug}/ → workspace/artifacts/${doc.slug}/ with legacy marker`,
    });
  }
  actions.push({
    kind: 'seed-brain',
    detail: 'Bootstrap empty brain (interactive prompt offered).',
  });
  return actions;
}

export interface RunUpgradeInput {
  ghHandle: string; // for the workspace repo name
}

export async function runUpgrade(
  input: RunUpgradeInput,
): Promise<{ migrated: string[]; backupPath: string }> {
  const { alphaConfig } = await detectAlpha();
  if (!alphaConfig) {
    throw new Error('No alpha install detected — nothing to upgrade.');
  }

  // 1. Back up alpha config
  const backupPath = `${paths.configFile()}.alpha.bak`;
  const cfgRaw = await readFile(paths.configFile(), 'utf8');
  await writeFileAtomic(backupPath, cfgRaw);

  // 2. Scaffold v1 workspace (local only — does NOT create the GitHub repo here;
  //    caller can run `mirador-v1 init` separately if they want full v1 init.)
  await ensureDir(paths.workspaceClone());
  await ensureDir(join(paths.workspaceClone(), 'brain'));
  await ensureDir(join(paths.workspaceClone(), 'artifacts'));
  await ensureDir(join(paths.workspaceClone(), 'incoming-requests'));
  await ensureDir(join(paths.workspaceClone(), 'outgoing-requests'));
  await ensureDir(join(paths.workspaceClone(), 'logs'));

  // 3. Migrate each alpha doc
  const migrated: string[] = [];
  for (const doc of alphaConfig.docs ?? []) {
    const alphaDocDir = join(paths.miradorHome(), 'site', 'd', doc.slug);
    if (!(await pathExists(alphaDocDir))) continue;
    const v1ArtifactDir = join(paths.workspaceClone(), 'artifacts', doc.slug);
    if (await pathExists(v1ArtifactDir)) {
      // Conflict — skip but record
      migrated.push(`${doc.slug} (skipped: v1 artifact already exists)`);
      continue;
    }
    await mkdir(dirname(v1ArtifactDir), { recursive: true });
    await rename(alphaDocDir, v1ArtifactDir);
    // Legacy marker
    await ensureDir(join(v1ArtifactDir, '.mirador'));
    await writeFileAtomic(
      join(v1ArtifactDir, '.mirador', 'legacy.json'),
      `${JSON.stringify(
        {
          imported_from: 'alpha',
          alpha_url: doc.url ?? null,
          alpha_visibility: doc.visibility ?? null,
          alpha_title: doc.title ?? null,
          imported_at: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );
    migrated.push(doc.slug);
  }

  // 4. Write a starter v1 config (caller can complete via `mirador-v1 config`)
  await writeConfig({
    version: 1,
    github: {
      handle: input.ghHandle,
      workspaceRepo: `${input.ghHandle}/${input.ghHandle}-mirador`,
      sharedReposNamespace: 'personal',
    },
    vercel: {
      project: alphaConfig.vercel?.project ?? `mirador-${input.ghHandle}`,
      domain: alphaConfig.vercel?.domain ?? `mirador-${input.ghHandle}.vercel.app`,
    },
    brain: { location: 'workspace' },
    defaults: {
      theme: alphaConfig.defaults?.theme ?? 'default',
      passwordPolicy: 'always-ask',
      visibility: 'unlisted',
    },
    docs: [],
  });

  return { migrated, backupPath };
}

// Ensure the recently-checked v1 config persists across re-reads.
export async function isV1Config(): Promise<boolean> {
  const cfg = await readConfig();
  return cfg?.version === 1;
}
