import { writeSessionSkill } from '../adapters/claudeCode.js';
import { readConfig } from '../shared/config.js';
import { readLastSeen, updateLastSeen } from '../shared/lastSeen.js';
import { resolveArtifactPath } from './artifact.js';
import { listBrain, loadBrain } from './brain.js';
import { type FileChange, changesSince } from './changeLog.js';
import { effectiveRole, readManifest } from './role.js';

export interface SessionResult {
  brief: string;
  sessionSkillPath: string;
  role?: string;
}

export async function openSession(slug: string): Promise<SessionResult> {
  const artifactPath = await resolveArtifactPath(slug);
  const lastSeen = await readLastSeen();
  const entry = lastSeen[slug];

  const changes = await changesSince(artifactPath, entry?.last_open_at ?? null);

  // VS-09: role inference from manifest
  const config = await readConfig();
  const viewer = config?.github.handle ?? '';
  const role = await effectiveRole(artifactPath, viewer);
  const manifest = await readManifest(artifactPath);

  // Brain flag: if we have a role + matching brain section, pull one-line "instinct"
  let brainFlag: string | undefined;
  if (role) {
    try {
      const entries = await listBrain();
      const match = entries.find((e) => e.appliesToRole === role);
      if (match) {
        const file = await loadBrain(match.topic);
        brainFlag = firstSentence(file.body);
      }
    } catch {
      // brain missing — no flag
    }
  }

  const brief = renderBrief(slug, artifactPath, entry?.last_open_at ?? null, changes, {
    role,
    sharedWith: manifest?.shared_with,
    brainFlag,
  });

  const sessionSkillPath = await writeSessionSkill({
    slug,
    artifactPath,
    expectedRole: role,
  });

  await updateLastSeen(slug, { last_open_at: new Date().toISOString() });

  return { brief, sessionSkillPath, role };
}

interface BriefContext {
  role?: string;
  sharedWith?: string[];
  brainFlag?: string;
}

function renderBrief(
  slug: string,
  artifactPath: string,
  lastSeenIso: string | null,
  changes: FileChange[],
  ctx: BriefContext,
): string {
  const headerCtx = ctx.sharedWith?.length
    ? `shared with ${ctx.sharedWith.join(', ')}`
    : 'workspace';
  const roleSuffix = ctx.role ? `  ·  role: ${ctx.role}` : '';

  if (!lastSeenIso) {
    const header = `${slug}  ·  ${headerCtx}${roleSuffix}  ·  newly created`;
    return composeBrief(header, '(fresh artifact — this is your starting point)', ctx.brainFlag, [
      `Next: open ${artifactPath}  |  mirador share ${slug} --with <email>`,
    ]);
  }

  const header = `${slug}  ·  ${headerCtx}${roleSuffix}  ·  last opened by you ${humanizeAgo(lastSeenIso)}`;

  if (changes.length === 0) {
    return composeBrief(header, '(no changes since you last opened)', ctx.brainFlag, [
      `Next: open ${artifactPath}  |  mirador share ${slug} --with <email>`,
    ]);
  }

  const table = renderChangeTable(changes.slice(0, 8));
  const overflow =
    changes.length > 8 ? `\n+ ${changes.length - 8} more — \`mirador diff ${slug}\`` : '';

  return composeBrief(header, table + overflow, ctx.brainFlag, [
    `Next: open ${artifactPath}  |  mirador share ${slug} --with <email>`,
  ]);
}

function composeBrief(
  header: string,
  body: string,
  brainFlag: string | undefined,
  nexts: string[],
): string {
  const parts = [header, '', body];
  if (brainFlag) {
    parts.push(
      '',
      `⚑ Brain flag (${brainFlag.length > 110 ? 'role-aware' : 'role-aware'}): ${brainFlag}`,
    );
  }
  parts.push('', ...nexts);
  return `${parts.join('\n')}\n`;
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

function firstSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const sentence = trimmed.split(/[.\n]/)[0] ?? trimmed;
  return sentence.slice(0, 160);
}
