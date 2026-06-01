/**
 * The document seam registry + dispatch (design §7.1).
 *
 * markdown++ is registered as the default implementation. Future formats
 * (blocks, canvas) register here; the convergence code calls the dispatch
 * helpers and never touches a concrete format.
 */
import { markdownImpl } from './markdown.js';
import {
  ALL_THEMES,
  type Conflict,
  type DocModel,
  type DocumentImpl,
  type StructuredDiff,
  type ThemeName,
} from './types.js';

export * from './types.js';

const registry = new Map<string, DocumentImpl>();

export const DEFAULT_IMPL = 'markdown';

export function registerImpl(impl: DocumentImpl): void {
  registry.set(impl.name, impl);
}

export function getImpl(name: string = DEFAULT_IMPL): DocumentImpl {
  const impl = registry.get(name);
  if (!impl) {
    throw new Error(
      `Unknown document implementation "${name}". Known: ${[...registry.keys()].join(', ')}`,
    );
  }
  return impl;
}

registerImpl(markdownImpl);

/** Coerce an arbitrary theme string to a known theme (legacy `default` → `page`). */
export function normaliseTheme(theme: string): ThemeName {
  const lower = (theme || '').toLowerCase().trim();
  if ((ALL_THEMES as readonly string[]).includes(lower)) return lower as ThemeName;
  return 'page';
}

// ── Dispatch helpers (default impl unless a name is given) ──────────────────

export function parse(source: string, impl?: string): DocModel {
  return getImpl(impl).parse(source);
}

export function serialize(doc: DocModel, impl?: string): string {
  return getImpl(impl).serialize(doc);
}

export function render(doc: DocModel, theme: ThemeName = 'page', impl?: string): string {
  return getImpl(impl).render(doc, theme);
}

export function diff(base: DocModel, head: DocModel, impl?: string): StructuredDiff {
  return getImpl(impl).diff(base, head);
}

export function merge(
  base: DocModel,
  ours: DocModel,
  theirs: DocModel,
  impl?: string,
): DocModel | Conflict[] {
  return getImpl(impl).merge(base, ours, theirs);
}
