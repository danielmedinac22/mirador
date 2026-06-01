/**
 * The document seam (design §7).
 *
 * A format-agnostic document model. All convergence machinery — refine,
 * handoff, cockpit, convergence state — operates on this interface, never on
 * markdown strings directly. markdown++ is implementation #1; blocks/canvas
 * are future implementations of the same contract.
 *
 * Key architectural choice (CV-00 sub-plan §1.2): diff/merge are defined over
 * *sections of opaque body text keyed by a stable anchor*, NOT over a parser
 * AST. A future format supplies its own sections and the same contract holds.
 */

/** The five shipped themes act as document renderers (design §7.3). */
export type ThemeName = 'page' | 'memo' | 'deck' | 'console' | 'atlas' | 'none';

export const ALL_THEMES: readonly ThemeName[] = [
  'page',
  'memo',
  'deck',
  'console',
  'atlas',
  'none',
] as const;

/**
 * Artifact frontmatter. `vision`/`owner` are the convergence anchor (design
 * §11); CV-00 only scaffolds a `vision` placeholder — evolution + owner
 * arbitration land in CV-04. Unknown keys are preserved verbatim.
 */
export interface Frontmatter {
  vision?: string;
  owner?: string;
  title?: string;
  [key: string]: unknown;
}

/**
 * One section = one heading and the content beneath it, up to the next heading
 * of any level. The merge / diff / lock unit. A document may open with an
 * anchorless preamble (depth 0, synthetic anchor) before its first heading.
 */
export interface Section {
  /** Stable id. The diff/merge/lock key. */
  anchor: string;
  /** ATX heading depth 1–6; 0 for the preamble lead. */
  depth: number;
  /** Heading text with the `{#id}` suffix stripped. Empty for the preamble. */
  headingText: string;
  /** Raw markdown body after the heading line (may be empty). */
  body: string;
}

export interface DocModel {
  frontmatter: Frontmatter;
  sections: Section[];
  /** The original source as parsed. */
  raw: string;
}

export type SectionChangeKind = 'added' | 'removed' | 'modified';

export interface SectionChange {
  anchor: string;
  headingText: string;
  kind: SectionChangeKind;
}

export interface StructuredDiff {
  changes: SectionChange[];
}

/**
 * A same-section divergence. `base` is null when both sides *added* the same
 * anchor with different content. Returned (never thrown) by `merge`.
 */
export interface Conflict {
  anchor: string;
  headingText: string;
  base: string | null;
  ours: string;
  theirs: string;
}

/** Discriminate a `merge` result. `DocModel` is an object; conflicts are an array. */
export function isConflict(result: DocModel | Conflict[]): result is Conflict[] {
  return Array.isArray(result);
}

/**
 * The format seam (design §7.1). One implementation per source format.
 */
export interface DocumentImpl {
  readonly name: string;
  parse(source: string): DocModel;
  serialize(doc: DocModel): string;
  render(doc: DocModel, theme: ThemeName): string;
  diff(base: DocModel, head: DocModel): StructuredDiff;
  merge(base: DocModel, ours: DocModel, theirs: DocModel): DocModel | Conflict[];
}
