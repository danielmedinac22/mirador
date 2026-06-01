# CV-07 — Agent-mediated onboarding + tiered ladder · sub-plan

**Slice:** CV-07 · **Branch:** `feat/v1-cv-00-document-seam`
**Parent:** [build plan](./2026-06-01-mirador-v1-convergence-build-plan.md) · **Design:** [convergence design](../specs/2026-06-01-mirador-v1-convergence-design.md) §14 · **Deps:** CV-06
**Status:** ✅ Complete (2026-06-01) — 124 tests pass · lint + tsc clean · bundle builds · `comment` smoke-tested.

## Goal

The invitation seed **onboards-to-refine**: paste it into your agent and it installs the CLI if missing, clones, reads your brain, briefs you, and leaves you refining — zero manual setup. The landing offers tiered CTAs (T0 read / T1 comment / T2 refine). Convergence is distribution.

## Decisions

- **Seed = onboard-to-refine** (`promptSeed.ts`): the `@mirador-invitation` carries the repo + the three steps the agent executes (`npm i -g mirador-cli` → `git clone <repo>` → `mirador open <artifact>`), plus the T0/T1/T2 rungs. Also **fixed** a pre-existing `Read-only` compose/parse mismatch (compose wrote `Read-only:`, parse read `Read-only preview`) so the preview round-trips.
- **Onboarding is agent-executed via the shim** — there is no `mirador onboard` verb; the CLI stays a deterministic engine, the shim orchestrates install/clone/open/refine. All three shims (`claude`/`codex`/`gemini`) gained the invitation-paste flow + the onward-share growth loop.
- **Tiered landing** (`landingPage.ts`): T0 read (the preview link), T1 comment (paste-back `@mirador-response`, no CLI), T2 refine (the seed). Primary CTA → "Open & refine".
- **T1 comment:** `mirador comment <slug> --text` composes a paste-back `@mirador-response` with a new `commented` status; the owner ingests it via the existing response/inbox machinery. The CLI-free path is the agent composing the same block per the shim.

## Modules

- **Changes:** `services/promptSeed.ts` (onboard-to-refine invitation, `Read-only` fix, `commented` status), `services/landingPage.ts` (T0/T1/T2 ladder), `shims/{claude,codex,gemini}` (invitation onboarding flow + onward share), `src/index.ts` (register).
- **New:** `commands/comment.ts`.
- **Reuses:** existing `share` / `accept` / `inbox` machinery; `mirador share` already lets an onboarded collaborator share onward.

## Acceptance → coverage

| Acceptance (CV-07) | Covered by |
|---|---|
| Paste a seed → CLI present, cloned, brain-shaped handoff, open refine session — zero setup | seed carries the flow + shim instructs it (`cv07-onboarding.test.ts`); **full agent-executed paste→refine = manual** |
| Landing renders T0 / T1 / T2 (design §14) | `renderLanding` + `cv07-onboarding.test.ts` |
| T1 comment → paste-back `@mirador-response`; appears in owner's inbox | `mirador comment` + `commented` status + existing inbox |
| Growth loop closes: a newly-onboarded collaborator can `share` onward | shims instruct it + existing `share` |
| Integration test for seed → onboarded-refine (mocked installer) | seed/landing/comment unit + shim contract; full install/clone is agent-side (manual) |

## Honest limits (flagged)

- The seed *content* and the shim *instructions* for onboarding are tested; the actual `npm i -g` + `git clone` + `mirador open` is executed by the agent (per the shim), so the end-to-end paste→refine is a manual confirmation — inherent to agent-mediated onboarding.

## Out of scope (later)

- A managed installer / one-click web onboarding → hosted cloud (separate spec).
- Rich inbox rendering of comments → reuses existing inbox; polish later.
