import {
  type BrainSource,
  type BrainTopic,
  resolveBrainSource,
} from '../adapters/brainSource/index.js';
import { MiradorError } from '../shared/errors.js';

// The brain is the user's agent's living memory (design §8). This service
// resolves the right adapter and reads it — read-only, never a store. There is
// no `scaffoldBrain` anymore: the brain is whatever the agent already maintains.

export { resolveBrainSource };
export type { BrainSource, BrainTopic };

/**
 * Back-compat shape for session.ts. Agent memory has no *declared* roles, so
 * `appliesToRole` is always undefined — roles are inferred now (design §11.4),
 * and the CLI no longer fabricates a role-matched brain flag.
 */
export interface BrainFile {
  topic: string;
  description: string;
  appliesToRole?: string;
  body: string;
  path: string;
}

function toFile(t: BrainTopic): BrainFile {
  return { topic: t.name, description: t.description ?? '', body: t.body, path: t.path };
}

/** Read the brain topics from the resolved agent-native source. */
export async function readBrain(): Promise<BrainTopic[]> {
  const source = await resolveBrainSource();
  return source.read();
}

export async function listBrain(): Promise<BrainFile[]> {
  return (await readBrain()).map(toFile);
}

export async function loadBrain(topic: string): Promise<BrainFile> {
  const found = (await readBrain()).find((t) => t.name === topic);
  if (!found) throw new MiradorError('BRAIN_TOPIC_MISSING', `No brain topic "${topic}".`);
  return toFile(found);
}

export interface BrainDiagnostic {
  agent: string;
  label: string;
  files: Array<{ kind: string; path: string; exists: boolean }>;
  topics: Array<{ name: string; description: string }>;
}

/** What `mirador brain` shows: the resolved source + what it would read. */
export async function brainSummary(): Promise<BrainDiagnostic> {
  const source = await resolveBrainSource();
  const [files, topics] = await Promise.all([source.files(), source.read()]);
  return {
    agent: source.agent,
    label: source.label,
    files,
    topics: topics.map((t) => ({ name: t.name, description: t.description ?? '' })),
  };
}
