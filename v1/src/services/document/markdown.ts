import MarkdownIt from 'markdown-it';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { renderShell } from './shell.js';
import type {
  Conflict,
  DocModel,
  DocumentImpl,
  Frontmatter,
  Section,
  SectionChange,
  StructuredDiff,
  ThemeName,
} from './types.js';

// ── markdown-it instances ───────────────────────────────────────────────────
// `md` carries the rich-block fence rule; `mdInner` renders callout bodies
// plainly (no recursion surprises). html:true — authors trust their own source;
// the published view is sandboxed (SAD §5.3).
const mdInner = new MarkdownIt({ html: true, linkify: true });
const md = new MarkdownIt({ html: true, linkify: true });

type RenderRule = NonNullable<MarkdownIt['renderer']['rules']['fence']>;

const defaultFence: RenderRule =
  md.renderer.rules.fence ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

const fenceRule: RenderRule = (tokens, idx, options, env, self) => {
  const tok = tokens[idx];
  const block = tok ? parseRichBlock(tok.info, tok.content) : null;
  return block ? renderRichBlock(block) : defaultFence(tokens, idx, options, env, self);
};
md.renderer.rules.fence = fenceRule;

const esc = (s: string): string => md.utils.escapeHtml(s);

// ── markdown++ additions: anchors + fenced rich blocks ──────────────────────

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*$/;
const ANCHOR_RE = /\s*\{#([A-Za-z0-9][A-Za-z0-9_-]*)\}\s*$/;
const FENCE_OPEN_RE = /^\s{0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE_RE = /^\s{0,3}(`{3,}|~{3,})\s*$/;
const PREAMBLE_ANCHOR = '__preamble__';

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

interface RawSection {
  depth: number;
  headingText: string;
  explicitAnchor: string | null;
  bodyLines: string[];
}

/** Drop fully-blank leading/trailing lines; keep internal blanks. */
function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && (lines[start] ?? '').trim() === '') start++;
  while (end > start && (lines[end - 1] ?? '').trim() === '') end--;
  return lines.slice(start, end);
}

/** Split a frontmatter-less body into sections at ATX headings, fence-aware. */
function splitSections(body: string): RawSection[] {
  const lines = body.split('\n');
  const sections: RawSection[] = [];
  const preamble: string[] = [];
  let current: RawSection | null = null;
  let fence: { char: string; len: number } | null = null;

  const pushLine = (line: string): void => {
    if (current) current.bodyLines.push(line);
    else preamble.push(line);
  };

  for (const line of lines) {
    if (!fence) {
      const open = FENCE_OPEN_RE.exec(line);
      if (open?.[1]) {
        fence = { char: open[1][0] ?? '`', len: open[1].length };
        pushLine(line);
        continue;
      }
      const hm = HEADING_RE.exec(line);
      if (hm?.[1]) {
        let text = hm[2] ?? '';
        let explicitAnchor: string | null = null;
        const am = ANCHOR_RE.exec(text);
        if (am?.[1]) {
          explicitAnchor = am[1].toLowerCase();
          text = text.slice(0, am.index);
        }
        current = { depth: hm[1].length, headingText: text.trim(), explicitAnchor, bodyLines: [] };
        sections.push(current);
        continue;
      }
      pushLine(line);
      continue;
    }
    // inside a fence: only a matching bare fence closes it
    const close = FENCE_CLOSE_RE.exec(line);
    if (close?.[1] && close[1][0] === fence.char && close[1].length >= fence.len) {
      fence = null;
    }
    pushLine(line);
  }

  const result: RawSection[] = [];
  if (preamble.some((l) => l.trim() !== '')) {
    result.push({
      depth: 0,
      headingText: '',
      explicitAnchor: null,
      bodyLines: trimBlankEdges(preamble),
    });
  }
  for (const s of sections) {
    s.bodyLines = trimBlankEdges(s.bodyLines);
    result.push(s);
  }
  return result;
}

