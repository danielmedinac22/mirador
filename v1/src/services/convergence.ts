import { join } from 'node:path';
import { pathExists, readText } from '../adapters/fs.js';
import { commitsBetween, repoRoot } from '../adapters/git.js';
import * as document from './document/index.js';
import type { Conflict, DocModel } from './document/index.js';
import { type IntentNote, listIntentNotes, readIntentNote } from './intentNote.js';
import { readManifest } from './role.js';
import { SOURCE_FILE } from './staticPreview.js';

/**
 * Convergence state (design §11.3): a glanceable, **computed** readout of how
 * close the artifact is to its vision — sections locked (endorsed) / contested
 * (open challenges) / open. Derived from intent-note move tags (computed-not-
 * stored, SAD §3.2); moves stay internal — only the resulting state shows.
 */

export type SectionState = 'locked' | 'contested' | 'open';

const CHALLENGE_MOVES = new Set(['critique', 'question', 'reframe']);
const EMPTY_MODEL: DocModel = { frontmatter: {}, sections: [], raw: '' };

export interface SectionStatus {
  anchor: string;
  headingText: string;
  state: SectionState;
  challenges: number;
}

export interface ConvergenceState {
  vision?: string;
  owner?: string;
  sections: SectionStatus[];
}

export async function computeConvergence(artifactPath: string): Promise<ConvergenceState> {
  const sourcePath = join(artifactPath, SOURCE_FILE);
  const model = (await pathExists(sourcePath))
    ? document.parse(await readText(sourcePath))
    : EMPTY_MODEL;
  const vision =
    typeof model.frontmatter.vision === 'string' ? model.frontmatter.vision : undefined;
  const owner = (await readManifest(artifactPath))?.owner;

  const notes = await orderedIntents(artifactPath); // newest-first

  const sections: SectionStatus[] = model.sections
    .filter((s) => s.depth > 0)
    .map((s) => {
      const touching = notes.filter((n) => (n.sections ?? []).includes(s.anchor));
      const latest = touching[0];
      const challenges = touching.filter((n) => CHALLENGE_MOVES.has(n.move)).length;
      let state: SectionState = 'open';
      if (latest?.move === 'endorse') state = 'locked';
      else if (challenges > 0) state = 'contested';
      return { anchor: s.anchor, headingText: s.headingText, state, challenges };
    });

  return { vision, owner, sections };
}

/** Intent notes newest-first (git commit order), falling back to filename order. */
async function orderedIntents(artifactPath: string): Promise<IntentNote[]> {
  const root = await repoRoot(artifactPath);
  if (root) {
    const out: IntentNote[] = [];
    for (const sha of await commitsBetween(root, null, 'HEAD')) {
      const n = await readIntentNote(artifactPath, sha);
      if (n) out.push(n);
    }
    if (out.length) return out;
  }
  return (await listIntentNotes(artifactPath)).map((x) => x.note).reverse();
}

// ── Owner arbitration of same-section conflicts (design §11.2 / Q9) ──────────

export interface ArbitrationItem {
  anchor: string;
  headingText: string;
  owner?: string;
  base: string | null;
  ours: string;
  theirs: string;
}

/** Route same-section conflicts to the owner, both sides attached. */
export function arbitrationFor(conflicts: Conflict[], owner?: string): ArbitrationItem[] {
  return conflicts.map((c) => ({
    anchor: c.anchor,
    headingText: c.headingText,
    owner,
    base: c.base,
    ours: c.ours,
    theirs: c.theirs,
  }));
}
