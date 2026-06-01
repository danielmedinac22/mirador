# CV-03 — Handoff packet + brain-shaped brief ⭐ keystone · sub-plan

**Slice:** CV-03 (the killer demo) · **Branch:** `feat/v1-cv-00-document-seam`
**Parent:** [build plan](./2026-06-01-mirador-v1-convergence-build-plan.md) · **Design:** [convergence design](../specs/2026-06-01-mirador-v1-convergence-design.md) §10 · **Deps:** CV-00 + CV-01 + CV-02
**Status:** ✅ Complete (2026-06-01) — 104 tests pass · lint + tsc clean · bundle builds · `handoff`/`open` + two-brain demo smoke-tested.

## Goal

On open/pull the CLI assembles a deterministic **handoff packet** (structured diff since last-seen + intent notes for those changes + a **brain-source pointer**, no brain content on the agent path); the reader's agent frames it through *their own* brain into a one-screen brief ending in concrete next-refinements. **Two brains → visibly different briefs.**

## Decisions

- **Packet = deterministic, brain-content-free** (design §8.2 agent path). It carries a brain *pointer* (`{agent,label}`) only; the agent reads its own memory. The CLI never frames the brief (no LLM, SAD §10) — `renderHandoff` is the manual-mode raw packet.
- **Diff range = last-seen → HEAD.** `last_open_commit` (already on `LastSeenEntry`) is the per-artifact last-seen ref; `open` advances it to HEAD. `mirador handoff --since <ref>` overrides.
- **Intents mapped to sections:** `commitRefinement` now records `note.sections` (anchors changed vs HEAD), so the handoff can tie each intent to the exact sections it explains. The move stays internal — never printed by `handoff`/`open`.
- **`open` branches:** git-tracked markdown++ artifact → handoff brief (+ advance last-seen); else the legacy file-mtime brief (keeps non-git session.test/e2e green).
- **The two-brain payoff is reproducible, not just manual:** a deterministic **demo stand-in framer** (`demo/twoBrainFramer.mjs`, *not* in `src/`) frames the same packet through two brain fixtures → two different briefs, asserted in a green test and runnable via `npm run demo:two-brains`. Production briefs come from the agent; the stand-in only makes the "difference is the brain" claim testable.

## Modules

- **New:** `services/handoff.ts` (`assembleHandoff`, `renderHandoff`), `commands/handoff.ts`, `demo/twoBrainFramer.mjs`, `demo/two-brains.mjs`.
- **Changes:** `adapters/git.ts` (+`headSha`, +`commitsBetween`), `services/session.ts` (open → handoff branch), `services/refine.ts` (record `note.sections`), `src/index.ts` (register), `adapters/claudeCode.ts` session skill + `v1/skill/SKILL.md` (brief-framing contract: read your own brain → frame the packet → tabular one-screen brief ending in 2–3 next-refinements, no prose), `package.json` (demo script), `biome.json` (ignore `demo`).

## Acceptance → coverage

| Acceptance (CV-03) | Covered by |
|---|---|
| `mirador handoff` emits a deterministic packet (diff + intents + brain pointer; no brain content) | `cv03-handoff.test.ts` + smoke |
| two different brains → measurably different briefs (fixture test + manual confirm) | `cv03-two-brain-demo.test.ts` + `npm run demo:two-brains` |
| brief is tabular / single-critical-item, cites intents, ends in next-refinements, no AI-prose | shim contract (SKILL.md + session skill) + demo framer |
| manual mode: `mirador handoff` usable with no shim | `renderHandoff` (tabular packet) + smoke |
| integration test open → handoff; golden on the brief shape | `cv03-handoff.test.ts`, `cv03-two-brain-demo.test.ts` |

## Honest limits

- The *automated* tests prove the packet is deterministic and the framer is brain-sensitive. The production briefs come from the agent via the shim; the live "two machines, two real brains" confirmation (design §17.1) remains a manual demo. The demo harness is a faithful, reproducible stand-in — not the agent itself.

## Out of scope (later slices)

- Vision **vector** (toward/away) + owner arbitration of same-section conflicts → **CV-04**.
- Surfacing the handoff in the live cockpit → **CV-05**.
- Per-agent (Codex/Gemini) brief-framing shims → **CV-06**.
