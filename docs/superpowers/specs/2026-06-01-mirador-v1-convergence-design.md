# Mirador V1 — Convergence Design

**Date:** 2026-06-01
**Status:** Canonical (product definition for the launchable V1)
**Author:** daniel.medina@simetrik.com
**Code name:** `mirador` (name preserved; metaphor unchanged — see §1.3)
**Working directory:** `/Users/equipo/Simetrik/html-viewer`
**Supersedes (in part):** [`2026-05-21-mirador-v2-design.md`](2026-05-21-mirador-v2-design.md) — the **product identity** evolves from *"HTML publisher + share"* to *"multi-context convergence medium."* The **architecture and hard principles of that PRD mostly hold and are reinforced** (git substrate, brain-private, no hosted frontend, prompt-seeds, CLI/agent split). See §15 for the precise holds-vs-supersedes ledger.
**Companion:** build plan at [`../plans/2026-06-01-mirador-v1-convergence-build-plan.md`](../plans/2026-06-01-mirador-v1-convergence-build-plan.md). Visual identity unchanged: [`docs/design/spec.md`](../../design/spec.md) still governs.

> This document is the output of a design grilling session (2026-05-29 → 06-01). Twelve decisions (Q1–Q12, §4) converge on one product. The motivating failure: the publish-era CLI "felt like an HTML generator with extra steps," and *"even when shared, there was no incentive to open it differently than any HTML — and you couldn't. It felt solo even when shared."* This design fixes that.

---

## 1. Vision

### 1.1 — One-line

**Mirador is the medium where N private contexts converge — each through their own AI — on one living artifact, guided toward an owned vision. The HTML is just one of its views.**

Mirador stops being a publisher of finished HTML. The artifact becomes wet clay that many lenses sculpt; the rendered HTML is an output, not the thing.

### 1.2 — The killer primitive

A team converges on a shared artifact. Each collaborator's agent session is shaped by *their own* private context (their agent's living memory). Each refines the artifact from their lens. Every refinement carries an **intent note** authored by the writer's AI; when the next person opens the artifact, *their* AI re-frames those changes through *their* context into a one-screen brief that ends in concrete next-refinements. An **owner** holds an explicit **vision** the artifact converges toward.

Nobody has this. Google-Docs-with-AI has multiplayer editing but no per-person lens and no vision-direction. Notion sees the shared workspace, not your private lens. Figma/Miro are shared-canvas, single-context. Mirador is **one artifact, many contexts, converging toward a vision** — the only tool where collaboration is *contextual*.

### 1.3 — Why the name still fits

A *mirador* is an elevated vantage point. What you see depends on where you stand and the eyes you bring. The artifact is the landscape; your context is your eyes; the vision is the horizon you're walking toward together. Same lookout, infinite views, one direction.

Tagline holds: **"Same artifact. Your lens."** Convergence sharpens it: *your lens, our vision.*

### 1.4 — Relationship to the publish-era V1

The publish-era V1 (`mirador-cli` 1.0.0 on npm — publishes HTML to your own Vercel) is **absorbed, not discarded.** Its themed-render + Vercel-publish pipeline becomes the **view layer** (the rendered HTML of a markdown++ document). Its collaboration skeleton (share / request / accept / inbox / seeds / landing / dashboard) **survives and is repurposed** for the refine era. What changes is the *artifact* (HTML → markdown++ source), the *brain* (wizard store → agent-native memory), and the *recipient verb* (read → refine). Existing users keep working; `mirador upgrade` carries them forward (§ build plan CV-08).

### 1.5 — Strategic positioning (unchanged)

- **Now:** git-native, open-source CLI + agent shim. No Mirador-owned servers. Zero hosting cost.
- **Later (separate spec):** managed Mirador cloud — the upsell, not the start. n8n / Plausible / Bitwarden model.
- **Model-agnostic, CLI-first** — per the Simetrik product vision (tools for agents / agentic no-code / managed services). Mirador is *the git-layer for AI-collaborative artifacts*, not a Notion-AI rival.

