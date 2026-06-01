# CV-04 — Convergence anchor: vision + owner + state · sub-plan

**Slice:** CV-04 · **Branch:** `feat/v1-cv-00-document-seam`
**Parent:** [build plan](./2026-06-01-mirador-v1-convergence-build-plan.md) · **Design:** [convergence design](../specs/2026-06-01-mirador-v1-convergence-design.md) §11 · **Deps:** CV-02, CV-03
**Status:** ✅ Complete (2026-06-01) — 111 tests pass · lint + tsc clean · bundle builds · `vision`/`status` smoke-tested.

## Goal

Give convergence an anchor: a **vision** in the artifact frontmatter (owner-gated to evolve), an **owner** who arbitrates same-section conflicts, and a computed **convergence state** (locked / contested / open). The handoff becomes a **vector** (toward/away from the vision), not just a delta.

## Decisions

- **Vision lives in frontmatter** (design §11.1, the source of truth) — *not* duplicated in the manifest. `vision.ts` reads/sets it via the document seam (parse → set → serialize), preserving sections. **No auto-commit** (design §3.6): `--set` writes `source.md`; the owner reviews + pushes.
- **Owner-gating:** an unshared draft (no manifest) or one with no declared owner is yours; once an owner is declared, only they may `--set`. (`isOwner`, reusing the manifest `owner` + `effectiveRole`.)
- **Convergence state is computed, not stored** (SAD §3.2) — derived from intent-note **move** tags in commit order: latest `endorse` → **locked**; any unresolved challenge move (`critique`/`question`/`reframe`) → **contested**; else **open**. No `manifest.locked` field. Moves stay internal; only the resulting state shows.
- **Arbitration:** `arbitrationFor(Conflict[], owner)` routes CV-00's same-section conflicts to the owner with both sides attached. (Wiring it into a live pull-merge is later; CV-04 exposes the computation + surfaces contested sections in `status`.)
- **Vector:** the packet already carries `vision` (CV-03); the shim contract already frames toward/away. The demo framer now annotates each change as `→ toward vision` / `· neutral` (keyword overlap with the vision) so the vector is reproducible.

## Modules

- **New:** `services/vision.ts` (read/set/isOwner/isPlaceholder), `services/convergence.ts` (computeConvergence + arbitrationFor), `commands/vision.ts`, `commands/status.ts`.
- **Changes:** `src/index.ts` (register), `demo/twoBrainFramer.mjs` (vision vector). `services/role.ts`/manifest reused unchanged (owner already present).

## Acceptance → coverage

| Acceptance (CV-04) | Covered by |
|---|---|
| New artifacts get an auto-drafted one-line vision; `mirador vision --set` owner-gated | CV-00 scaffold + `vision.ts`/`vision` cmd + `vision.test.ts` |
| `mirador status` renders locked/contested/open (design §11.3) from real data | `convergence.ts` + `status` cmd + `cv04-convergence.test.ts` + smoke |
| Same-section conflict routes to the owner with both intent notes attached | `arbitrationFor` + `cv04-convergence.test.ts` |
| Handoff brief references direction relative to the vision (vector) | demo framer vector + `cv04-vision-vector.test.ts` |
| Unit tests for state computation; integration for conflict → arbitration | `cv04-convergence.test.ts` |

## Out of scope (later slices)

- Auto-merging on pull and live conflict surfacing in the cockpit → **CV-05**.
- Per-agent shims framing the vector → **CV-06**.
- A dedicated `mirador resolve` interaction → future (status points at it; arbitration data is ready).
