# Mirador V1 — Convergence Build Plan

**Date:** 2026-06-01
**Status:** Ready to start (fresh session)
**Author:** daniel.medina@simetrik.com
**Design (read first):** [`../specs/2026-06-01-mirador-v1-convergence-design.md`](../specs/2026-06-01-mirador-v1-convergence-design.md)
**Architecture (still binding):** [`../specs/2026-05-21-mirador-v1-sad.md`](../specs/2026-05-21-mirador-v1-sad.md)
**Visual identity (still binding):** [`../../design/spec.md`](../../design/spec.md), [`../../design/voice.md`](../../design/voice.md)

---

## 0. Read this first — you are a fresh agent

You are picking up Mirador after a design grilling session that **redefined the product**. You do not need the conversation; everything is here and in the design doc. Read the design doc fully, then this plan.

### 0.1 — What Mirador-convergence is, in five sentences

Mirador was a CLI that published AI-made HTML to your Vercel. Internal use revealed it "felt like an HTML generator with extra steps" and "felt solo even when shared." The redesign: **Mirador is the medium where N private contexts converge — each through their own AI — on one living artifact, guided toward an owned vision; the HTML is just a view.** The artifact becomes a refinable **markdown++ document**; each collaborator **refines** it through their own agent (loaded with their own context = their **agent's memory**); every change carries an auto-drafted **intent note**, and on open the reader's agent turns the diff + intent into a **brain-shaped handoff brief** that ends in concrete next-steps; an **owner** holds an explicit **vision** the artifact converges toward. You watch it live in a **local read-only cockpit**.

### 0.2 — The architecture in one picture

```
WEDGE (constant): multi-context convergence on one artifact
   ├─ FORMAT SEAM   : document interface (parse/render/diff/merge); markdown++ = impl #1
   ├─ BRAIN SEAM    : per-agent memory adapters (Claude/Codex/Gemini/generic)
   └─ ENGINE/LENS   : CLI = deterministic engine · agent = lens+hands · shim = invisible guide
```

### 0.3 — Non-negotiables (from design §3 + SAD)

- **No rewrite. Evolve `v1/`.** This builds on the existing `v1/src` tree. Most modules are *extended*, a handful are *new*. Do not start a new package.
- **Module deps one-way:** `commands/ → services/ → adapters/ → shared/`. No exceptions.
- **No LLM API calls from the CLI.** All cognition is in the agent. The CLI is deterministic.
- **Convergence machinery operates on the `document` interface, never on markdown strings directly.** This is the seam that keeps the ceiling open.
- **Brain is the agent's living memory.** No separate brain store, no init wizard. The brain never enters git or a handoff packet on the agent path.
- **The cockpit is a local read-only mirror.** Not a hosted frontend, not an editor.
- **Collaboration intelligence is invisible.** No user-facing roles or move-names. Moves are system-internal tags. UX = AI + context + human, freeform.
- **Voice + visual identity unchanged** (`docs/design/spec.md`). Themes become document renderers.

### 0.4 — Global conventions (carried from the 05-21 overview)

- **Working tree:** `v1/`. **Stack:** TypeScript strict, Node 20+, `commander`, `@clack/prompts`, `tsup`, `vitest`, `biome`.
- **Tests:** Vitest unit per service + ≥1 integration test per slice exercising the full CLI invocation. New privacy-critical paths get an assertion test.
- **Commits:** ≥1 feature + 1 test commit per slice. **Branch:** `feat/v1-cv-<NN>-<slug>` (e.g. `feat/v1-cv-00-document-seam`).
- **No new external deps** without justification in the slice and approval at review. A markdown parser (e.g. `remark`/`mdast`) IS justified for CV-00 — pick one, pin it, note it.
- When a slice begins, write its detailed task-by-task plan as `docs/superpowers/plans/2026-06-01-mirador-v1-cv-<NN>-<slug>.md` and link it from the slice's issue.

### 0.5 — The existing code you are evolving (real paths, verified 2026-06-01)

```
v1/src/
  commands/   accept brain dashboard decline inbox init list new open request share upgrade
  services/   artifact brain brainImport brainProposals changeLog expiration inbox
              inviteResolver landingPage linkFile passwordGate promptSeed request role
              session share shareRegistry siteChrome siteIndex skill staticPreview
              upgrade vercel-project workspace
  adapters/   claudeCode editor externalEditor fs gh-cli git github vercel
  shared/     ansi config copy errors lastSeen log paths
v1/site-assets/themes/   page memo deck console atlas  (+ tokens.css reset.css)
v1/skill/SKILL.md        (the Claude Code skill — becomes the Claude shim)
```

### 0.6 — First move (do this, in order)

1. Read the design doc end to end. Then read SAD §2 (module rules) and `docs/design/spec.md` §Themes.
2. Skim, in the existing code: `services/staticPreview.ts`, `services/changeLog.ts`, `services/brain.ts`, `services/session.ts`, `services/promptSeed.ts`, `commands/open.ts`, `commands/init.ts`, `v1/skill/SKILL.md`. These are the modules that change most.
3. Start **CV-00** (the document seam). It unblocks everything. Open its branch, write its detailed sub-plan, then build.

---

## 1. Slice dependency graph

```
CV-00 (document seam / markdown++) ─┬─► CV-02 (refine + intent note) ─► CV-03 (handoff) ─┬─► CV-04 (vision+owner+state)
                                    │                                                    │
CV-01 (brain = agent memory) ───────┴────────────────────────────────► CV-03 ───────────┤
                                                                                          ├─► CV-05 (cockpit)*
                                                                                          ├─► CV-06 (agnostic shims)
                                                                                          │        │
                                                                                          │        ▼
                                                                                          │   CV-07 (agent-mediated onboarding + ladder)
                                                                                          ▼
                                                                                     CV-08 (migration from publish-era)  [gated on all]
```

\* CV-05 mirror-half needs only CV-00; its convergence-half needs CV-03.

- **CV-00 and CV-01 run in parallel** (independent foundations).
- **CV-03 is the keystone** (the killer demo) — gated on CV-00 + CV-01 + CV-02.
- **CV-08 is last** (full surface needed).

---

## CV-00 — The document seam (markdown++ core)

**Goal:** A format-agnostic `document` interface + a markdown++ implementation. `mirador new` produces a markdown++ source; the view renders via the existing themes; a structured section-level diff between two versions is clean and legible.

**Why first:** every other slice operates on this interface. It is the substrate shift (HTML → markdown++ source → rendered HTML).

**CLI surface:** `mirador new <slug>` (now scaffolds a markdown++ source), `mirador preview <slug>` (renders the view), `mirador diff <slug>` (structured diff). 

**Modules:**
- **New:** `services/document/index.ts` (the `parse/render/diff/merge` interface + registry), `services/document/markdown.ts` (impl #1: markdown++ parse/render/diff/merge with stable section anchors + fenced `chart`/`table`/`callout` blocks), `services/document/types.ts` (`DocModel`, `StructuredDiff`, `Conflict`).
- **Changes:** `services/staticPreview.ts` (stop wrapping arbitrary HTML; call `document.render(doc, theme)`), `services/artifact.ts` (artifact source = markdown++), `services/changeLog.ts` (delegate to `document.diff` for structured diffs), `commands/new.ts` (scaffold markdown++ + vision frontmatter placeholder).
- **Reuses:** `v1/site-assets/themes/*` as renderers.

**Acceptance criteria:**
- [ ] `document.parse` → `render` round-trips a markdown++ doc into themed HTML identical in look to today's themes (golden test per theme).
- [ ] Stable section anchors: editing §B never changes §A's anchor; diff of "edit §B" reports only §B.
- [ ] `merge(base, ours, theirs)` is clean when edits touch different sections; returns `Conflict[]` (not a throw) when they touch the same section.
- [ ] Fenced `chart`/`table`/`callout` parse to typed nodes and render under the `atlas`/`page` themes.
- [ ] Raw-HTML escape-hatch path still publishes (broadcast-only, no diff/merge).
- [ ] Unit tests for parse/render/diff/merge; integration test for `new → preview`.

**Deps:** none (foundational). **Suggested model:** Claude (interface design + diff/merge semantics are subtle).

---

## CV-01 — Brain = agent-native memory (brain seam)

**Goal:** Replace the wizard-scaffolded brain store with **brain-source adapters** that read the agent's living memory. `mirador init` no longer runs a brain wizard.

**CLI surface:** `mirador brain` (now: *show what Mirador reads as your brain* — diagnostic, not a store editor). `mirador init` (brain wizard removed).

**Modules:**
- **New:** `adapters/brainSource/index.ts` (resolver: detect agent → adapter), `adapters/brainSource/claudeCode.ts` (`~/.claude/.../memory/MEMORY.md` + topics + project `CLAUDE.md`), `adapters/brainSource/codex.ts` (`AGENTS.md`), `adapters/brainSource/gemini.ts` (`GEMINI.md`), `adapters/brainSource/generic.ts` (`AGENTS.md`/`CLAUDE.md` convention fallback).
- **Changes:** `services/brain.ts` (from "manage a store" → "resolve + read via adapter"), `commands/init.ts` (drop the 5–10-Q brain wizard; detect agent + confirm brain source instead), `commands/brain.ts` (becomes diagnostic).
- **Retire / repurpose:** `services/brainImport.ts`, `services/brainProposals.ts` (the "propose an update to the store" flow is obsolete — updates happen in the agent's own memory via the agent's own mechanism). Keep `services/brain.privacy.test.ts`'s intent: assert no path writes brain content into a shared repo or a handoff packet.

**Acceptance criteria:**
- [ ] On a machine with Claude Code memory, `mirador brain` shows the resolved brain source + a summary of what it would read. Nothing is written to a parallel store.
- [ ] Codex (`AGENTS.md`) and Gemini (`GEMINI.md`) adapters resolve correctly; unknown agent falls back to the generic convention.
- [ ] `mirador init` completes with **no brain wizard**; it detects the agent and confirms the brain source.
- [ ] Privacy assertion test: no code path copies brain content into a shared repo path or into a handoff packet on the agent path.
- [ ] Cold start (empty memory) degrades gracefully (generic baseline), does not error.

**Deps:** none (parallel with CV-00). **Suggested model:** Claude (privacy boundary + adapter design).

---

## CV-02 — Refine + intent note

**Goal:** The refine flow. A collaborator edits the artifact through their agent; on push, the writer's AI **auto-drafts an intent note** (tagged with the inferred move) that rides the commit; a structured diff is produced.

**CLI surface:** `mirador refine <slug>` (open the artifact for refinement in the agent + cockpit), `mirador push <slug> --intent <text>` (commit + attach intent note; `--intent` auto-filled by the agent, editable).

**Modules:**
- **New:** `services/refine.ts` (the refine session: open source, expose document interface to the agent), `services/intentNote.ts` (compose/store/read intent notes; storage = sidecar `.mirador/intents/<sha>.md` + a short commit trailer per design §18), `services/moves.ts` (the six internal move tags + inference contract used by the shim; **no user-facing surface**).
- **Changes:** `services/session.ts` (refine sessions), `adapters/git.ts` (commit with trailer; write intent sidecar), `v1/skill/SKILL.md` (the shim auto-drafts the intent note on push — invisible guidance).

**Acceptance criteria:**
- [ ] A refinement committed via `mirador push` writes `.mirador/intents/<sha>.md` and a one-line commit trailer; `git log` is legible.
- [ ] The intent note is **auto-drafted by the agent** (the shim instructs it), editable, never a blocking form.
- [ ] Each intent note carries an inferred move tag (internal); the tag is never shown to the user.
- [ ] `document.diff` produces the structured diff the next reader's handoff will consume.
- [ ] Unit tests for intentNote compose/parse round-trip; integration test for refine → push.

**Deps:** CV-00. **Suggested model:** Claude (the shim prose + move inference contract).

---

## CV-03 — Handoff packet + brain-shaped brief  ⭐ keystone / the killer demo

**Goal:** On open/pull, the CLI assembles a **handoff packet** (structured diff + intent notes since last-seen + brain-source pointer); the reader's agent frames it through the reader's brain into a one-screen brief ending in concrete next-refinements. **Two users with different brains get visibly different briefs.**

**CLI surface:** `mirador open <slug>` (now produces the handoff), `mirador handoff <slug> --since <ref>` (emit the raw packet — also the manual-mode output).

**Modules:**
- **New:** `services/handoff.ts` (assemble the packet: `document.diff` since `last-seen` + `intentNote` lookup + brain-source pointer; **no brain content in the packet on the agent path**).
- **Changes:** `services/session.ts` (surface the handoff on open), `commands/open.ts` (call handoff), `shared/lastSeen.ts` (track per-artifact last-seen ref), `v1/skill/SKILL.md` (the shim: read your own brain → frame the packet → one-screen brief, tabular, ends in 2–3 next-refinements, no AI-prose).

**Acceptance criteria:**
- [ ] `mirador handoff` emits a deterministic packet: structured diff + intent notes + brain pointer. No brain content embedded (agent path).
- [ ] Given the same packet, two different brains (two memory fixtures) produce **measurably different briefs** — validated by a fixture test on the shim contract + a manual two-machine confirmation.
- [ ] The brief is tabular / single-critical-item, cites intent notes, ends in concrete next-refinements (not a question). No AI-prose.
- [ ] Manual mode: `mirador handoff` output is usable by a human with no shim.
- [ ] Integration test for the open → handoff path; golden test on the shim's brief format.

**Deps:** CV-00, CV-01, CV-02. **Suggested model:** Claude Opus (the shim's brief-framing is the highest-leverage prose in the product).

---

## CV-04 — Convergence anchor: vision + owner + state

**Goal:** Vision statement in artifact frontmatter; owner arbitration of same-section conflicts; a computed **convergence state** (locked / contested / open). The handoff becomes a **vector** (toward/away from the vision), not just a delta.

**CLI surface:** `mirador vision <slug> [--set "<text>"]` (show/evolve the vision; owner-gated to set), `mirador status <slug>` (convergence state readout).

**Modules:**
- **New:** `services/vision.ts` (vision in frontmatter; auto-drafted by the creator's agent; evolution rules), `services/convergence.ts` (compute locked/contested/open from intent notes + move tags + lock markers).
- **Changes:** `services/role.ts` (owner = arbiter for same-section conflicts; reuse `effectiveRole`), `services/handoff.ts` (add the vision vector to the packet), `.mirador/manifest.json` schema (+ `vision`, `owner`; role inference, not declaration).

**Acceptance criteria:**
- [ ] New artifacts get an auto-drafted one-line vision in frontmatter; `mirador vision --set` is owner-gated.
- [ ] `mirador status` renders the locked/contested/open readout (design §11.3) from real intent/move/lock data.
- [ ] A same-section conflict (from CV-00's `merge`) routes to the owner with both intent notes attached.
- [ ] The handoff brief references direction relative to the vision (vector, not just delta).
- [ ] Unit tests for convergence-state computation; integration test for a conflict → owner-arbitration flow.

**Deps:** CV-02, CV-03. **Suggested model:** Claude.

---

## CV-05 — Live cockpit (mirror-first, then convergence)

**Goal:** `mirador watch <slug>` — a **local read-only mirror** that hot-reloads the rendered view as the agent edits the source, then surfaces incoming handoffs when convergence lands via git fetch.

**CLI surface:** `mirador watch <slug>` (start the cockpit), auto-started during `mirador refine`.

**Modules:**
- **New:** `services/cockpit.ts` (file-watch the source → `document.render` → push to browser; remote fetch loop → on new commits, re-render + surface the handoff), `adapters/localServer.ts` (tiny local HTTP + SSE; SSE per design §18 — one-way mirror, no editing channel).
- **Changes:** `services/refine.ts` (auto-start cockpit), `v1/site-assets/` (a minimal cockpit shell that renders the view + a slot for the surfaced brief).

**Acceptance criteria:**
- [ ] **Mirror half:** editing the source (by hand or agent) hot-reloads the browser view within ~1s. Read-only — no edit affordance in the page.
- [ ] **Convergence half:** a `git fetch` that brings a collaborator's refinement updates the mirror and surfaces the handoff brief in-view.
- [ ] Convergence arrives **async via git** — no realtime cross-user channel. The only live channel is local (source → mirror).
- [ ] Cockpit is local-only (binds localhost); nothing is published by `watch`.
- [ ] Integration test for the watch → edit → reload loop; test for fetch → surface.

**Deps:** CV-00 (mirror); CV-03 (convergence surfacing). **Suggested model:** Claude (server + UX), Codex acceptable for the adapter plumbing.

---

## CV-06 — Model-agnostic protocol: CLI-engine + per-agent shims

**Goal:** Confirm all deterministic work is CLI-side; ship thin shims for a second and third agent alongside the Claude skill; ensure manual mode is a clean floor. Collaboration intelligence lives **invisibly** in each shim — light, jargon-free.

**CLI surface:** no new verbs. `mirador shim install [--agent claude|codex|gemini]` (install/update the right shim), wired into `init`/`upgrade`.

**Modules:**
- **Changes:** `services/skill.ts` (generalize to install per-agent shims), `commands/init.ts` / `commands/upgrade.ts` (install the detected agent's shim).
- **New:** `v1/shims/claude/SKILL.md` (the existing `v1/skill/SKILL.md` evolved), `v1/shims/codex/AGENTS.md`, `v1/shims/gemini/GEMINI.md` — each the same invisible-intelligence contract (refine, auto-intent, handoff framing, move inference) in that agent's idiom.
- **Audit:** verify no business logic leaked into any shim (SAD §2.2) and no LLM call exists in `commands/`/`services/`/`adapters/`.

**Acceptance criteria:**
- [ ] The refine + handoff loop runs in Claude Code **and** in at least one other agent (Codex or Gemini) via its shim, against the same `mirador` CLI.
- [ ] Manual mode (no shim): `mirador handoff` + `mirador push --intent` give a human the full loop by copy-paste.
- [ ] Shims contain **no business logic** and **no user-facing role/move vocabulary** — guidance only.
- [ ] Shim contract test: each shim instructs the same packet→brief shape.

**Deps:** CV-03. **Suggested model:** Claude Opus (prose-engineering across agents).

---

## CV-07 — Agent-mediated onboarding + tiered ladder

**Goal:** The invitation seed **onboards-to-refine**. A recipient pastes it into their agent; the agent installs the CLI if missing, clones, reads their brain, briefs them, leaves them refining. The landing offers tiered CTAs (T0 read / T1 comment / T2 refine).

**CLI surface:** `mirador share <slug> --with <email>` (seed now carries the onboarding payload), `mirador accept` / `mirador comment` (T1 paste-back).

**Modules:**
- **Changes:** `services/promptSeed.ts` (invitation seed = onboard-to-refine: carries repo + install + first-refine guidance the agent executes), `services/landingPage.ts` (tiered CTA: T0/T1/T2), `v1/shims/*` (on an invitation paste: install-if-missing → clone → handoff → leave refining).
- **Reuses:** existing `share` / `accept` / `inbox` / `dashboard` machinery.

**Acceptance criteria:**
- [ ] Pasting an invitation seed into a supported agent results in: CLI present (installed if missing), repo cloned, a brain-shaped handoff, and an open refine session — **zero manual setup steps**.
- [ ] Landing page renders T0 (read URL) + T1 (comment, no CLI) + T2 (refine) per design §14.
- [ ] T1 comment produces a paste-back `@mirador-response`; appears in the owner's inbox.
- [ ] The growth loop closes: a newly-onboarded collaborator can themselves `share` onward.
- [ ] Integration test for the seed → onboarded-refine path (mocked installer).

**Deps:** CV-06. **Suggested model:** Claude (seed/shim prose + onboarding UX).

---

## CV-08 — Migration from the publish-era

**Goal:** A publish-era user runs `mirador upgrade` and keeps their published HTML docs (as broadcast-only artifacts) while new artifacts default to markdown++. No loss.

**CLI surface:** `mirador upgrade [--dry-run]` (extended).

**Modules:**
- **Changes:** `services/upgrade.ts` + `commands/upgrade.ts` (map published HTML → raw-HTML escape-hatch artifacts; install the agent shim; remove the legacy brain-store wizard remnants; preserve `shareRegistry`), `adapters/*` as needed.

**Acceptance criteria:**
- [ ] Existing published artifacts survive as broadcast HTML (viewable, not co-refinable); their URLs and `shareRegistry` entries are preserved.
- [ ] New artifacts created post-upgrade are markdown++ by default.
- [ ] The old brain store (if present) is read once for a one-time harvest hint, then the agent-memory brain takes over; no parallel store is maintained.
- [ ] `--dry-run` prints the plan without changes.
- [ ] Integration test: simulate a publish-era install, upgrade, verify both broadcast-HTML continuity and new markdown++ creation.

**Deps:** CV-00 … CV-07. **Suggested model:** Claude (migration is high-stakes UX).

---

## 2. Aggregate definition of done

All slices merged; this runs end-to-end across **two machines and two agents**:

1. `mirador init` on machine A (Daniel, Claude Code) — no brain wizard; brain resolved from his agent memory.
2. `mirador new q3-strategy` → markdown++ source + auto-drafted vision. `mirador watch` shows the live HTML view as his agent drafts it.
3. `mirador share q3-strategy --with maria@simetrik.com` → repo + onboarding seed on clipboard.
4. Machine B (María, Codex or Gemini): pastes the seed → her agent installs the CLI, clones, and briefs her **through her brain** — a brief visibly different from Daniel's. Zero manual setup.
5. María refines §3 from her lens; her agent auto-drafts the intent note; it merges by section.
6. Daniel pulls: his cockpit updates and surfaces a **vector** handoff (*"María's change moves us toward the vision; from your lens, §3 now needs X"*). He arbitrates, locks §1 and §4.
7. `mirador status q3-strategy` shows locked/contested/open correctly.
8. A publish-era machine runs `mirador upgrade` — old docs survive as broadcast HTML; new ones are markdown++.
9. Privacy assertion test green: no brain content ever entered git or a packet.

This is the launch demo (design §17).

## 3. Suggested execution order & parallelism

- **Wave 1 (parallel):** CV-00, CV-01.
- **Wave 2:** CV-02 (after CV-00).
- **Wave 3 (keystone):** CV-03 (after CV-00+CV-01+CV-02). *Demo the two-brain handoff here — it de-risks the whole product.*
- **Wave 4 (parallel):** CV-04, CV-05, CV-06 (all after CV-03; CV-05 mirror-half can start in Wave 1).
- **Wave 5:** CV-07 (after CV-06).
- **Wave 6:** CV-08 (after all).

Per Daniel's build stance: one big push, batch the slices, one e2e at the end (the §2 demo), file follow-up issues rather than draft-PR-per-slice — unless review says otherwise.

— end of build plan —
