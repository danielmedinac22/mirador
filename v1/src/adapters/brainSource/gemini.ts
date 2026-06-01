import { fileSource, hasFile } from './convention.js';
import type { BrainSourceAdapter } from './types.js';

/** Gemini's native memory convention: `GEMINI.md` in the project root. */
export const geminiBrain: BrainSourceAdapter = {
  agent: 'gemini',
  label: 'Gemini memory (GEMINI.md)',
  detect: () => hasFile('GEMINI.md'),
  resolve: () =>
    fileSource('gemini', 'Gemini memory (GEMINI.md)', [
      { file: 'GEMINI.md', kind: 'gemini', topic: 'gemini' },
    ]),
};
