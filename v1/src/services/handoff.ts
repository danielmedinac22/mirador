import { join } from 'node:path';
import { pathExists, readText } from '../adapters/fs.js';
import { commitsBetween, headSha, repoRoot } from '../adapters/git.js';
import { readLastSeen } from '../shared/lastSeen.js';
import { resolveArtifactPath } from './artifact.js';
import { resolveBrainSource } from './brain.js';
import { sourceAtRef } from './changeLog.js';
import * as document from './document/index.js';
import type { DocModel, StructuredDiff } from './document/index.js';
import { type IntentNote, readIntentNote } from './intentNote.js';
import { SOURCE_FILE } from './staticPreview.js';

/**
 * The handoff (design §10) — the crown jewel. Git gives a diff; it does not give
 * the handoff. On open/pull the CLI assembles a deterministic **packet**:
 *   structured diff since last-seen + intent notes for those changes + a pointer
 *   to the reader's brain source.
 * It carries **no brain content** (agent path, design §8.2): the reader's agent
 * reads its own memory and frames the packet into a one-screen brief. Two
 * different brains → visibly different briefs (the launch demo, §17).
 */

export interface HandoffIntent {
  sha: string;
  note: IntentNote;
}

export interface HandoffPacket {
  slug: string;
  since: string | null;
  head: string | null;
  vision?: string;
  diff: StructuredDiff;
  intents: HandoffIntent[];
  /** Pointer only — never the brain's content. */
  brainSource: { agent: string; label: string };
}

const EMPTY_MODEL: DocModel = { frontmatter: {}, sections: [], raw: '' };

export async function assembleHandoff(
  slug: string,
  sinceOverride?: string,
): Promise<HandoffPacket> {
  const artifactPath = await resolveArtifactPath(slug);
  const sourcePath = join(artifactPath, SOURCE_FILE);

  // Brain *pointer* only — resolving the source never embeds its content.
  const src = await resolveBrainSource();
  const brainSource = { agent: src.agent, label: src.label };

  const headText = (await pathExists(sourcePath)) ? await readText(sourcePath) : '';
  const headModel = headText ? document.parse(headText) : EMPTY_MODEL;
  const vision =
    typeof headModel.frontmatter.vision === 'string' ? headModel.frontmatter.vision : undefined;

  const root = await repoRoot(artifactPath);
  if (!root) {
    return {
      slug,
      since: null,
      head: null,
      vision,
      diff: { changes: [] },
      intents: [],
      brainSource,
    };
  }

  const since = sinceOverride ?? (await lastSeenRef(slug));
  const head = await headSha(root);

  const baseText = since ? await sourceAtRef(artifactPath, SOURCE_FILE, since) : null;
  const committedHead = await sourceAtRef(artifactPath, SOURCE_FILE, 'HEAD');
  const baseModel = baseText ? document.parse(baseText) : EMPTY_MODEL;
  const headForDiff = committedHead ? document.parse(committedHead) : headModel;
  const diff = document.diff(baseModel, headForDiff);

  const intents: HandoffIntent[] = [];
  for (const sha of await commitsBetween(root, since, 'HEAD')) {
    const note = await readIntentNote(artifactPath, sha);
    if (note) intents.push({ sha, note });
  }

  return { slug, since, head, vision, diff, intents, brainSource };
}

async function lastSeenRef(slug: string): Promise<string | null> {
  const store = await readLastSeen();
  return store[slug]?.last_open_commit ?? null;
}

/**
 * The raw packet as legible text — manual mode (usable with no shim). The
 * brain-shaped *brief* (why it matters to you + next-refinements) is the agent's
 * job; the move tags stay internal and are not printed.
 */
export function renderHandoff(p: HandoffPacket): string {
  const lines: string[] = [
    `${p.slug}  ·  handoff${p.since ? `  ·  since ${p.since.slice(0, 7)}` : '  ·  first open'}`,
  ];
  if (p.vision) lines.push(`vision: ${p.vision}`);
  lines.push(
    `brain: ${p.brainSource.label} (${p.brainSource.agent}) — framed by your agent, locally`,
  );

  lines.push('', 'CHANGED SECTIONS');
  if (p.diff.changes.length === 0) lines.push('  (none since last seen)');
  else for (const c of p.diff.changes) lines.push(`  §${c.anchor}  ${c.headingText}  —  ${c.kind}`);

  lines.push('', 'INTENT NOTES');
  if (p.intents.length === 0) lines.push('  (none)');
  else
    for (const { sha, note } of p.intents)
      lines.push(`  ${sha.slice(0, 7)}  ${note.author}: ${note.summary}`);

  lines.push(
    '',
    'Your agent reframes this through your own brain into a one-screen brief',
    'ending in 2–3 concrete next-refinements.',
  );
  return `${lines.join('\n')}\n`;
}
