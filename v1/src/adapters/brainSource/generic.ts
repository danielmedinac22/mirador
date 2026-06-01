import { fileSource } from './convention.js';
import type { BrainSourceAdapter } from './types.js';

/**
 * The floor: the `AGENTS.md` / `CLAUDE.md` convention. Always "detects" (it's
 * the fallback). On cold start (neither file present) `read()` returns `[]` —
 * handoffs degrade to a generic baseline rather than erroring (design §8.3).
 */
export const genericBrain: BrainSourceAdapter = {
  agent: 'generic',
  label: 'generic convention (AGENTS.md / CLAUDE.md)',
  detect: async () => true,
  resolve: () =>
    fileSource('generic', 'generic convention (AGENTS.md / CLAUDE.md)', [
      { file: 'AGENTS.md', kind: 'agents', topic: 'agents' },
      { file: 'CLAUDE.md', kind: 'project-doc', topic: 'project' },
    ]),
};
