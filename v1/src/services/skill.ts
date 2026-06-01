import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir, pathExists, readText, writeFileAtomic } from '../adapters/fs.js';
import { paths } from '../shared/paths.js';

/**
 * Per-agent shims (design §13). The CLI is the agnostic engine; each agent gets a
 * thin shim carrying the same invisible-intelligence contract (refine, auto-intent,
 * handoff framing, move inference) in that agent's idiom. The shim is a text
 * contract — never business logic (SAD §2.2).
 */

export type ShimAgent = 'claude' | 'codex' | 'gemini';

interface ShimSpec {
  dir: () => string;
  file: string;
  src: string; // path under v1/shims/
}

const SHIMS: Record<ShimAgent, ShimSpec> = {
  claude: { dir: paths.claudeSkill, file: 'SKILL.md', src: 'claude/SKILL.md' },
  codex: { dir: paths.codexSkill, file: 'AGENTS.md', src: 'codex/AGENTS.md' },
  gemini: { dir: paths.geminiSkill, file: 'GEMINI.md', src: 'gemini/GEMINI.md' },
};

const SLASH_COMMAND = `# /mirador

Invokes the mirador skill explicitly. The skill auto-activates on
@mirador-invitation / @mirador-request / @mirador-response prompt-seeds
and inside mirador workspace folders — use this slash command to force
an explicit invocation when none of those signals fire.
`;

/** Install/update the shim for an agent. Returns the written path. */
export async function installShim(agent: ShimAgent): Promise<string> {
  const spec = SHIMS[agent];
  await ensureDir(spec.dir());
  const target = join(spec.dir(), spec.file);
  await writeFileAtomic(target, await readShimBody(spec.src));
  return target;
}

export async function installClaudeSkill(): Promise<void> {
  await installShim('claude');
}
export async function installCodexSkill(): Promise<void> {
  await installShim('codex');
}
export async function installGeminiShim(): Promise<void> {
  await installShim('gemini');
}

export async function installSlashCommand(): Promise<void> {
  await writeFileAtomic(paths.claudeCommand(), SLASH_COMMAND);
}

async function readShimBody(srcRel: string): Promise<string> {
  if (process.env.MIRADOR_SKILL_BODY_OVERRIDE) return process.env.MIRADOR_SKILL_BODY_OVERRIDE;
  for (const candidate of shimCandidates(srcRel)) {
    if (await pathExists(candidate)) return readText(candidate);
  }
  return SKILL_FALLBACK;
}

function shimCandidates(srcRel: string): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  return [
    resolve(here, '..', '..', 'shims', srcRel), // dev:     src/services → v1/shims
    resolve(here, '..', 'shims', srcRel), // bundled: dist → ../shims
    resolve(here, '..', '..', '..', 'shims', srcRel),
  ];
}

const SKILL_FALLBACK = `---
name: mirador
description: |
  mirador — converge on shared artifacts through your own AI. Activate on
  @mirador-invitation / @mirador-request / @mirador-response prompt-seeds,
  or inside a mirador workspace or shared-artifact folder.
---

# mirador

Refine markdown++ artifacts; push auto-drafted intent notes; frame handoffs
through your own brain. All deterministic work is \`mirador <command>\`.
`;
