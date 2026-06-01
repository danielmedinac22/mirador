# CV-00 — The document seam (markdown++ core) · detailed sub-plan

**Slice:** CV-00 · **Branch:** `feat/v1-cv-00-document-seam`
**Parent plan:** [`2026-06-01-mirador-v1-convergence-build-plan.md`](./2026-06-01-mirador-v1-convergence-build-plan.md)
**Design:** [`../specs/2026-06-01-mirador-v1-convergence-design.md`](../specs/2026-06-01-mirador-v1-convergence-design.md) §7 · **SAD:** [`../specs/2026-05-21-mirador-v1-sad.md`](../specs/2026-05-21-mirador-v1-sad.md) §2
**Status:** ✅ Complete (2026-06-01) — 94 tests pass · lint + tsc clean · bundle builds · CLI smoke-tested (`new`/`preview`/`diff`). All acceptance criteria met (see §4).

---

## 0. Goal (restated)

A **format-agnostic `document` interface** + a **markdown++ implementation**. `mirador new` produces a markdown++ source; the view renders via the existing themes; a structured **section-level** diff between two versions is clean and legible; section-granular **merge** returns `Conflict[]` (never throws) on same-section edits.

Every later slice operates on this interface — never on markdown strings. This is the substrate shift: **HTML → markdown++ source → rendered HTML view.**

---

## 1. Decisions locked for this slice (resolving design §18 where relevant)

### 1.1 — Markdown parser: `markdown-it` + `yaml` (pinned)

| Dep | Version | Why |
|---|---|---|
| `markdown-it` | `14.2.0` | Render (md → semantic HTML) is its core competency; output matches the themes, which style semantic elements under `.mirador-content`. Single package; extensible fence rules for the rich blocks. |
| `yaml` | `2.9.0` | Parse/serialize the frontmatter (`vision`, `owner`, persisted anchors). |
| `@types/markdown-it` (dev) | `14.1.2` | Types. (`yaml` ships its own.) |

**Rejected:** the `unified`/`remark`/`mdast` constellation. The design names it only as an example ("e.g. remark/mdast"). It would pull ~8 runtime packages for a CLI we ship on npm. Crucially, **our convergence machinery (diff/merge) does not need an AST** — see §1.2 — so mdast's tree buys us nothing for the seam while costing dependency weight. markdown-it is the lean, sufficient choice. (§0.4: pick one, pin it, note it — **noted for review**.)

### 1.2 — diff/merge operate on **anchor-segmented raw markdown**, not on the parser AST

The `DocModel` splits the source into **sections** keyed by **stable anchors**. Each section carries its **raw markdown body** (the exact source substring). `diff` and `merge` compare/combine sections by anchor using their raw bodies. The parser (markdown-it) is used **only for `render`** (md → HTML) and for frontmatter (yaml).

Why this matters architecturally: it keeps the **format seam honest**. The diff/merge contract is "sections of opaque body text keyed by anchor" — *not* "mdast nodes". A future `blocks`/`canvas` `DocModel` supplies its own sections and the same contract holds, with zero change to the convergence code. The wedge does not depend on the format's internal representation.

### 1.3 — Section anchors: **hybrid** (design §18 recommendation)

1. **Explicit** wins: `## Risks {#risks}` → anchor `risks`.
2. **Auto-derive** otherwise: slugify heading text (`Q3 Outlook` → `q3-outlook`), dedupe with `-2`, `-3`.
3. **Persist on serialize:** `serialize(doc)` writes derived ids back as explicit `{#id}` so anchors are stable across later heading-*text* edits. `mirador new` scaffolds headings **with explicit anchors from birth**, so new artifacts are stable immediately; persist-on-serialize covers hand-authored / migrated sources.

Anchor = the **diff / merge / lock unit** (lock arrives CV-04).

### 1.4 — Source file convention: `<artifact>/source.md`

The markdown++ **source of truth**. Frontmatter carries `vision:` (placeholder in CV-00; owner-gated evolution is CV-04) and an optional `title`. The rendered HTML is **computed**, never stored in the artifact.

### 1.5 — Raw-HTML escape hatch (broadcast-only)

If an artifact has **no `source.md`** but has an `index.html`/`*.html` (publish-era artifacts, or bespoke HTML), `render` falls back to the existing wrap-in-theme path — **publishes, but no diff/merge** (design §7.4). New artifacts default to markdown++.

