# CV-06 — Model-agnostic protocol: CLI-engine + per-agent shims · sub-plan

**Slice:** CV-06 · **Branch:** `feat/v1-cv-00-document-seam`
**Parent:** [build plan](./2026-06-01-mirador-v1-convergence-build-plan.md) · **Design:** [convergence design](../specs/2026-06-01-mirador-v1-convergence-design.md) §13 · **Deps:** CV-03
**Status:** ✅ Complete (2026-06-01) — 120 tests pass · lint + tsc clean · bundle builds · `shim install` smoke-tested.

## Goal

Confirm all deterministic work is CLI-side; ship thin shims for a second and third agent alongside the Claude skill; keep manual mode a clean floor. The collaboration intelligence lives **invisibly** in each shim — light, jargon-free.

## Decisions

- **One shim dir, three agents:** `v1/shims/{claude/SKILL.md, codex/AGENTS.md, gemini/GEMINI.md}` (the Claude shim moved here from `v1/skill/`). Each carries the **same contract** in that agent's idiom: brain = your own memory; on open/pull → frame the handoff packet through your brain into a tabular one-screen brief citing intents, ending in 2–3 next-refinements, no prose, vectored to the vision; refine by section; on push auto-draft a one-line intent + **silently infer the move (never named)**; everything routes through `mirador`.
- **`skill.ts` generalized** to `installShim(agent)` resolving `shims/<agent>/<file>` → the agent's install dir (`claudeSkill`/`codexSkill`/new `geminiSkill`). `installClaudeSkill`/`installCodexSkill`/`installGeminiShim` are thin wrappers. `package.json` files: `skill` → `shims`.
- **`mirador shim install [--agent]`** detects the agent via the brain-source resolver (generic → fullest = claude) or honors `--agent`. Wired into `init` (installs the detected agent's shim; slash command for claude). `upgrade`'s shim install is deferred to CV-08.
- **Engine audit is a test:** no LLM SDK import / API URL anywhere in `src/` (SAD §10). Shims contain guidance only — no business logic, no user-facing role/move vocabulary (asserted).
- **Parity scope (design §18):** Claude full; Codex + Gemini at functional parity (shim installed, same contract); manual mode (`mirador handoff` + `push --intent`) is the floor for any agent.

## Modules

- **Moved:** `v1/skill/SKILL.md` → `v1/shims/claude/SKILL.md`.
- **New:** `v1/shims/codex/AGENTS.md`, `v1/shims/gemini/GEMINI.md`, `commands/shim.ts`.
- **Changes:** `services/skill.ts` (per-agent install), `shared/paths.ts` (`geminiSkill`), `wizard/run.ts` (install detected agent's shim), `src/index.ts` (register), `package.json` (`files`).

## Acceptance → coverage

| Acceptance (CV-06) | Covered by |
|---|---|
| refine + handoff loop runs in Claude **and** ≥1 other agent via its shim, same CLI | three shims carry the same contract + `shim install` smoke; **full multi-agent run = manual** |
| manual mode (no shim): `mirador handoff` + `push --intent` give the full loop | CV-02/CV-03 (works by copy-paste) |
| shims contain no business logic, no user-facing role/move vocabulary | `cv06-shims.test.ts` (contract + invisible-move + engine audit) |
| shim contract test: each shim instructs the same packet→brief shape | `cv06-shims.test.ts` (per-agent) |

## Out of scope (later)

- `upgrade` installing the detected shim + removing legacy `skill/` remnants → **CV-08**.
- Codex/Gemini auto-discovery specifics (project-root vs home) → left to the agent; the file is installed at `<home>/skills/mirador/`.
