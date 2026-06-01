/**
 * The brain seam (design §8). Per-agent adapters locate + read the agent's
 * *living memory* — never a separate store. Read-only by construction: the
 * brain never enters git or a handoff packet (privacy, design §8.2).
 */

export type AgentKind = 'claude' | 'codex' | 'gemini' | 'generic';

export interface BrainTopic {
  name: string;
  description?: string;
  body: string;
  path: string;
}

export interface BrainSourceFile {
  /** memory-index | topic | project-doc | agents | gemini */
  kind: string;
  path: string;
  exists: boolean;
}

export interface BrainSource {
  agent: AgentKind;
  label: string;
  /** The files this source would read, with existence flags (for diagnostics). */
  files(): Promise<BrainSourceFile[]>;
  /** Read the brain topics. Read-only. Empty array on cold start (no throw). */
  read(): Promise<BrainTopic[]>;
}

export interface BrainSourceAdapter {
  agent: AgentKind;
  label: string;
  /** True if this agent's native memory is present for the current project. */
  detect(): Promise<boolean>;
  resolve(): BrainSource;
}

/** Parse a memory/topic markdown file's frontmatter (name/description) + body. */
export function parseTopic(name: string, raw: string, path: string): BrainTopic {
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fm) return { name, body: raw.trim(), path };
  const frontmatter = fm[1] ?? '';
  const body = (fm[2] ?? '').trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { name, description, body, path };
}
