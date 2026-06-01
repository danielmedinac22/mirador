import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { paths } from '../../shared/paths.js';
import { pathExists } from '../fs.js';
import {
  type BrainSource,
  type BrainSourceAdapter,
  type BrainSourceFile,
  type BrainTopic,
  parseTopic,
} from './types.js';

const memoryDir = (): string => paths.claudeMemoryDir(paths.projectRoot());
const projectDoc = (): string => join(paths.projectRoot(), 'CLAUDE.md');

/**
 * Claude Code's native memory: `~/.claude/projects/<slug>/memory/` (MEMORY.md
 * index + topic files) plus the project's `CLAUDE.md`. The distinguishing
 * Claude-Code signal is the memory dir (a bare CLAUDE.md falls to generic).
 */
export const claudeCodeBrain: BrainSourceAdapter = {
  agent: 'claude',
  label: 'Claude Code memory',
  detect: () => pathExists(memoryDir()),
  resolve: (): BrainSource => ({
    agent: 'claude',
    label: 'Claude Code memory',
    async files(): Promise<BrainSourceFile[]> {
      const dir = memoryDir();
      const out: BrainSourceFile[] = [];
      if (await pathExists(dir)) {
        for (const f of (await readdir(dir)).filter((n) => n.endsWith('.md')).sort()) {
          out.push({
            kind: f === 'MEMORY.md' ? 'memory-index' : 'topic',
            path: join(dir, f),
            exists: true,
          });
        }
      }
      const cd = projectDoc();
      out.push({ kind: 'project-doc', path: cd, exists: await pathExists(cd) });
      return out;
    },
    async read(): Promise<BrainTopic[]> {
      const topics: BrainTopic[] = [];
      const dir = memoryDir();
      if (await pathExists(dir)) {
        for (const f of (await readdir(dir)).filter((n) => n.endsWith('.md')).sort()) {
          const p = join(dir, f);
          topics.push(parseTopic(f.replace(/\.md$/, ''), await readFile(p, 'utf8'), p));
        }
      }
      const cd = projectDoc();
      if (await pathExists(cd)) topics.push(parseTopic('project', await readFile(cd, 'utf8'), cd));
      return topics;
    },
  }),
};
