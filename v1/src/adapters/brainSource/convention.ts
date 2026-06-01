import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { paths } from '../../shared/paths.js';
import { pathExists } from '../fs.js';
import {
  type AgentKind,
  type BrainSource,
  type BrainSourceFile,
  type BrainTopic,
  parseTopic,
} from './types.js';

interface Candidate {
  file: string;
  kind: string;
  topic: string;
}

/** A brain source backed by one or more convention files in the project root. */
export function fileSource(agent: AgentKind, label: string, candidates: Candidate[]): BrainSource {
  return {
    agent,
    label,
    async files(): Promise<BrainSourceFile[]> {
      const out: BrainSourceFile[] = [];
      for (const c of candidates) {
        const p = join(paths.projectRoot(), c.file);
        out.push({ kind: c.kind, path: p, exists: await pathExists(p) });
      }
      return out;
    },
    async read(): Promise<BrainTopic[]> {
      const out: BrainTopic[] = [];
      for (const c of candidates) {
        const p = join(paths.projectRoot(), c.file);
        if (await pathExists(p)) out.push(parseTopic(c.topic, await readFile(p, 'utf8'), p));
      }
      return out;
    },
  };
}

export const hasFile = (file: string): Promise<boolean> =>
  pathExists(join(paths.projectRoot(), file));
