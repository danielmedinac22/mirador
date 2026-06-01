/**
 * Collaboration moves (design §5, §11.4). Six internal primitives the shim
 * infers from natural conversation. **Never user-facing** — there is no flag,
 * no menu, no vocabulary to learn. The CLI only stores + reads the tag; the
 * shim infers it; the user never sees it. Inference fidelity starts shim-only
 * (design §18) — the CLI just validates and defaults.
 */

export const MOVES = ['critique', 'extend', 'tighten', 'reframe', 'question', 'endorse'] as const;

export type Move = (typeof MOVES)[number];

export function isMove(value: string): value is Move {
  return (MOVES as readonly string[]).includes(value);
}

/** A refinement with no inferred move defaults to `extend` (added/changed content). */
export function normalizeMove(value?: string | null): Move {
  return value && isMove(value) ? value : 'extend';
}
