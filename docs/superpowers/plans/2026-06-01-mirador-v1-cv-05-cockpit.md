# CV-05 — Live cockpit (mirror-first, then convergence) · sub-plan

**Slice:** CV-05 · **Branch:** `feat/v1-cv-00-document-seam`
**Parent:** [build plan](./2026-06-01-mirador-v1-convergence-build-plan.md) · **Design:** [convergence design](../specs/2026-06-01-mirador-v1-convergence-design.md) §12 · **Deps:** CV-00 (mirror), CV-03 (convergence surfacing)
**Status:** ✅ Complete (2026-06-01) — 115 tests pass · lint + tsc clean · bundle builds · `mirador watch` smoke-tested.

## Goal

`mirador watch <slug>` — a **local, read-only mirror** that hot-reloads the rendered view as the agent edits `source.md`, then surfaces incoming handoffs when convergence lands via git.

## Decisions

- **Supersedes SAD ADR-001 ("no file watcher / daemon") for `watch` only** — by the convergence design's explicit intent (§12, §15). The cockpit is a **foreground, user-invoked** process (runs until Ctrl-C), **localhost-only** (binds `127.0.0.1`), **one-way** (SSE; no editing channel), and **publishes nothing**. Not a background daemon.
- **SSE over websockets** (design §18 — simpler, sufficient for a one-way mirror).
- **iframe + static serving:** the cockpit shell hosts the rendered view in an `<iframe src="/view">`; the local server also serves `site-assets` (`/themes/*.css`, `/fonts.css`, `/assets`) so the view is fully themed. `resolveSiteAssetsRoot` is now exported for this.
- **Mirror-first, then convergence:** `fs.watch(source.md)` → push `reload`; a poll loop (`git fetch` + HEAD-change) → `assembleHandoff` → push `handoff` + `reload`. Convergence still arrives async via git; the only live channel is local.
- **`refresh()`/`checkRemote()` are exposed + directly testable** — the `fs.watch`/`setInterval` wiring is thin glue, so the reload/surface pipelines are asserted without depending on watcher/timer timing.
- **Shell is generated inline** in `cockpit.ts` (no new `site-assets` file) — minimal, zero-JS-dep, theme-var-aware.

## Modules

- **New:** `adapters/localServer.ts` (HTTP + SSE + static, localhost-only), `services/cockpit.ts` (`startCockpit`, `keepCockpitAlive`, the read-only shell), `commands/watch.ts`.
- **Changes:** `adapters/git.ts` (+`fetchRemote`), `services/siteChrome.ts` (export `resolveSiteAssetsRoot`), `commands/refine.ts` (`--watch` auto-starts the cockpit), `src/index.ts` (register).

## Acceptance → coverage

| Acceptance (CV-05) | Covered by |
|---|---|
| Mirror: editing the source hot-reloads the view ~1s; read-only | `refresh → reload` SSE test + `mirador watch` smoke; **live browser reload = manual** |
| Convergence: a fetch bringing a refinement updates the mirror + surfaces the brief | `commit → checkRemote → handoff` SSE test; **real remote fetch = manual** |
| Convergence arrives async via git; only live channel is local | SSE is localhost-only; `checkRemote` is git-driven |
| Cockpit is local-only (binds localhost); nothing published by `watch` | server binds `127.0.0.1`; smoke asserts `127.0.0.1` URL |
| Integration test watch → edit → reload; fetch → surface | `localServer.test.ts`, `cv05-cockpit.test.ts` |

## Honest limits (flagged)

- Automated tests cover the server, the render-on-refresh pipeline, and the new-commit → surface pipeline. The **actual browser hot-reload** and a **real remote fetch** (needs a second clone / remote) are manual confirmations — inherent to a live UI + git sync, and called out per the build-stance check-in.

## Out of scope (later)

- Conflict resolution UI in the cockpit → builds on CV-04 arbitration; future.
- Multi-artifact / dashboard cockpit → future.