### 1.6 — Fenced rich blocks (typed nodes, minimal render)

| Fence | Body | Renders to | Themed by |
|---|---|---|---|
| ` ```callout note\|warn\|quote ` | markdown | `<aside class="callout callout-{kind}">…</aside>` | small shared rule in `tokens.css` |
| ` ```table ` | CSV (header row + rows) | semantic `<table><thead><tbody>` | `page`/`atlas` table CSS (atlas → sticky/zebra) |
| ` ```chart ` | yaml spec (`type: bar`, `data: [{label,value}]`) | static CSS-bar `<div class="chart">` (no JS, zero deps) | small shared rule in `tokens.css` |

CV-00 only requires these to **parse to typed nodes and render under `atlas`/`page`**. Renders are intentionally minimal+static (quality bar: zero external JS in the view).

**Where the block CSS lives — corrected during build:** the preview/published view shell links *only* `/themes/<theme>/theme.css` (which `@import`s `fonts.css`); `tokens.css` is **not** loaded on the artifact view. So the rich-block primitives ship as a tiny **inline `<style>` in the render shell** (`document/shell.ts`) — theme-var-aware with literal fallbacks, self-contained, loads on preview + published view + cockpit with zero `siteChrome` plumbing. The 5 theme files are reused unchanged as renderers; no `tokens.css` edit.

### 1.7 — `mirador diff <slug>` source of the "two versions"

CV-00 diffs the **working-tree `source.md`** against its **last git-committed version** (`git show HEAD:<relpath>`), via a thin read in `adapters/git.ts`. If there's no prior committed version, print "no prior version to diff." (Wiring diff to `last-seen` → handoff packet is **CV-03**, not here.)

### 1.8 — Non-breaking constraint on `changeLog.ts`

`session.ts` consumes `changesSince()` → `FileChange[]`. CV-00 **keeps that intact** and **adds** a structured-diff delegation (`structuredDiff(base, head)` → `document.diff`). Rewiring `open`/session to consume the structured diff is **CV-03**.

---

## 2. Module layout

```
v1/src/services/document/
  types.ts        DocModel · Section · Frontmatter · StructuredDiff · SectionChange · Conflict · DocumentImpl · ThemeName(re-export)
  index.ts        the interface + registry: registerImpl/getImpl; parse/render/diff/merge/serialize dispatch; default = markdown++
  markdown.ts     impl #1: parse · serialize · render · diff · merge · anchors · frontmatter · fenced rich blocks
  markdown.test.ts
  index.test.ts
