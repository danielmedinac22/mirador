import { join } from 'node:path';
import { pathExists, readText } from '../adapters/fs.js';

export interface ArtifactManifest {
  slug: string;
  owner?: string;
  shared_with?: string[];
  role_for_collaborators?: string;
  auto_invite?: string[];
  created_at?: string;
}

export async function readManifest(artifactPath: string): Promise<ArtifactManifest | null> {
  const path = join(artifactPath, '.mirador', 'manifest.json');
  if (!(await pathExists(path))) return null;
  try {
    return JSON.parse(await readText(path)) as ArtifactManifest;
  } catch {
    return null;
  }
}

export async function effectiveRole(
  artifactPath: string,
  viewerHandle: string,
): Promise<string | undefined> {
  const m = await readManifest(artifactPath);
  if (!m) return undefined;
  if (m.owner === viewerHandle) return 'author';
  return m.role_for_collaborators;
}
