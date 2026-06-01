import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { ensureDir, pathExists, writeFileAtomic } from '../adapters/fs.js';
import { type Move, normalizeMove } from './moves.js';

/**
 * The intent note (design §9): *what I changed and why, in my context*,
 * auto-drafted by the writer's AI at push. A commit message that is really an
 * inter-agent message. Stored as a sidecar `.mirador/intents/<sha>.md` (rich,
 * agent-readable) plus a one-line commit trailer (git-log legibility, §18).
 */
export interface IntentNote {
  move: Move;
  author: string;
  /** One-line summary — becomes the commit subject. */
  summary: string;
  /** The full intent prose (what changed + why, in the writer's context). */
  body: string;
  /** Section anchors touched (optional). */
  sections?: string[];
  timestamp?: string;
}

const INTENTS_DIR = '.mirador/intents';

export function composeIntentNote(note: IntentNote): string {
  const fm: Record<string, unknown> = {
    move: note.move,
    author: note.author,
    summary: note.summary,
  };
  if (note.sections?.length) fm.sections = note.sections;
  if (note.timestamp) fm.timestamp = note.timestamp;
  return `---\n${stringifyYaml(fm).trimEnd()}\n---\n\n${note.body.trim()}\n`;
}

export function parseIntentNote(raw: string): IntentNote {
  const m = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fmText = m?.[1] ?? '';
  const body = (m?.[2] ?? raw).trim();
  let fm: Record<string, unknown> = {};
  try {
    const parsed: unknown = parseYaml(fmText);
    if (parsed && typeof parsed === 'object') fm = parsed as Record<string, unknown>;
  } catch {
    // malformed frontmatter → treat as bodyless note
  }
  const sections = Array.isArray(fm.sections) ? fm.sections.map(String) : undefined;
  return {
    move: normalizeMove(typeof fm.move === 'string' ? fm.move : undefined),
    author: typeof fm.author === 'string' ? fm.author : '',
    summary: typeof fm.summary === 'string' ? fm.summary : '',
    body,
    sections,
    timestamp: typeof fm.timestamp === 'string' ? fm.timestamp : undefined,
  };
}

/** The one-line commit trailer carrying the inferred move (machine-readable). */
export function intentTrailer(note: IntentNote): string {
  return `Mirador-Move: ${note.move}`;
}

export function intentPath(artifactPath: string, sha: string): string {
  return join(artifactPath, INTENTS_DIR, `${sha}.md`);
}

export async function writeIntentNote(
  artifactPath: string,
  sha: string,
  note: IntentNote,
): Promise<string> {
  const dir = join(artifactPath, INTENTS_DIR);
  await ensureDir(dir);
  const file = join(dir, `${sha}.md`);
  await writeFileAtomic(file, composeIntentNote(note));
  return file;
}

export async function readIntentNote(
  artifactPath: string,
  sha: string,
): Promise<IntentNote | null> {
  const file = intentPath(artifactPath, sha);
  if (!(await pathExists(file))) return null;
  return parseIntentNote(await readFile(file, 'utf8'));
}

export async function listIntentNotes(
  artifactPath: string,
): Promise<Array<{ sha: string; note: IntentNote }>> {
  const dir = join(artifactPath, INTENTS_DIR);
  if (!(await pathExists(dir))) return [];
  const out: Array<{ sha: string; note: IntentNote }> = [];
  for (const f of (await readdir(dir)).filter((n) => n.endsWith('.md')).sort()) {
    const sha = f.replace(/\.md$/, '');
    out.push({ sha, note: parseIntentNote(await readFile(join(dir, f), 'utf8')) });
  }
  return out;
}