```

**Changed:** `services/staticPreview.ts` (render via `document` when `source.md` present; keep escape hatch) · `services/artifact.ts` (`createArtifact` scaffolds `source.md`) · `services/changeLog.ts` (add structured-diff delegation; keep `changesSince`) · `commands/new.ts` (markdown++ scaffold UX) · `adapters/git.ts` (add `showFileAtRef`) · `src/index.ts` (register new commands) · `site-assets/themes/tokens.css` (minimal `.callout`/`.chart`).
**New commands:** `commands/preview.ts`, `commands/diff.ts`.
**Reuses:** `site-assets/themes/*` unchanged as renderers.

Dependency direction stays one-way (`commands → services → adapters → shared`). The `document` service imports only `markdown-it`, `yaml`, and `shared/`.

---

## 3. Tasks (TDD — test first where a unit exists; bite-sized)

> Convention (§0.4): ≥1 feature + 1 test commit. Privacy-critical paths get an assertion test (n/a here — no brain path in CV-00).

- **T1 — deps.** Add `markdown-it@14.2.0`, `yaml@2.9.0`, dev `@types/markdown-it@14.1.2`; pin (no `^`). Build still green.
- **T2 — `types.ts`.** `DocModel { frontmatter, sections: Section[], raw }`, `Section { anchor, depth, headingText, body, blocks? }`, `Frontmatter { vision?, owner?, title?, [k] }`, `StructuredDiff { changes: SectionChange[] }`, `SectionChange { anchor, headingText, kind: 'added'|'removed'|'modified' }`, `Conflict { anchor, base, ours, theirs }`, `DocumentImpl` interface, re-export `ThemeName`.
- **T3 — parse + anchors + frontmatter** (`markdown.ts`). Tests: split sections at headings; explicit `{#id}`; auto-derive + dedupe; preamble (content before first heading) as an anchorless lead section; frontmatter `vision`/`owner` parsed; `serialize` round-trips and persists derived anchors as `{#id}`.
- **T4 — render(doc, theme)** → HTML. Semantic markdown-it output, each section wrapped `<section id="{anchor}">`, all inside `.mirador-content`; document → `<!doctype>` shell reusing theme `<link>` (mirror current `staticPreview` wrapper). **Golden test per theme** (page, memo, deck, console, atlas) on a canonical fixture doc — round-trips look.
- **T5 — fenced rich blocks** (callout/table/chart) → typed nodes + render; tests assert HTML under `page` + `atlas`. Add minimal `.callout`/`.chart` to `tokens.css`.
- **T6 — diff(base, head)** → `StructuredDiff`. Tests: edit §B reports **only** §B (§A unchanged, absent from changes); added/removed/modified; reorder without content change = no content changes.
- **T7 — merge(base, ours, theirs)** → `DocModel | Conflict[]`. Tests: disjoint sections merge clean; identical same-section edits merge clean; divergent same-section edits → `Conflict[]` (**returns, never throws**); added-on-one-side included.
- **T8 — `index.ts` registry.** `registerImpl('markdown', impl)`, `getImpl(name?)` (default markdown); dispatch helpers `parse/render/diff/merge/serialize`. Test: dispatch + unknown-impl error.
- **T9 — `staticPreview.ts` wiring.** If `source.md` present → `document.render`; else escape-hatch (existing wrap). Tests: markdown++ render; raw-HTML escape hatch still publishes.
- **T10 — `artifact.ts` scaffold.** `createArtifact` writes `source.md` (frontmatter `vision:` placeholder + a `# {slug} {#overview}` lead + a starter `## Section {#section}`), seeded by `purpose`/`audience`. Update `artifact.test.ts`. Keep `request.ts` compiling.
- **T11 — `new.ts` UX.** Outro mentions the markdown++ source + `mirador preview`.
- **T12 — `commands/preview.ts`** (new). Render `source.md` → HTML, write `<artifact>/.mirador/preview.html`, print path; `--theme`. Register in `index.ts`.
- **T13 — `commands/diff.ts`** (new). `git show HEAD:<rel>` (via `adapters/git.ts` `showFileAtRef`) vs worktree `source.md` → `document.diff` → legible table. No prior version → friendly notice. Register.
- **T14 — `changeLog.ts`.** Add `structuredDiff(baseSource, headSource)` → `document.diff`. Keep `changesSince`/`FileChange`.
- **T15 — integration.** `new → preview` round-trips markdown++ → themed HTML (extend `tests/e2e.test.ts` or a new integration test). `diff` after editing one section reports only that section.
- **T16 — green + commit.** `npm run lint && npx tsc --noEmit && npm test` all green. Commit in feature/test pairs.

---

## 4. Acceptance criteria → task map

| Acceptance (parent plan CV-00) | Covered by |
|---|---|
| parse → render round-trips to themed HTML identical in look (golden per theme) | T3, T4 |
| stable anchors; diff of "edit §B" reports only §B | T3, T6 |
| merge clean on different sections; `Conflict[]` (not throw) on same section | T7 |
| fenced chart/table/callout parse to typed nodes + render under atlas/page | T5 |
| raw-HTML escape hatch still publishes (broadcast-only) | T9 |
| unit tests parse/render/diff/merge; integration `new → preview` | T3–T8, T15 |

---

## 5. Out of scope (explicit — deferred to later slices)

- Wiring `open`/session/last-seen to the structured diff → **CV-03**.
- Intent notes, moves, handoff packet → **CV-02/CV-03**.
- Vision *evolution* + owner arbitration + convergence state → **CV-04**.
- Block/canvas `DocModel` impls → post-V1 (the seam allows them).
- Rich chart rendering beyond a static bar → future; CV-00 only needs typed-node + minimal render.

---

## 6. Risks / watch-items

- **Golden tests brittle to markdown-it output churn:** pin the version (no `^`); snapshot the canonical fixture, not arbitrary input.
- **Anchor stability vs heading edits:** persist-on-serialize is the guard; verify a heading-text edit keeps the anchor (T3 test).
- **`request.ts` + `artifact.test.ts` ripple from the `source.md` switch:** update in T10; full suite in T16 is the backstop.
- **Escape-hatch regressions:** T9 keeps an explicit raw-HTML test.