/** Assign stable anchors: explicit wins; else slug; dedupe with -2, -3, … */
function assignAnchors(raws: RawSection[]): Section[] {
  const used = new Set<string>();
  const out: Section[] = [];
  for (const r of raws) {
    let anchor: string;
    if (r.depth === 0) {
      anchor = PREAMBLE_ANCHOR;
    } else {
      const base = r.explicitAnchor ?? slugify(r.headingText);
      anchor = base;
      let n = 2;
      while (used.has(anchor)) anchor = `${base}-${n++}`;
    }
    used.add(anchor);
    out.push({ anchor, depth: r.depth, headingText: r.headingText, body: r.bodyLines.join('\n') });
  }
  return out;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function extractFrontmatter(source: string): { frontmatter: Frontmatter; body: string } {
  const m = FRONTMATTER_RE.exec(source);
  if (!m) return { frontmatter: {}, body: source };
  try {
    const parsed: unknown = parseYaml(m[1] ?? '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { frontmatter: parsed as Frontmatter, body: source.slice(m[0].length) };
    }
  } catch {
    // malformed frontmatter → treat as none, keep full source as body
  }
  return { frontmatter: {}, body: source };
}

function serializeFrontmatter(fm: Frontmatter): string {
  const keys = Object.keys(fm).filter((k) => fm[k] !== undefined);
  if (keys.length === 0) return '';
  const ordered: Frontmatter = {};
  for (const k of keys) ordered[k] = fm[k];
  return `---\n${stringifyYaml(ordered).trimEnd()}\n---`;
}

// ── Rich blocks (callout / table / chart) ───────────────────────────────────

export type RichBlock =
  | { type: 'callout'; kind: 'note' | 'warn' | 'quote'; markdown: string }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | {
      type: 'chart';
      chartType: string;
      title?: string;
      data: Array<{ label: string; value: number }>;
    };

const RICH_RE = /^(callout|table|chart)\b\s*(.*)$/;

/** Parse a fenced block's info-string + content into a typed rich-block node. */
export function parseRichBlock(info: string, content: string): RichBlock | null {
  const m = RICH_RE.exec(info.trim());
  if (!m?.[1]) return null;
  const kind = m[1];
  const arg = (m[2] ?? '').trim();

  if (kind === 'callout') {
    const k = arg === 'warn' || arg === 'quote' ? arg : 'note';
    return { type: 'callout', kind: k, markdown: content };
  }

  if (kind === 'table') {
    const rows = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '')
      .map((l) => l.split(',').map((c) => c.trim()));
    const [head, ...body] = rows;
    return { type: 'table', columns: head ?? [], rows: body };
  }

  // chart
  try {
    const spec: unknown = parseYaml(content);
    const rec = spec && typeof spec === 'object' ? (spec as Record<string, unknown>) : {};
    const rawData = Array.isArray(rec.data) ? rec.data : [];
    const data = rawData.map((d) => {
      const o = d && typeof d === 'object' ? (d as Record<string, unknown>) : {};
      return { label: String(o.label ?? ''), value: Number(o.value) || 0 };
    });
    return {
      type: 'chart',
      chartType: typeof rec.type === 'string' ? rec.type : 'bar',
      title: typeof rec.title === 'string' ? rec.title : undefined,
      data,
    };
  } catch {
    return { type: 'chart', chartType: 'bar', data: [] };
  }
}

function renderRichBlock(b: RichBlock): string {
  if (b.type === 'callout') {
    return `<aside class="callout callout-${b.kind}">\n${mdInner.render(b.markdown)}</aside>\n`;
  }
  if (b.type === 'table') {
    const thead = b.columns.length
      ? `<thead><tr>${b.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>`
      : '';
    const tbody = `<tbody>${b.rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody>`;
    return `<table class="data-table">${thead}${tbody}</table>\n`;
  }
  // chart — static CSS bars, zero JS
  const max = Math.max(1, ...b.data.map((d) => d.value));
  const rows = b.data
    .map((d) => {
      const pct = Math.max(0, Math.round((d.value / max) * 100));
      return `<div class="chart-row"><span class="chart-label">${esc(d.label)}</span><span class="chart-track"><span class="chart-bar" style="--v:${pct}%"></span></span><span class="chart-val">${esc(String(d.value))}</span></div>`;
    })
    .join('');
  const title = b.title ? `<div class="chart-title">${esc(b.title)}</div>` : '';
  return `<figure class="chart">${title}${rows}</figure>\n`;
}

// ── The DocumentImpl contract ───────────────────────────────────────────────

function parse(source: string): DocModel {
  const norm = source.replace(/\r\n/g, '\n');
  const { frontmatter, body } = extractFrontmatter(norm);
  const sections = assignAnchors(splitSections(body));
  return { frontmatter, sections, raw: source };
}

function serialize(doc: DocModel): string {
  const blocks: string[] = [];
  for (const s of doc.sections) {
    const body = s.body.replace(/\s+$/, '');
    if (s.depth === 0) {
      if (body.trim()) blocks.push(body);
      continue;
    }
    const head = `${'#'.repeat(s.depth)} ${s.headingText} {#${s.anchor}}`;
    blocks.push(body.trim() ? `${head}\n\n${body}` : head);
  }
  const parts: string[] = [];
  const fm = serializeFrontmatter(doc.frontmatter);
  if (fm) parts.push(fm);
  parts.push(blocks.join('\n\n'));
  return `${parts.join('\n\n').trimEnd()}\n`;
}