---

## 2. The motivating failure (why this redesign exists)

| Symptom (from internal use) | Root cause | Fix in this design |
|---|---|---|
| "Felt like an HTML generator with extra steps" | Single-player had no payoff; the artifact was an opaque broadcast | Refinable document + live local cockpit (§9, §12) |
| "When shared, no incentive to open it differently than any HTML" | The recipient's only verb was *read* | Refine verb + brain-shaped handoff that arrives with a reason to act (§9, §10) |
| "And you couldn't" (collaborate) | Raw HTML can't be co-refined cleanly; no merge, no legible diff | markdown++ source → HTML view; structured diff; section merge (§7) |
| "It felt solo even when shared" | No representation of shared context or shared direction | Multi-context brains (§8) + vision/owner anchor (§11) |

---

## 3. Hard principles

**Carried from the publish-era PRD (still binding):**

1. **Brain is strictly private.** Never visible, fetchable, or knowable by another user. In this design the brain is the user's *agent memory* — it never enters git, a packet, or any shared surface. Only its *effects* (refinements, intent notes) are shared.
2. **No hosted Mirador frontend.** The live cockpit (§12) is a **local, read-only mirror** — a window onto the agent session, not a second interface. You never click-edit it.
3. **Git is the sync substrate.** GitHub default. No CRDT, no websockets between users, no presence service. Convergence is async; "live" is local-per-session.
4. **GitHub identity = Mirador identity.** `gh auth status` is the source of truth.
5. **No AI-prose summaries in scan contexts.** Handoffs, inboxes, convergence state are tabular / single-critical-item.
6. **Anything that crosses into the artifact is a deliberate human disclosure.** No auto-commit of brain output.
7. **No LLM API calls from the CLI.** All cognition runs in the user's agent (Claude Code / Codex / Gemini / Cowork). The CLI is a deterministic engine.

**New principles (this design):**

8. **The artifact is a document, not a page.** A format-agnostic document model whose first implementation is markdown++. HTML is a render target, never the source of truth.
9. **The brain is your agent's living memory** — never a separate store, never a wizard. Mirador reads what your agent already maintains.
10. **The collaboration intelligence is invisible.** It lives in the agent shim — light, guiding, jargon-free. Users never learn roles or move-names. *Having Mirador makes you collaborate better without learning a system.* The UX is **AI + context + human, freeform.**
11. **Convergence needs an anchor.** Every artifact has an explicit (evolving) **vision** and an **owner** who holds it. Without this, multi-context refinement diverges into design-by-committee.
12. **Agnostic seams around a constant wedge.** The wedge (multi-context convergence) never changes. Two seams vary their implementations independently: the **format seam** (markdown++ → blocks → canvas) and the **brain seam** (Claude / Codex / Gemini / Cowork). The product ceiling is the wedge, not any format.

---

## 4. The twelve locked decisions (grill output)

