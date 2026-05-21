import { join } from 'node:path';
import { pathExists, readText, writeFileAtomic } from '../adapters/fs.js';

export interface MiradorLink {
  kind: 'mirador-link';
  artifact: string;
  repo: string;
  shared_at: string;
  shared_with: string[];
  role_for_collaborators?: string;
  clone_path: string;
}

const LINK_FILENAME = '.mirador-link';

export async function writeLinkFile(
  workspaceArtifactDir: string,
  link: MiradorLink,
): Promise<void> {
  await writeFileAtomic(join(workspaceArtifactDir, LINK_FILENAME), serialize(link));
}

export async function readLinkFile(workspaceArtifactDir: string): Promise<MiradorLink | null> {
  const path = join(workspaceArtifactDir, LINK_FILENAME);
  if (!(await pathExists(path))) return null;
  const raw = await readText(path);
  return deserialize(raw);
}

function serialize(link: MiradorLink): string {
  const lines = [
    '# .mirador-link',
    `kind: ${link.kind}`,
    `artifact: ${link.artifact}`,
    `repo: ${link.repo}`,
    `shared_at: ${link.shared_at}`,
    'shared_with:',
    ...link.shared_with.map((s) => `  - ${s}`),
  ];
  if (link.role_for_collaborators)
    lines.push(`role_for_collaborators: ${link.role_for_collaborators}`);
  lines.push(`clone_path: ${link.clone_path}`);
  return `${lines.join('\n')}\n`;
}

function deserialize(raw: string): MiradorLink {
  const get = (key: string): string | undefined =>
    raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  const sharedWith: string[] = [];
  const swMatch = raw.match(/^shared_with:\s*\n((?:\s+-\s*.+\n?)+)/m);
  if (swMatch) {
    for (const line of swMatch[1]?.split('\n') ?? []) {
      const m = line.match(/^\s+-\s*(.+)$/);
      if (m) sharedWith.push(m[1]?.trim() ?? '');
    }
  }
  return {
    kind: 'mirador-link',
    artifact: get('artifact') ?? '',
    repo: get('repo') ?? '',
    shared_at: get('shared_at') ?? '',
    shared_with: sharedWith,
    role_for_collaborators: get('role_for_collaborators'),
    clone_path: get('clone_path') ?? '',
  };
}
