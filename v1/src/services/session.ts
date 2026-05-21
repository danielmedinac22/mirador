import { writeSessionSkill } from '../adapters/claudeCode.js';
import { readLastSeen, updateLastSeen } from '../shared/lastSeen.js';
import { resolveArtifactPath } from './artifact.js';
import { type FileChange, changesSince } from './changeLog.js';

export interface SessionResult {
  brief: string;
  sessionSkillPath: string;
}

export async function openSession(slug: string): Promise<SessionResult> {
  const artifactPath = await resolveArtifactPath(slug);
  const lastSeen = await readLastSeen();
  const entry = lastSeen[slug];

  const changes = await changesSince(artifactPath, entry?.last_open_at ?? null);
  const brief = renderBrief(slug, artifactPath, entry?.last_open_at ?? null, changes);

  const sessionSkillPath = await writeSessionSkill({
    slug,
    artifactPath,
  });

  await updateLastSeen(slug, { last_open_at: new Date().toISOString() });

  return { brief, sessionSkillPath };
}

function renderBrief(
  slug: string,
  artifactPath: string,
  lastSeenIso: string | null,
  changes: FileChange[],
): string {
  // First open ever: no change table, just announce starting state.
  if (!lastSeenIso) {
    const header = `${slug}  ·  workspace  ·  newly created`;
    return `${[
      header,
      '',
      '(fresh artifact — this is your starting point)',
      '',
      `Next: open ${artifactPath}  |  mirador-v1 share ${slug} --with <email>`,
    ].join('\n')}\n`;
  }

  const header = `${slug}  ·  workspace  ·  last opened by you ${humanizeAgo(lastSeenIso)}`;

  if (changes.length === 0) {
    return `${[
      header,
      '',
      '(no changes since you last opened)',
      '',
      `Next: open ${artifactPath}  |  mirador-v1 share ${slug} --with <email>`,
    ].join('\n')}\n`;
  }

  const table = renderChangeTable(changes.slice(0, 8));
  const overflow =
    changes.length > 8 ? `\n+ ${changes.length - 8} more — \`mirador-v1 diff ${slug}\`` : '';

  return `${[
    header,
    '',
    table + overflow,
    '',
    `Next: open ${artifactPath}  |  mirador-v1 share ${slug} --with <email>`,
  ].join('\n')}\n`;
}

function renderChangeTable(changes: FileChange[]): string {
  const header = `${'CHANGES SINCE YOU'.padEnd(40)}WHEN`;
  const sep = '─'.repeat(60);
  const rows = changes.map((c) => {
    const label = `${c.kind === 'added' ? 'Added' : 'Modified'}: ${c.path}`;
    return label.padEnd(40) + humanizeAgo(c.mtime.toISOString());
  });
  return [header, sep, ...rows].join('\n');
}

function humanizeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
