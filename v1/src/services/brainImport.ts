import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathExists, readText } from '../adapters/fs.js';

export interface ExistingContext {
  source: string;
  path: string;
  body: string;
}

export async function detectExistingContext(): Promise<ExistingContext[]> {
  const found: ExistingContext[] = [];

  const homeClaudeMd = join(homedir(), 'CLAUDE.md');
  if (await pathExists(homeClaudeMd)) {
    found.push({
      source: '~/CLAUDE.md',
      path: homeClaudeMd,
      body: await readText(homeClaudeMd),
    });
  }

  const claudeProjects = join(homedir(), '.claude', 'projects');
  if (await pathExists(claudeProjects)) {
    const projects = await readdir(claudeProjects);
    for (const proj of projects) {
      const memoryDir = join(claudeProjects, proj, 'memory');
      if (!(await pathExists(memoryDir))) continue;
      const files = await readdir(memoryDir);
      for (const f of files) {
        if (!f.endsWith('.md')) continue;
        const filePath = join(memoryDir, f);
        found.push({
          source: `~/.claude/projects/${proj}/memory/${f}`,
          path: filePath,
          body: await readText(filePath),
        });
      }
    }
  }

  const codexMemory = join(homedir(), '.codex', 'memory');
  if (await pathExists(codexMemory)) {
    const files = await readdir(codexMemory);
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const filePath = join(codexMemory, f);
      found.push({
        source: `~/.codex/memory/${f}`,
        path: filePath,
        body: await readText(filePath),
      });
    }
  }

  return found;
}
