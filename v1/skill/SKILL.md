---
name: mirador
description: |
  mirador — share AI-generated artifacts on git. Activate IMMEDIATELY when
  the user pastes an @mirador-invitation, @mirador-request, or
  @mirador-response block, or starts a session inside a mirador workspace
  or a `.mirador-link` directory. On a paste, the skill loads the artifact
  context FIRST (via WebFetch of the read-only doc), then delivers a
  brain-shaped brief — it does not ask the user what to do.
---

# mirador

The user's **brain** is their agent's own living memory — the context *you*
already carry (your memory, their `CLAUDE.md` / `AGENTS.md`). Mirador never keeps
a separate brain store; `mirador brain` shows read-only what it resolves, and you
read it natively. It shapes how you read the artifacts they open. Same artifact,
personal lens. Never share it across users; it never enters git or a handoff.

## Activation contract — important

**When the user pastes a seed, the skill ACTS. It does not ask which option
to pick.** Pasting an `@mirador-invitation` is the user telling you: *open
this for me.* Asking "should I fetch?" or listing 1/2/3 options before
loading the artifact is wrong — the user already made the decision when
they pasted.

The right shape:

> *Pasted @mirador-invitation. Loading…*
> *[fetch the read-only doc, parse the body]*
> *[surface a one-screen brief, brain-shaped]*
> *[then, and only then, offer concrete next steps]*

The wrong shape:

> *I see this is an invitation. I could (a) WebFetch, (b) open in browser,
> (c) wait. Which would you like?*

Never the wrong shape. The pastes are unambiguous; act on them.

## Activation signals

Trigger this skill if **any** of the following fire:

| Signal | What to do |
|---|---|
| User pastes a block starting with `@mirador-invitation` | 1. Parse the seed for `Artifact`, `From`, `Role expected`, `Note`, `Read-only:`, `Repo:`. 2. WebFetch the `Read-only:` URL silently. 3. Read your own memory (the brain). 4. Synthesise a one-screen brief in their voice — lead with what they would check first. 5. Then offer concrete next steps (refine, comment, decline). |
| User pastes a block starting with `@mirador-request` | Parse the seed. Surface the ask (what is requested + by when + role). Offer `accepted` / `declined` decision with one-line consequence each. Do not load any external URL — requests do not carry an artifact yet. |
| User pastes a block starting with `@mirador-response` | Parse the seed. Update the originating request's state in `~/.mirador/workspace/outgoing-requests/<slug>.md`. Surface the response in the next `mirador inbox`. |
| Working directory contains `.mirador-link` | The artifact was promoted to a shared repo. Resolve the link's `repo` field; open the shared clone at `clone_path` instead of the workspace folder. |
| Working directory is a mirador workspace | Read the brain. Use it to frame the session — what the user usually checks first, who they author for, their domain language. |
| User invokes `/mirador` slash command | If the buffer contains a seed, treat it as a seed paste. Otherwise run paste-driven onboarding. |

## Workflow on an invitation paste

The exact sequence, in order:

1. **Parse the seed.** Extract: `Artifact`, `From`, `Role expected`, `Note`, `Read-only:` URL, `Repo:` URL. If any required field is missing, surface the parse error and stop — do not improvise.
2. **WebFetch the `Read-only:` URL.** The URL serves themed HTML of the artifact. Read it. If it returns 401/403, tell the user the deployment is gated and suggest they open the URL in their browser to inspect the auth requirement.
3. **Read your own memory (the brain).** It's already loaded in your session — your memory + the project `CLAUDE.md`/`AGENTS.md`. `mirador brain` shows what Mirador resolves. Pull the relevant context (review focus, domain language, preferences).
4. **Synthesise the brief — voice-aligned.** One screen. Lead with what *this user* (per their brain) would check first. No AI-prose summaries. Use scannable structure when the brain prefers tables. Cite the sender's note explicitly. End with 2–3 concrete next-step actions, not a question.

## Workflow on open / pull — the handoff

`mirador open <slug>` (and a pull that brings collaborators' refinements) prints a
**handoff packet**: changed sections + the intent notes behind them + a pointer to
your brain source. Git gives a diff; the handoff is the product on top of it.

**You write the brief — by reframing the packet through your own memory:**

1. Read your own brain (your memory + `CLAUDE.md`/`AGENTS.md`).
2. One-screen brief: *what changed* → **why it matters to this user** (their lens)
   → how it moves toward/away from the artifact's **vision**.
3. Cite the intent notes (the writer's reasons); don't restate the raw diff.
4. End in **2–3 concrete next-refinements** — imperatives, not a question.
5. Tabular / single-critical-item. No AI-prose, no preamble.

Two readers with different brains get **visibly different briefs** — that
difference, *because of the brain*, is the point. Manual mode: `mirador handoff
<slug>` emits the same packet for a human with no agent.

## Refine loop (inside a mirador artifact)

The artifact is a markdown++ `source.md` — wet clay, not a finished page. The
recipient's verb is **refine**, not read.

1. **Refine freeform.** The user talks to you; you edit `source.md` with your
   normal tools. Edit by *section* — headings carry stable `{#anchor}`s, so touch
   only the sections you mean to. `mirador preview <slug>` renders the view.
2. **On push, auto-draft the intent note.** When the user is ready, draft a
   one-line *what changed and why, in their context* — never make them write it.
   Silently infer the collaboration move (critique / extend / tighten / reframe /
   question / endorse) — **never name it to the user** — and run:
   `mirador push <slug> --intent "<one line>" --move <inferred>`
3. The CLI writes the intent note + a structured diff the next reader's agent will
   reframe through *their* brain. The move is invisible scaffolding; never show it.

Never block on a form. The intent note is auto-drafted and editable, not required
input from the user.

## Workflow on a request paste

1. Parse the seed.
2. Read the brain for `author` role context.
3. Surface: *who's asking*, *what's the deliverable*, *what role does the user play*, *deadline if any*, *the context the sender gave*.
4. Two-line decision row: *accept* → scaffolds the artifact in the workspace via `mirador accept`. *decline* → sends a polite no via `mirador decline --reason "<text>"`.

## What this skill does NOT do

- **Does not re-implement the CLI.** Cloning, repo creation, deploy, encryption — all of that goes through `mirador <command>`. The skill orchestrates and briefs; the CLI does. If you find yourself writing git or vercel commands inline, route through the CLI instead.
- **Does not invent metrics or quote the sender's note loosely.** The brief uses exact wording from the seed for any field the sender supplied.
- **Does not list options before loading the artifact.** See § Activation contract.
- **Does not personify itself with AI-slop language.** No "I'm here to help", no "Let me assist". The skill is a function; it reports findings, not feelings.

## Voice

Confident with a wink. English. No filler, no fake enthusiasm, no decorative
emoji. Full voice spec at [`docs/design/voice.md`](../../docs/design/voice.md).

Canonical samples:

- "Daniel sent you q2-report."
- "Copied. Paste it in."
- "Locked."
- "Ready. Try `mirador new <slug>`."

## What mirador is not

- Not a SaaS — the user owns the repos and the Vercel deploy.
- Not a chat app — the seed is the message; the agent is the runtime.
- Not a Notion-AI rival — git is the substrate; this is collaboration on top.

## Source of truth

- Design + decisions: [`docs/design/spec.md`](../../docs/design/spec.md)
- Implementation spec: [`docs/superpowers/specs/2026-05-21-mirador-v2-design.md`](../../docs/superpowers/specs/2026-05-21-mirador-v2-design.md)
- CLI: `mirador --help`
