import { fileSource, hasFile } from './convention.js';
import type { BrainSourceAdapter } from './types.js';

/** Codex's native memory convention: `AGENTS.md` in the project root. */
export const codexBrain: BrainSourceAdapter = {
  agent: 'codex',
  label: 'Codex memory (AGENTS.md)',
  detect: () => hasFile('AGENTS.md'),
  resolve: () =>
    fileSource('codex', 'Codex memory (AGENTS.md)', [
      { file: 'AGENTS.md', kind: 'agents', topic: 'agents' },
    ]),
};
