import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathExists, readText, writeFileAtomic } from '../adapters/fs.js';
import { brainRoot } from './brain.js';

export interface ExistingContext {
  source: string; // human-readable label (e.g. "~/CLAUDE.md")
  path: string; // absolute path
  body: string;
}

export async function detectExistingContext(): Promise<ExistingContext[]> {
  const found: ExistingContext[] = [];

  const homeClaudeMd = join(homedir(), 'CLAUDE.md');
  if (await pathExists(homeClaudeMd)) {
    found.push({ source: '~/CLAUDE.md', path: homeClaudeMd, body: await readText(homeClaudeMd) });
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

  // Skip already-imported sources by checking each brain file's `source:` frontmatter.
  const imported = await alreadyImportedSources();
  return found.filter((f) => !imported.has(f.path));
}

async function alreadyImportedSources(): Promise<Set<string>> {
  const sources = new Set<string>();
  try {
    const root = await brainRoot();
    const files = await readdir(root);
    for (const f of files) {
      if (!f.endsWith('.md') || f === 'MEMORY.md') continue;
      const raw = await readText(join(root, f));
      const m = raw.match(/^source:\s*(.+)$/m);
      if (m?.[1]) sources.add(m[1].trim());
    }
  } catch {
    // No brain yet — nothing imported.
  }
  return sources;
}

export interface ImportInput {
  context: ExistingContext;
  topic: string;
  description?: string;
  appliesToRole?: string;
}

/**
 * Writes an imported context as a brain file with `source:` frontmatter so
 * re-running detect skips it on subsequent runs.
 */
export async function importContext(input: ImportInput): Promise<{ path: string }> {
  const root = await brainRoot();
  const dest = join(root, `${input.topic}.md`);
  const fm: string[] = [
    '---',
    `name: ${input.topic}`,
    `description: ${input.description ?? '(imported)'}`,
    `source: ${input.context.path}`,
    'metadata:',
    '  type: brain',
  ];
  if (input.appliesToRole) fm.push(`  applies_to_role: ${input.appliesToRole}`);
  fm.push('---', '');
  const content = `${fm.join('\n')}\n${stripFrontmatter(input.context.body).trim()}\n`;
  await writeFileAtomic(dest, content);
  return { path: dest };
}

function stripFrontmatter(body: string): string {
  const match = body.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match?.[1] ?? body;
}
