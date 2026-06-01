# CV-02 — Refine + intent note · sub-plan

**Slice:** CV-02 · **Branch:** `feat/v1-cv-00-document-seam` (wave-1 batch)
**Parent:** [build plan](./2026-06-01-mirador-v1-convergence-build-plan.md) · **Design:** [convergence design](../specs/2026-06-01-mirador-v1-convergence-design.md) §9 · **Deps:** CV-00
**Status:** ✅ Complete (2026-06-01) — 100 tests pass · lint + tsc clean · bundle builds · refine→push smoke-tested.

## Goal

The refine loop. A collaborator edits the artifact through their agent; on push the writer's AI **auto-drafts an intent note** (tagged with the inferred move) that rides the commit; a structured diff is produced for the next reader's handoff (CV-03).

## Decisions

- **Two-commit push** (resolving "rides with the commit" + `<sha>` keying, design §9/§18): commit 1 = the refinement (subject = intent summary, `Mirador-Move: <move>` trailer); commit 2 = the `.mirador/intents/<sha>.md` sidecar keyed by commit 1's sha. The sidecar is rich + agent-readable; the trailer keeps `git log` legible. Both travel with the repo (unlike git-notes).
- **Move is invisible** (design §11.4): the six tags live in `moves.ts`, inferred by the shim, stored in the sidecar + trailer (machine-readable), and **never printed** by the CLI (push output omits it). Inference is shim-only for now (§18); the CLI validates + defaults to `extend`.
- **Auto-drafted, never a form** (design §9.2): `--intent` is supplied by the agent (the shim drafts it); `mirador push` requires it but the human never fills a blocking form.
- **Realpath before repo-relative pathspec** (same macOS `/tmp`→`/private` guard as CV-00's `sourceAtRef`).
- **Author** = explicit → `config.github.handle` → `you`.
- **Best-effort remote push:** commit locally always; `git push` only if a remote exists and not `--offline`.

## Modules

- **New:** `services/moves.ts` (tags + `normalizeMove`), `services/intentNote.ts` (compose/parse/trailer + sidecar write/read/list), `services/refine.ts` (`openRefine` brief; `commitRefinement(artifactPath,…)` core; `pushRefinement(slug,…)`), `commands/refine.ts`, `commands/push.ts`.
- **Changes:** `adapters/git.ts` (+`hasRemote`; reuses `commitAll`), `src/index.ts` (register), `v1/skill/SKILL.md` + `adapters/claudeCode.ts` session skill (corrected brain = agent's own memory; added the refine + auto-intent guidance; move stays invisible).

## Acceptance → coverage

| Acceptance (CV-02) | Covered by |
|---|---|
| push writes `.mirador/intents/<sha>.md` + one-line trailer; `git log` legible | `commitRefinement` + integration test + smoke |
| intent auto-drafted by the agent, editable, never a blocking form | `--intent` supplied by shim; shim guidance |
| each note carries an inferred move tag (internal); never shown to the user | trailer + sidecar; push stdout omits the move |
| `document.diff` produces the structured diff the next reader consumes | integration test (`structuredDiff(base, edited)`) |
| unit tests for intentNote round-trip; integration refine → push | `intentNote.test.ts`, `cv02-refine-intent.test.ts` |

## Out of scope (later slices)

- Assembling the handoff packet from intents + diff, and the reader's brain-shaped brief → **CV-03** (keystone).
- Auto-starting the cockpit on `refine` → **CV-05**.
- Owner arbitration of same-section conflicts + vision vector → **CV-04**.
- Full per-agent agnostic shims (Codex/Gemini) → **CV-06** (this slice only corrected + extended the Claude shim).
