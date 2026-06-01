import { realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathExists, readText } from '../adapters/fs.js';
import { commitAll, hasRemote, push, repoRoot } from '../adapters/git.js';
import { readConfig } from '../shared/config.js';
import { MiradorError } from '../shared/errors.js';
import { resolveArtifactPath } from './artifact.js';
import * as document from './document/index.js';
import { type IntentNote, writeIntentNote } from './intentNote.js';
import { type Move, normalizeMove } from './moves.js';
import { SOURCE_FILE } from './staticPreview.js';

/**
 * The refine loop (design §9). A collaborator edits the artifact through their
 * own agent; on push the writer's AI auto-drafts an intent note (tagged with the
 * inferred move) that rides the commit. The move is internal — never surfaced.
 */

export interface RefineBrief {
  artifactPath: string;
  sourcePath: string;
  vision?: string;
  sections: Array<{ anchor: string; headingText: string; depth: number }>;
  brief: string;
}

export async function openRefine(slug: string): Promise<RefineBrief> {
  const artifactPath = await resolveArtifactPath(slug);
  const sourcePath = join(artifactPath, SOURCE_FILE);
  if (!(await pathExists(sourcePath))) {
    throw new MiradorError(
      'NO_MARKDOWN_SOURCE',
      `Artifact "${slug}" has no ${SOURCE_FILE}.`,
      'Raw-HTML artifacts are broadcast-only — they cannot be refined.',
    );
  }
  const model = document.parse(await readText(sourcePath));
  const vision =
    typeof model.frontmatter.vision === 'string' ? model.frontmatter.vision : undefined;
  const sections = model.sections
    .filter((s) => s.depth > 0)
    .map((s) => ({ anchor: s.anchor, headingText: s.headingText, depth: s.depth }));
  return {
    artifactPath,
    sourcePath,
    vision,
    sections,
    brief: renderRefineBrief(slug, vision, sections),
  };
}

export interface RefineInput {
  intent: string;
  move?: string;
  author?: string;
  offline?: boolean;
}

export interface RefineResult {
  sha: string;
  move: Move;
  intentPath: string;
  pushed: boolean;
}

/**
 * Commit a refinement at `artifactPath` with an attached intent note. Two
 * commits: the refinement (subject = intent summary, `Mirador-Move:` trailer),
 * then the `.mirador/intents/<sha>.md` sidecar keyed by the refinement sha.
 */
export async function commitRefinement(
  artifactPath: string,
  input: RefineInput,
): Promise<RefineResult> {
  // Resolve symlinks so the repo-relative pathspec aligns with git's (realpath'd)
  // toplevel — otherwise a symlinked temp dir (macOS /tmp → /private) escapes it.
  const real = await realpath(artifactPath);
  const root = await repoRoot(real);
  if (!root) {
    throw new MiradorError(
      'NOT_A_REPO',
      `${artifactPath} is not inside a git repository.`,
      'Refinements are committed to git; initialise or clone the artifact repo first.',
    );
  }

  const move = normalizeMove(input.move);
  const author = await resolveAuthor(input.author);
  const summary = firstLine(input.intent) || 'refine artifact';
  const rel = relPathSpec(root, real);

  // 1. The refinement commit — subject is the human-legible intent summary; the
  //    move rides as a machine-readable trailer (never printed to the user).
  const message = `${summary}\n\nMirador-Move: ${move}`;
  const sha = await commitAll(root, rel, message);

  // 2. The intent sidecar, keyed by the refinement sha.
  const note: IntentNote = { move, author, summary, body: input.intent.trim() };
  const intentFile = await writeIntentNote(real, sha, note);
  const notesSpec = relPathSpec(root, join(real, '.mirador', 'intents'));
  await commitAll(root, notesSpec, `intent: note for ${sha.slice(0, 7)}`);

  // 3. Best-effort sync.
  let pushed = false;
  if (!input.offline && (await hasRemote(root))) {
    try {
      await push(root);
      pushed = true;
    } catch {
      pushed = false;
    }
  }

  return { sha, move, intentPath: intentFile, pushed };
}

export async function pushRefinement(slug: string, input: RefineInput): Promise<RefineResult> {
  const artifactPath = await resolveArtifactPath(slug);
  return commitRefinement(artifactPath, input);
}

// ── helpers ─────────────────────────────────────────────────────────────────

function relPathSpec(root: string, target: string): string {
  const rel = relative(root, target).split(sep).join('/');
  return rel === '' ? '.' : rel;
}

async function resolveAuthor(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const cfg = await readConfig();
  return cfg?.github.handle ?? 'you';
}

function firstLine(text: string): string {
  return (text.split('\n').find((l) => l.trim() !== '') ?? '').trim();
}

function renderRefineBrief(
  slug: string,
  vision: string | undefined,
  sections: Array<{ anchor: string; headingText: string }>,
): string {
  const lines: string[] = [`${slug}  ·  refine mode`];
  if (vision) lines.push(`vision: ${vision}`);
  lines.push('', 'SECTIONS');
  for (const s of sections) lines.push(`  §${s.anchor}  ${s.headingText}`);
  lines.push(
    '',
    'Refine freeform with your agent, then:',
    `  mirador push ${slug} --intent "<what changed & why>"`,
  );
  return `${lines.join('\n')}\n`;
}
