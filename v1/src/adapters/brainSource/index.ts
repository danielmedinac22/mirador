import { claudeCodeBrain } from './claudeCode.js';
import { codexBrain } from './codex.js';
import { geminiBrain } from './gemini.js';
import { genericBrain } from './generic.js';
import type { AgentKind, BrainSource, BrainSourceAdapter } from './types.js';

export * from './types.js';

/**
 * Detection precedence (design §8.1): an explicit `MIRADOR_AGENT` override, then
 * Claude (memory dir present) → Gemini (`GEMINI.md`) → Codex (`AGENTS.md`) →
 * generic (always; the floor). A new agent is a new adapter; the convention is
 * the baseline.
 */
const ADAPTERS: BrainSourceAdapter[] = [claudeCodeBrain, geminiBrain, codexBrain, genericBrain];

export async function resolveBrainSource(): Promise<BrainSource> {
  const forced = process.env.MIRADOR_AGENT as AgentKind | undefined;
  if (forced) {
    const adapter = ADAPTERS.find((a) => a.agent === forced);
    if (adapter) return adapter.resolve();
  }
  for (const adapter of ADAPTERS) {
    if (await adapter.detect()) return adapter.resolve();
  }
  return genericBrain.resolve();
}