| Q | Decision |
|---|---|
| Q1 | Miro/FigJam/Excalidraw is **directional, not literal**. No canvas. Git substrate stays. Wedge = brains converging on one artifact. |
| Q2 | The artifact must give the second brain a **verb** + arrive with an incentive **shaped by that person's context**. |
| Q3 | The verb is **refine** (edit through your own AI; lands via git). The unlock is the brain-shaped **handoff**. |
| Q4 | What gets refined is a **structured source → rendered HTML is the view** (not raw HTML). |
| Q5 | Source = **markdown++**, behind a **format-agnostic seam**. Ceiling = the wedge, not the format. |
| Q6 | Handoff = **hybrid two-brain relay**: writer's AI auto-drafts an **intent note** on push; reader's AI re-frames it through the reader's brain. New primitives: **structured diff** + **intent note**. |
| Q7 | Brain = **your agent's living memory** (agent-agnostic adapter seam). No wizard, no parallel store. |
| Q8 | Protocol = **CLI-engine (agnostic) + thin per-agent shim**. CLI = deterministic engine; agent = lens + hands. Manual mode = floor. |
| Q9 | Convergence anchor = **vision (evolving) + owner-arbiter**. Concurrency = async-parallel via git, merge by section, same-section ties → owner. Handoff becomes delta → **vector**. |
| Q10 | Live = **convergence-cockpit**: local **read-only mirror** (mirror, not interface). Async convergence surfaces the handoff in-view. Built mirror-first. |
| Q11 | Onboarding = **agent-mediated** (paste seed → your agent installs + clones + briefs you). Tiered ladder **T0 read / T1 comment / T2 refine**. **Convergence is distribution.** |
| Q12 | Collaboration intelligence is **invisible, in the skill** — light, guiding. UX is freeform (AI + context + human). Roles **inferred from brain**, never declared. Only **owner** stays visible (it's intuitive, not jargon). |

---

## 5. Glossary (convergence era)

| Term | Definition |
|---|---|
| **Artifact** | A unit under collaborative refinement. A **document** (the source) + a **vision** + an **owner** + collaborators. Lives in git. |
| **Source** | The document model that is refined and merged. V1 implementation: **markdown++**. The source of truth. |
| **View** | A render of the source — primarily themed HTML on the owner's Vercel. Output, never edited directly. |
| **markdown++** | Markdown + two surgical additions: (i) **stable section anchors** (clean section-level merge + legible diffs); (ii) a small set of **fenced rich blocks** (`chart`, `table`, `callout`) so data artifacts aren't anemic. No MDX/JSX (breaks merge). |
| **Format seam** | The `document` interface — `parse / render / diff / merge` — with pluggable implementations. markdown++ = impl #1; blocks/canvas are future impls. |
| **Brain** | The user's private lens = **their agent's living memory** (Claude Code memory + `CLAUDE.md`; or `AGENTS.md`; or `GEMINI.md`; …). Read via the **brain seam**. Never shared. |
| **Brain seam** | Per-agent adapters that locate + read the agent's native memory. Generic fallback to the `AGENTS.md`/`CLAUDE.md` convention. |
| **Refine** | The collaborative verb: a person edits the artifact through their own AI; the change lands in git. |
| **Intent note** | Auto-drafted by the writer's AI at push: *what I changed and why, in my context.* Rides with the commit. A commit message that is really an **inter-agent message**. |
| **Structured diff** | A section/block-level diff over the document model (not a text blob diff). Feeds the handoff. |
| **Handoff** | What the reader gets on open: CLI assembles a **packet** (structured diff + intent notes since last-seen); the reader's AI frames it through the reader's brain into a one-screen brief ending in concrete next-refinements. |
| **Vision** | One evolving statement of *what this artifact is converging toward.* In the artifact's frontmatter. Held by the owner; sharpened by lenses. |
| **Owner** | Whoever holds the vision and arbitrates same-section conflicts. Default = creator. The only visible "role." |
| **Convergence state** | Computed, glanceable readout: sections **locked** (endorsed) / **contested** (open challenges) / **open**. The *"how close to the vision?"* signal. |
| **Move** | A collaboration primitive (critique, extend, tighten, reframe, question, endorse). **Never user-facing.** The shim infers it, handles it, tags the intent note. Invisible scaffolding. |
| **Cockpit** | `mirador watch` — a local read-only preview that hot-reloads as your AI edits the source, and surfaces incoming handoffs when convergence lands. |
| **Seed** | A paste-able `@mirador-*` block. In the refine era the invitation seed **onboards-to-refine**, not just opens-to-read. |
| **Ladder** | Tiered participation: **T0** read (URL, zero setup) / **T1** comment (paste-back, no CLI) / **T2** refine (CLI + agent, via agent-mediated onboarding). |

---

## 6. The core model

```
                          THE WEDGE (never changes)
                  multi-context convergence on one artifact
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
   FORMAT SEAM                 ENGINE / LENS / SKILL          BRAIN SEAM
   what the artifact IS        split of responsibility        where context LIVES
   ───────────────            ─────────────────────          ────────────────
   markdown++  (impl #1)       CLI    = agnostic engine       Claude Code memory
   blocks      (future)        agent  = lens + hands          Codex  (AGENTS.md)
   canvas      (future)        skill  = invisible guide       Gemini (GEMINI.md)
                                                              Cowork / generic
```

**The loop, end to end:**

1. Owner creates an artifact: a **vision** + a markdown++ **source**. The **cockpit** shows the live HTML view while their AI sculpts the source.
2. Owner invites the lenses they need (a **seed**). Inviting them **onboards** them (agent-mediated).
3. A collaborator's AI **briefs** them through their brain, then they **refine** — freeform; the shim guides invisibly.
4. Each refinement carries an auto-drafted **intent note** and merges by section in git.
5. Anyone opens/pulls → the CLI assembles a **handoff packet** → their AI frames it through their brain → a one-screen brief ending in concrete next-refinements; the cockpit updates.
6. The owner holds the **vision**, arbitrates conflicts, **locks** converged sections. The **convergence state** shows distance to the vision.
7. Every invitation grows the network. **Convergence is distribution.**

---

## 7. The document model (format seam)

### 7.1 — The `document` interface

```
parse(source: string)            -> DocModel        // markdown++ → AST with stable anchors
render(doc: DocModel, theme)     -> string (HTML)   // AST → themed HTML view
diff(base: DocModel, head)       -> StructuredDiff   // section/block-level, semantic-ish
merge(base, ours, theirs)        -> DocModel | Conflict[]  // section-granular; conflict => owner
```

All convergence machinery (refine, handoff, cockpit, convergence state) operates on this interface — **never on markdown directly.** That is the seam that keeps the ceiling open: blocks and canvas are future `DocModel` implementations; the wedge code does not change.

### 7.2 — markdown++ (impl #1)

- **Stable section anchors.** Every heading carries a durable id (`## Risks {#risks}` or auto-derived + persisted). Sections are the merge/diff/lock unit. Two people editing different sections → clean git merge. Same section → conflict → owner arbitrates (Q9).
- **Fenced rich blocks.** A small typed set parsed into nodes and rendered by the theme:
  - ` ```chart ` (spec → rendered chart, atlas theme)
  - ` ```table ` (data → sortable/sticky table)
  - ` ```callout ` (note/warn/quote)
- **No MDX/JSX.** Plain markdown merges; JSX does not. Rich content lives in fenced blocks, not embedded components.

### 7.3 — The view layer (absorbed from publish-era)

`render()` reuses the existing themed pipeline: the 5 themes in `v1/site-assets/themes/` (`page`, `memo`, `deck`, `console`, `atlas`) become the document renderers. Vercel publish (`/d/<slug>/`) carries forward as the read-only view. The visual identity in `docs/design/spec.md` is unchanged.

### 7.4 — The escape hatch (raw HTML, demoted)

Bespoke HTML that doesn't fit a document model is supported as a **broadcast-only tier**: published and viewable, but *not* co-refinable (no clean merge possible). This is what the publish-era did, demoted to a fallback. New artifacts default to markdown++.

---

## 8. The brain (brain seam)

### 8.1 — Brain = your agent's living memory

There is **no separate brain store and no init wizard.** Mirador reads the context your agent already maintains:

| Agent | Native source |
|---|---|
| Claude Code | auto-memory (`MEMORY.md` + topic files) + project `CLAUDE.md` |
| Codex | `AGENTS.md` (+ Codex memory) |
| Gemini | `GEMINI.md` (+ Gemini memory) |
| Cowork / other | dedicated adapter |
| Unknown / manual | fallback to the `AGENTS.md` / `CLAUDE.md` convention |

The brain seam locates and (when needed) reads this. **We do not need to know each agent's internals up front** — a new agent is a new adapter; the convention is the floor.

### 8.2 — Who reads the brain (privacy)

- **Agent path (common):** the reader's agent **reads its own memory directly** — the brain never enters the handoff packet. Maximum privacy by construction.
- **Manual mode (floor):** the CLI reads the brain locally via the adapter to frame the packet on-device. Still local; nothing leaves.

### 8.3 — Cold start

Empty memory → generic handoffs that improve as the user's agent memory grows (a virtuous loop, aligned with living in your agent). Power users (a team already on Claude Code) are rich from day one. The harvest fallback reads `CLAUDE.md`/`AGENTS.md` + role-from-invite for a baseline.

---

## 9. The refine loop + intent note

1. A collaborator opens the artifact (gets a handoff, §10) and **refines freeform** — they just talk to their agent. The shim (§13) guides invisibly and infers the move.
2. On push, the **writer's AI auto-drafts an intent note** — *what changed and why, in my context* — tagged with the inferred move. **Auto-drafted, not a form** (ceremony killed the publish era). The user can edit it; they don't have to write it.
3. The change merges by section into git. The intent note rides with the commit (sidecar in the artifact repo, e.g. `.mirador/intents/<sha>.md`).
4. The structured diff + the intent note are what the next reader's handoff consumes.

The intent note is the **writer-brain → reader-brain** symmetry: one encodes intent, the other decodes for relevance. That symmetry *is* multi-context convergence, operationalized.

---

## 10. The handoff (two-brain relay)

The crown jewel. **Git gives a diff; it does not give the handoff.** The handoff is the product.

**On open / pull, the CLI (deterministic) assembles a packet:**
- the **structured diff** since the reader's last-seen (reusing `last-seen` + the document `diff()`);
- the **intent notes** for those changes (with inferred moves);
- a pointer indicating the reader's brain source.

**The reader's agent (cognition) frames it through the reader's brain into a one-screen brief:**
- what changed → **why it matters to you** (your lens) → **how it moves us toward/away from the vision** (Q9 made it a vector, not just a delta);
- ends in **2–3 concrete next-refinements**, not a question;
- tabular / single-critical-item; no AI-prose (Principle 5).

Two users with different brains open the same changed artifact and get **visibly different briefs** — the difference is *due to the brain.* (This is the launch demo, §17.)

---

## 11. Convergence anchor: vision + owner + state

### 11.1 — Vision (the north star)

The artifact carries one **vision statement** in its frontmatter — *what this is converging toward.* Auto-drafted by the creator's AI; one line; **evolving** (lenses can sharpen it, owner holds it). It turns "edit by committee" into "convergence toward a known point," and it gives the handoff its direction.

### 11.2 — Owner (the arbiter)

Default = creator (the existing `effectiveRole()` already yields owner=author). The owner holds the vision and **arbitrates same-section conflicts** (Q9). The only visible role; everything else is inferred.

### 11.3 — Convergence state (the readout)

Computed from intent notes + inferred moves, glanceable:

```
q3-strategy   ·   vision: "board-ready Q3 narrative anchored on NRR"   ·   owner: you

  LOCKED     §1 Summary · §4 Risks            (endorsed)
  CONTESTED  §3 Retention claim               (2 open challenges — yours + María's)
  OPEN       §2 Timeline · §5 Appendix

  → refine §3   ·   resolve §3   ·   view
```

This is the *"how close to the vision?"* signal the cockpit shows and the owner steers by. Moves are the mechanism; the state is what makes convergence **visible and measurable** — the thing Google-Docs-with-AI lacks.

### 11.4 — Moves are invisible (Q12)

The six moves (critique / extend / tighten / reframe / question / endorse) are **system-internal only.** The user never sees or selects them. The shim infers the move from natural conversation, handles it (routes a reframe to the owner, tags the intent note, updates state). *Having Mirador* produces good collaboration without anyone learning a vocabulary. Roles are inferred from the brain (your memory already knows you're an eng manager). **UX = AI + context + human, freeform.**

---

## 12. The live cockpit

`mirador watch` (and auto-on during a session) opens a **local, read-only mirror** of the rendered view:

- **Mirror, not interface.** You watch; you don't click-edit. You edit by talking to your agent; the mirror reflects. This is why it does **not** violate "no hosted frontend" — the browser is a window onto the session, not a second surface. (It is literally what was asked for: *see it*, not *manipulate it*.)
- **Mirror-first.** Build the solo loop first: file-watch the source → `render()` → hot-reload the browser. You watch the HTML morph as your AI sculpts the markdown.
- **Then the convergence layer.** A remote fetch loop (async, not realtime cursors): when a collaborator's refinement lands via `git fetch`, the mirror updates and the **handoff brief surfaces in-view**. One window for the solo loop and the multi loop.
- Convergence still arrives **async via git** — zero realtime-multiplayer. The mirror is local; what syncs is git.

---

## 13. Model-agnostic protocol (engine / lens / skill)

- **CLI = the agnostic engine.** All deterministic work: `parse/render/diff/merge`, intent-note gathering, brain-source resolution, **handoff-packet assembly**, convergence-state computation, git/Vercel orchestration. Agent-neutral by nature. (Reinforces the SAD: no LLM calls from the CLI.)
- **Agent = lens + hands.** Reads its own brain, frames the packet, narrates, executes the refine.
- **Skill/shim = invisible intelligence.** A thin per-agent text contract carrying the *light, jargon-free* collaboration guidance (§11.4). Ships for Claude Code (`SKILL.md`), Codex (`AGENTS.md`-style), Gemini (`GEMINI.md`-style); the same `mirador` CLI underneath.
- **Manual mode = floor.** No shim for an agent → the CLI emits a copy-pasteable handoff packet and accepts pasted refinements. Nobody is locked out.

---

## 14. Distribution: convergence is distribution

- **Agent-mediated onboarding.** A recipient pastes the seed into *their* agent; the agent **onboards them** — installs the CLI if missing (`npm i -g mirador-cli`), clones, reads their brain, briefs them, leaves them refining. The only human act is *paste.*
- **Tiered ladder** (nobody excluded, everyone on their rung): **T0** read the rendered URL (zero setup) · **T1** comment via a paste-back response seed (no CLI) · **T2** refine (full, via agent-mediated onboarding).
- **The growth loop.** To converge on your vision you invite the lenses you need; inviting them onboards them; they then invite *their* lenses. **The artifact's need for more context is the viral engine** — it grows by doing its job, not by separate marketing.

---

## 15. Holds vs. supersedes (continuity ledger)

**Holds unchanged** (from `2026-05-21-*` + `docs/design/spec.md`):

- Git as sync substrate; no CRDT/realtime between users (Q1).
- Brain strictly private (Q7 strengthens it: it never even enters a packet on the agent path).
- No hosted Mirador frontend (Q10: the cockpit is a local read-only mirror).
- Prompt-seeds as the distribution primitive (Q11 repurposes them: onboard-to-refine).
- GitHub identity; Vercel for the user's own publishing.
- CLI architecture `commands → services → adapters → shared`, one-way deps (SAD §2.1).
- No LLM API calls from the CLI (SAD §10; Q8 reinforces).
- Computed-not-stored (inbox, change lists); extends to convergence state (SAD §3.2).
- Visual identity: cobalt, Plex, the aperture mark, the 5 themes, the voice (`docs/design/spec.md`) — **fully intact**; themes become document renderers.

**Superseded / evolved:**

| Was (publish-era) | Now (convergence) |
|---|---|
| Artifact = arbitrary HTML, published | Artifact = markdown++ document; HTML is a render (§7) |
| Recipient verb = read (static preview) | Recipient verb = **refine**; read is T0 of a ladder (§9, §14) |
| Brain = separate store, seeded by a 5–10-Q init wizard | Brain = **agent's living memory**, no wizard, agent-agnostic (§8) |
| Roles declared on the artifact (`role-reviewer.md` etc.) | Roles **inferred from the brain**; only owner is visible (§11.4) |
| Skill = Claude-Code-specific behavior | **CLI-engine + thin per-agent shims**; manual floor (§13) |
| "Generate then look" (deliberate) | **Live local cockpit** mirror + async convergence (§12) |
| Collaboration = comment via issues / read-only preview | Collaboration = refine + **two-brain handoff** + **vision/owner anchor** (§10, §11) |
| No notion of shared direction | **Vision statement + convergence state** (§11) |

---

## 16. Out of scope for V1

- **Literal canvas / spatial multiplayer** (Miro/FigJam/Excalidraw as a product). Directional only (Q1). A canvas `DocModel` is a future format-seam impl, not V1.
- **CRDT realtime co-editing**, presence cursors, live multi-typing. Convergence is git-async (Q1/Q10).
- **Hosted Mirador cloud** (brain/repo/landing hosting under our domain, web auth). Separate spec; the upsell.
- **Block-document source** (Notion-like typed blocks). The format seam allows it; it's a v1.x impl, after the markdown++ loop is proven.
- **Web-based refine.** Refining requires an agent + CLI. T0/T1 cover the agentless; refine is T2.
- **Mobile.** Static view only via `/d/<slug>/`.
- **Team brain / shared context object.** Each brain is personal; a team brain is a separate future concept.

---

## 17. Success criteria (the launch demo)

V1-convergence ships when this runs end-to-end across two machines and two agents:

1. **The two-brain demo.** Two collaborators with different brains open the same changed artifact; each gets a **visibly different handoff brief**, and the difference is demonstrably *due to the brain*, not noise.
2. **The refine loop.** A collaborator refines through their agent; the intent note is auto-drafted; the change merges by section; the owner pulls and sees a vector brief (*"moves toward the vision; from your lens, do X"*).
3. **The cockpit.** The owner watches the rendered HTML morph live as their agent edits the source; a pulled refinement updates the mirror and surfaces the brief in-view.
4. **Convergence is visible.** The convergence-state readout shows locked/contested/open correctly; a same-section conflict routes to the owner.
5. **Agent-mediated onboarding.** A fresh collaborator pastes a seed into their agent and reaches *refining* with zero manual setup.
6. **Model-agnostic.** The same loop runs in Claude Code and in at least one other agent (Codex or Gemini) via its shim; manual mode produces a usable packet.
7. **Continuity.** A publish-era user runs `mirador upgrade`, keeps their published docs as broadcast HTML, and can create new markdown++ artifacts. Nothing is lost.
8. **Privacy.** No brain content ever enters git, a packet, or a shared surface without explicit human disclosure. (Privacy assertion test stays green.)

---

## 18. Open questions (resolve during slice planning, not blockers)

- **Section anchor strategy** — author-explicit (`{#id}`) vs auto-derived+persisted vs hybrid. Recommend hybrid: auto-derive, persist on first save, allow explicit override.
- **Intent-note storage** — sidecar files (`.mirador/intents/<sha>.md`) vs structured commit trailers vs both. Recommend sidecar (richer, agent-readable) + a short commit trailer for `git log` legibility.
- **Convergence-state persistence** — fully computed each call (SAD-consistent) vs cached. Start computed; cache only if slow.
- **Cockpit transport** — SSE vs websocket for hot-reload. SSE is simpler and sufficient (one-way mirror).
- **Move inference fidelity** — purely shim-inferred vs CLI-assisted heuristics. Start shim-only; add CLI heuristics if the convergence state is noisy.
- **Codex/Gemini shim parity** — how close to Claude-first? Ship Claude full, one other agent at functional parity, the rest via manual + generic adapter for launch.

— end of design —