function render(doc: DocModel, theme: ThemeName): string {
  const parts: string[] = [];
  for (const s of doc.sections) {
    const bodyHtml = s.body.trim() ? md.render(s.body) : '';
    if (s.depth === 0) {
      if (bodyHtml) parts.push(`<section>\n${bodyHtml}</section>`);
      continue;
    }
    const heading = `<h${s.depth} id="${s.anchor}">${md.renderInline(s.headingText)}</h${s.depth}>`;
    parts.push(`<section id="${s.anchor}">\n${heading}\n${bodyHtml}</section>`);
  }
  const content = `<div class="mirador-content">\n${parts.join('\n')}\n</div>`;
  return renderShell(content, theme);
}

/** Normalised body for comparison — ignores trailing-whitespace / edge-blank noise. */
function normBody(s: Section): string {
  return s.body
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function sectionChanged(a: Section, b: Section): boolean {
  return a.depth !== b.depth || a.headingText !== b.headingText || normBody(a) !== normBody(b);
}

function diff(base: DocModel, head: DocModel): StructuredDiff {
  const baseMap = new Map(base.sections.map((s) => [s.anchor, s]));
  const headMap = new Map(head.sections.map((s) => [s.anchor, s]));
  const changes: SectionChange[] = [];

  for (const h of head.sections) {
    const b = baseMap.get(h.anchor);
    if (!b) {
      changes.push({ anchor: h.anchor, headingText: h.headingText, kind: 'added' });
    } else if (sectionChanged(b, h)) {
      changes.push({ anchor: h.anchor, headingText: h.headingText, kind: 'modified' });
    }
  }
  for (const b of base.sections) {
    if (!headMap.has(b.anchor)) {
      changes.push({ anchor: b.anchor, headingText: b.headingText, kind: 'removed' });
    }
  }
  return { changes };
}

function orderedAnchors(ours: DocModel, theirs: DocModel): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...ours.sections, ...theirs.sections]) {
    if (!seen.has(s.anchor)) {
      seen.add(s.anchor);
      out.push(s.anchor);
    }
  }
  return out;
}

function merge(base: DocModel, ours: DocModel, theirs: DocModel): DocModel | Conflict[] {
  const baseMap = new Map(base.sections.map((s) => [s.anchor, s]));
  const oursMap = new Map(ours.sections.map((s) => [s.anchor, s]));
  const theirsMap = new Map(theirs.sections.map((s) => [s.anchor, s]));

  const conflicts: Conflict[] = [];
  const merged: Section[] = [];

  for (const anchor of orderedAnchors(ours, theirs)) {
    const b = baseMap.get(anchor);
    const o = oursMap.get(anchor);
    const t = theirsMap.get(anchor);
    const bb = b ? normBody(b) : null;

    if (o && t) {
      if (normBody(o) === normBody(t)) {
        merged.push(o); // same content on both sides (incl. both unchanged)
        continue;
      }
      const oursChanged = bb === null || normBody(o) !== bb;
      const theirsChanged = bb === null || normBody(t) !== bb;
      if (oursChanged && !theirsChanged) merged.push(o);
      else if (!oursChanged && theirsChanged) merged.push(t);
      else {
        conflicts.push({
          anchor,
          headingText: o.headingText,
          base: b ? b.body : null,
          ours: o.body,
          theirs: t.body,
        });
        merged.push(o); // tentative; discarded if we return conflicts
      }
      continue;
    }

    if (o && !t) {
      // present in ours, absent in theirs
      if (b) {
        // theirs deleted it
        if (normBody(o) === bb) continue; // ours unchanged + theirs deleted → delete
        conflicts.push({
          anchor,
          headingText: o.headingText,
          base: b.body,
          ours: o.body,
          theirs: '',
        }); // modify/delete
        merged.push(o);
      } else {
        merged.push(o); // added only in ours → keep
      }
      continue;
    }

    if (!o && t) {
      if (b) {
        if (normBody(t) === bb) continue; // theirs unchanged + ours deleted → delete
        conflicts.push({
          anchor,
          headingText: t.headingText,
          base: b.body,
          ours: '',
          theirs: t.body,
        }); // delete/modify
        merged.push(t);
      } else {
        merged.push(t); // added only in theirs → keep
      }
    }
    // both absent → both deleted → drop
  }

  if (conflicts.length) return conflicts;
  const model: DocModel = { frontmatter: { ...ours.frontmatter }, sections: merged, raw: '' };
  model.raw = serialize(model);
  return model;
}

export const markdownImpl: DocumentImpl = {
  name: 'markdown',
  parse,
  serialize,
  render,
  diff,
  merge,
};
