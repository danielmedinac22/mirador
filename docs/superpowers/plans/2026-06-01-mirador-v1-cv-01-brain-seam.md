# CV-01 — Brain = agent-native memory (brain seam) · sub-plan

**Slice:** CV-01 · **Branch:** `feat/v1-cv-00-document-seam` (wave-1, building on the same branch)
**Parent:** [build plan](./2026-06-01-mirador-v1-convergence-build-plan.md) · **Design:** [convergence design](../specs/2026-06-01-mirador-v1-convergence-design.md) §8
**Status:** In progress (2026-06-01)

## Goal

Replace the wizard-scaffolded brain *store* with **brain-source adapters** that read the agent's living memory (Claude Code memory + `CLAUDE.md`; Codex `AGENTS.md`; Gemini `GEMINI.md`; generic convention fallback). No wizard, no parallel store, read-only. `mirador brain` becomes a **diagnostic**; `mirador init` drops the brain wizard and instead detects + confirms the brain source.

## Decisions

- **Detection precedence:** `MIRADOR_AGENT` override → Claude (memory dir exists) → Gemini (`GEMINI.md`) → Codex (`AGENTS.md`) → **generic** (always; reads `AGENTS.md`/`CLAUDE.md` if present, else cold-start baseline). A bare `CLAUDE.md` with no memory dir → generic (the Claude-Code signal is the memory dir).
- **Claude memory location:** `claudeHome()/projects/<project-slug>/memory/` where `project-slug = projectRoot().replaceAll('/', '-')` (matches the real layout, e.g. `-Users-equipo-Simetrik-html-viewer`), plus the memory `MEMORY.md` index and topic files, plus project `CLAUDE.md`.
- **Read-only, always.** No adapter writes. The brain never enters git or a packet (privacy, design §8.2). "Propose an update to the store" (brainProposals) is **obsolete** — updates happen in the agent's own memory via the agent's own mechanism.
- **Determinism for tests:** `paths.projectRoot()` = `MIRADOR_PROJECT_OVERRIDE ?? process.cwd()`; new `paths.geminiHome()` = `GEMINI_HOME_OVERRIDE ?? ~/.gemini`. `MIRADOR_AGENT` forces an adapter.
- **`config.brain` untouched** (vestigial `location` field) to avoid schema churn into `upgrade.ts`/`config` — the brain resolution ignores it and detects the agent. CV-08 removes the vestige.
- **`session.ts` stays as-is:** `listBrain()`/`loadBrain()` are kept as adapter-backed compat shims returning `BrainFile[]` (no `appliesToRole` in agent memory → the role-matched brain flag simply doesn't fire). The CLI no longer fabricates a role brain-flag; the agent reads its own brain via the shim (CV-02/03).

## Modules

- **New:** `adapters/brainSource/types.ts` (`AgentKind`, `BrainTopic`, `BrainSource`, `BrainSourceAdapter`), `…/claudeCode.ts`, `…/codex.ts`, `…/gemini.ts`, `…/generic.ts`, `…/index.ts` (resolver). `shared/paths.ts` += `projectRoot`, `geminiHome`.
- **Rewrite:** `services/brain.ts` (resolve + read; drop `scaffoldBrain`; keep `listBrain`/`loadBrain`/`brainRoot` adapter-backed). `commands/brain.ts` (diagnostic). `wizard/run.ts` (drop brain Q&A + `scaffoldBrain`; detect + confirm source). 
- **Delete:** `services/brainImport.ts`, `services/brainProposals.ts` (+ their tests). The harvest-fallback intent lives in the generic adapter's cold-start read.
- **Tests:** rewrite `brain.privacy.test.ts` (new invariant); update `brain.test.ts`, `e2e.test.ts` (drop `scaffoldBrain` + brain-flag asserts); new `adapters/brainSource/*.test.ts`.

## Acceptance → coverage

| Acceptance (CV-01) | Covered by |
|---|---|
| `mirador brain` shows resolved source + summary; nothing written to a store | diagnostic command + read-only adapters |
| Codex/Gemini resolve; unknown → generic | resolver precedence test |
| `mirador init` completes with no brain wizard; detects + confirms source | wizard change |
| Privacy: no path copies brain into a shared repo / packet (agent path) | rewritten privacy test (read-only, shared/ untouched) |
| Cold start (empty memory) degrades gracefully (generic baseline) | generic adapter returns `[]`, no throw |

## Out of scope (later slices)

- Shim text that tells the agent to read its own brain → CV-02/03/06 (session skill in `claudeCode.ts` keeps its current text for now; noted).
- Wiring the brain into the handoff packet (manual-mode local read) → CV-03.
- Removing the vestigial `config.brain.location` → CV-08.
