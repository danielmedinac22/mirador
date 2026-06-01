# mirador — Codex agent shim

You collaborate on **mirador** artifacts: markdown++ documents many people refine,
each through their own AI, converging toward one owned vision. The HTML is just a
view. Everything deterministic runs through the `mirador` CLI — you are the lens
and the hands. Never reimplement git/render/diff/merge; call `mirador <command>`.

## Brain — your own memory

Your brain is your own living memory + this project's `AGENTS.md`. There is no
separate store. `mirador brain` shows, read-only, what it resolves. Use it to
frame artifacts in this user's terms. Never copy brain content into a shared
artifact or comment without explicit OK; it never enters git or a handoff.

## On an invitation paste — onboard to refine

An `@mirador-invitation` block onboards the recipient to refine, zero setup:
1. install if missing: `npm i -g mirador-cli`;
2. `git clone <Repo>` and work inside it;
3. `mirador open <Artifact>` → reframe the handoff through your brain (below) →
   leave them in `mirador refine <Artifact>`.

Lighter rungs: T0 read (open the `Read-only:` link), T1 comment (compose an
`@mirador-response` to paste back — no CLI). Once onboarded, the user can
`mirador share <slug> --with <email>` onward — convergence is distribution.

## On open / pull — the handoff

`mirador open <slug>` (and a pull bringing collaborators' refinements) prints a
**handoff packet**: changed sections + the intent notes behind them + a pointer
to your brain. You write the brief by reframing it through your own memory:

1. *What changed* → **why it matters to this user** (their lens) → how it moves
   **toward / away from the vision** (a vector, not just a delta).
2. Cite the intent notes; don't restate the raw diff.
3. End in **2–3 concrete next-refinements** — imperatives, not a question.
4. Tabular / single-critical-item. No prose, no preamble.

Two readers with different brains get visibly different briefs — that's the point.
Manual floor: `mirador handoff <slug>` emits the same packet for a human.

## Refine + push

`source.md` is refinable — wet clay, not a finished page. Edit by section
(headings carry stable `{#anchor}`s; touch only what you mean to). `mirador
preview <slug>` renders the view; `mirador watch <slug>` is the live mirror.

On push, **auto-draft** a one-line intent (*what changed & why, in their context*)
— never make the user write it — silently infer the move (critique / extend /
tighten / reframe / question / endorse; **never name it**), and run:

```
mirador push <slug> --intent "<one line>" --move <inferred>
```

The owner holds the **vision** (`mirador vision <slug>`); `mirador status <slug>`
shows what's locked / contested / open. Same-section conflicts route to the owner.

## Boundaries

- No business logic here — orchestrate, the CLI does the work.
- No user-facing roles or move-names. The collaboration intelligence is invisible:
  having mirador makes the user collaborate better without learning a system.
- Never block on a form; the intent note is auto-drafted and editable.
