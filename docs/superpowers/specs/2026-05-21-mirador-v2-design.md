# Mirador v2 — Design Spec

**Date:** 2026-05-21
**Status:** Superseded in part (2026-06-01) by [`2026-06-01-mirador-v1-convergence-design.md`](2026-06-01-mirador-v1-convergence-design.md) — the **product identity** evolved from *"HTML publisher + share"* to *"multi-context convergence medium."* The **architecture & hard principles below still hold** (git substrate, brain-private, no hosted frontend, prompt-seeds, CLI/agent split). Read this PRD for the durable architecture; read the convergence design for the current product shape.
**Author:** daniel.medina@simetrik.com
**Code name:** `mirador` (name preserved, metaphor reinterpreted — see §1.3)
**Working directory:** `/Users/equipo/Simetrik/html-viewer`
**Supersedes:** [`2026-05-12-mirador-design.md`](2026-05-12-mirador-design.md) (v1 — hosted multiplayer web app, never built; v2 takes a different direction)

---

## 1. Vision

### 1.1 — One-line

**Mirador is the layer where shared AI-generated artifacts meet each collaborator's personal brain.**

Same artifact. Different lens per person. No hosted frontend. CLI + Claude Code skill on top of git.

### 1.2 — The killer primitive

Two collaborators open the same artifact through Mirador. Each one's Claude Code session is shaped by *their own* private brain — their role, context, priorities. The shared state lives in git; the personal lens lives locally. **The interface is the conversation that emerges from that intersection.**

Nobody has built this. Notion can't (their AI sees the shared workspace, not your lens). Figma can't (no AI brain). GitHub Copilot can't (no shared artifact unit). Linear, Reflect, Mem — none have the artifact-as-substrate + brain-as-lens combination.

### 1.3 — Why the name still fits

A *mirador* is an elevated vantage point. What you see from a mirador depends on where you stand, the weather, the time of day, and the eyes you brought. The artifact is the landscape; your brain is your eyes. Same lookout, infinite views.

Tagline: **"Same artifact. Your lens."**

### 1.4 — Relationship to the alpha

The current public alpha (`mirador-cli` on npm — publishes HTML to your own Vercel) is **absorbed, not replaced.** Its publish-to-Vercel mechanism becomes the static-preview + invitation-landing subsystem of v2 (§7.3). Existing alpha users keep working; `mirador upgrade` opts them into v2 capabilities.

### 1.5 — Strategic positioning

- **Now:** git-native, open-source CLI + skill. No Mirador-owned servers. Zero hosting cost to operate.
- **Later (separate spec):** managed Mirador cloud — hosts the brain, the shared artifacts, and the invitation landings for users who don't want a GitHub repo for everything. n8n / Plausible / Bitwarden model. The hosted tier is the upsell, not the starting point.

Mirador v2 is not a Notion-AI competitor. It is a *substrate*: the git-layer for AI-collaborative artifacts.

---

## 2. Principles (hard rules)

1. **Brain is strictly private.** A user's brain is never visible, fetchable, or knowable by any other user. The artifact (git repo) is the only shared surface. Any cross-user shared context is a separate "team brain" object — not the personal brain.
2. **No hosted Mirador frontend.** The product is the CLI + skill + (optional) static preview hosted on the *user's own* Vercel. Mirador-the-company hosts nothing in v2.
3. **Git is the sync substrate.** GitHub is the default backplane; Gitea or any git host works. No realtime CRDT, no websockets, no presence service.
4. **GitHub identity = Mirador identity.** No separate registration. `gh auth status` is the source of truth for who you are.
5. **Share-link is a prompt-seed, not a URL.** Distribution is via paste-into-Claude-Code, not URL navigation. The prompt bar is the new URL bar.
6. **No AI-prose summaries for scan contexts.** Inboxes, change lists, status reports are tables or single-critical-item. Reserve narrative mode for deep-engagement (and even there, prefer structured tables + one-line brain flags over monologue).
7. **Lazy / agentic loading.** Brain is not preloaded into the context window. The skill bootstraps a tiny pointer; the agent calls into the brain on demand. Avoid the "dumb zone" (>120k tokens).
8. **Anything that crosses into the artifact is a deliberate human disclosure.** Brain output never auto-commits. The user reviews and approves every change.

---

## 3. Glossary

| Term | Definition |
|---|---|
| **Workspace** | One private GitHub repo per user (`<handle>-mirador`). Holds the user's brain, drafts, unshared artifacts, incoming/outgoing request stubs, last-seen markers. Lifecycle: created once at `mirador init`. |
| **Artifact** | A folder of files under collaboration. Lives as a sub-folder of the workspace when unshared; promoted to its own GitHub repo at share time. Format-agnostic (HTML, Markdown, full Next.js app, dataset). |
| **Brain** | The user's personal lens. A folder of markdown files with frontmatter under `<workspace>/brain/`. Same format as Claude Code auto-memory. Strictly private. |
| **Shared repo** | A standalone GitHub repo created by `mirador share`. Has its own collaborators, issues, history. Linked back into the sender's workspace via `.mirador-link`. |
| **Prompt-seed** | A copy-pasteable block of text (`@mirador-invitation`, `@mirador-request`, `@mirador-response`) that recipients paste into Claude Code to bootstrap a Mirador session. |
| **Landing page** | A static HTML page on the *sender's* Vercel project (e.g. `mirador-danielm.vercel.app/i/<slug>/`) that shows the prompt-seed in a clickable form. Optional but on by default. |
| **Static preview** | A read-only HTML render of the artifact, on the sender's Vercel project at `/d/<slug>/`. Carries forward from the alpha. |
| **Role** | A label the artifact declares about the recipient's expected stance (`author`, `reviewer`, `stakeholder`, …). The brain may have role-specific sections that activate accordingly. |
| **Inbox** | A computed view (not a store) of items needing the user's attention across all artifacts. Computed at every `mirador` invocation from workspace state + shared-repo fetches + GitHub Notifications API. |

---

## 4. Identity & Auth

- **Identity is GitHub.** Username and email are read from `gh auth status`.
- **No Mirador account, no Mirador login, no Mirador user store.**
- **Vercel auth** (separate) is used only for the user's own preview/landing publishing. Re-uses the alpha's existing flow.
- **Collaborators are GitHub collaborators on the shared repo.** Invitations resolve emails → handles via the GitHub API.
- **Recipients who lack Mirador or GitHub** still see the static preview (read-only). The landing page explains how to install Mirador (`npm i -g mirador-cli && mirador init`) to get the full experience.

---

## 5. Data Model

### 5.1 — Workspace repo (one per user, private)

```
<handle>-mirador/
├── mirador.json              # config: vercel domain, brain location, defaults
├── brain/                    # private lens
│   ├── MEMORY.md             # index of brain files (max ~200 lines)
│   ├── role-author.md        # brain section for "author" role
│   ├── role-reviewer.md      # brain section for "reviewer" role
│   ├── preferences.md        # cross-role preferences
│   └── *.md                  # additional brain files
├── artifacts/                # all unshared / draft artifacts live here
│   ├── q2-draft/             # an unshared artifact (just a folder)
│   │   ├── index.html
│   │   └── ...
│   └── q3-promoted/
│       └── .mirador-link     # this artifact was promoted — see §5.2
├── incoming-requests/        # request stubs from others (created on accept)
│   └── q3-forecast.md
├── outgoing-requests/        # request stubs to others
│   └── data-audit.md
├── last-seen.json            # per-artifact "when did I last look at this"
└── logs/                     # deploy/share/accept logs
    └── activity.log
```

### 5.2 — `.mirador-link` (pointer file)

When an artifact is promoted to a shared repo, its workspace folder is replaced by:

```yaml
# .mirador-link
kind: mirador-link
artifact: q3-promoted
repo: https://github.com/danielm-mirador/q3-promoted
shared_at: 2026-05-21T14:30:00Z
shared_with:
  - alice@simetrik.com
role_for_collaborators: reviewer
clone_path: ~/.mirador/shared/q3-promoted/
```

`mirador open q3-promoted` reads this file, ensures the shared repo is cloned (or updated) at `clone_path`, and runs the session there.

### 5.3 — Shared artifact repo (one per shared artifact)

```
q3-promoted/                  # name = artifact slug
├── CONTEXT.md                # the "why this exists" — pre-filled if from a request
├── README.md                 # auto-generated artifact overview
├── <artifact content>        # whatever the artifact actually is
└── .mirador/                 # Mirador-managed metadata
    ├── manifest.json         # artifact type, expected role, ownership
    └── changelog.json        # rich change history (commit + brain notes if author opts in)
```

Issues on this repo = comments / requests for changes / clarifications. Issue labels:
- `request-for-change` — explicit ask
- `clarification` — non-blocking question
- `brain-flag` — surfaced by a collaborator's brain, posted explicitly

### 5.4 — Brain format (extends Claude Code auto-memory)

Each brain file:

```markdown
---
name: role-reviewer
description: How I approach things when reviewing someone else's artifact
metadata:
  type: brain
  applies_to_role: reviewer    # only activates when artifact declares role=reviewer
---

I review for scope creep, missing timelines, and failure modes.
I don't comment on tone or style unless asked.
I ask for evidence on quantitative claims.
```

`brain/MEMORY.md` is the index:

```markdown
- [role-reviewer](role-reviewer.md) — How I approach reviewing
- [role-author](role-author.md) — How I write
- [preferences](preferences.md) — Cross-role: avoid jargon, prefer tables over prose
- [domain-finance](domain-finance.md) — Finance-specific context
```

Loading model:
- At `mirador open <artifact>`, the skill reads the artifact's manifest, identifies the role, and loads only the relevant brain sections.
- All brain files are accessible on-demand via a `mirador brain --topic <x>` tool the agent can call.

---

## 6. Prompt-Seed Protocol

The protocol is plain text, human-readable, machine-parseable. Three message types.

### 6.1 — `@mirador-invitation` (share an existing artifact)

```
@mirador-invitation

From: Daniel Medina <daniel.medina@simetrik.com>
Artifact: q2-draft
Repo: https://github.com/danielm-mirador/q2-draft
Role expected: reviewer
Note: "Necesito tu lente de scope antes del Friday."
Sent: 2026-05-21T14:30:00Z

To open: paste into Claude Code with the Mirador skill installed.
Read-only preview: https://mirador-danielm.vercel.app/d/q2-draft/
Landing: https://mirador-danielm.vercel.app/i/q2-draft/

— Sent via Mirador
```

### 6.2 — `@mirador-request` (ask for an artifact that doesn't exist yet)

```
@mirador-request

From: María Gómez <maria@simetrik.com>
To: daniel.medina@simetrik.com
Asking for: q3-forecast
By: 2026-05-29
Role expected: author
Context:
  Need a Q3 forecast that includes BBVA migration risk and the
  Operation Center launch timeline. Audience is the board.
  Length: 1-pager with a chart.
Sent: 2026-05-21T14:30:00Z

Expires: 2026-06-12  (14 days after `by:`)

To accept or decline: paste into Claude Code.
Landing: https://mirador-mariag.vercel.app/r/q3-forecast/

— Sent via Mirador
```

### 6.3 — `@mirador-response` (accept / decline / status update)

```
@mirador-response

From: Daniel Medina <daniel.medina@simetrik.com>
To: maria@simetrik.com
Re-request: q3-forecast
Status: accepted | declined | completed | reassigned
Note: "Started. Will share by Thursday."
Sent: 2026-05-21T15:00:00Z

— Sent via Mirador
```

### 6.4 — Parsing & dispatch

- Skill SKILL.md instructs Claude: "if the user pastes a block starting with `@mirador-*`, invoke `mirador open --from-seed <text>` (or `--from-request`, `--from-response`)."
- The CLI parses deterministically (header lines = key: value, `Note:` body is multi-line until blank line).
- LLM does the *trigger*; CLI does the *parse*.

---

## 7. Core Flows

### 7.1 — `mirador init`

First-time setup. Runs once per machine per user.

1. Check `node >= 20`, `git`, `gh`, `vercel` CLIs. Install instructions on miss.
2. `gh auth status` → confirm GitHub identity. If not authed: `gh auth login`.
3. `vercel whoami` → confirm Vercel identity. If not: `vercel login`.
4. Prompt: workspace repo name (default `<handle>-mirador`), privacy (default private), location (default GitHub user namespace; option: dedicated org `mirador-<handle>` to keep personal profile clean).
5. Create workspace repo, clone locally to `~/.mirador/workspace/`.
6. Scaffold `brain/`, `artifacts/`, `incoming-requests/`, `outgoing-requests/`, `mirador.json`.
7. Walk the user through brain seeding (5–10 questions: name, role, domain, defaults for what they care about). Generate `brain/role-author.md`, `brain/role-reviewer.md`, `brain/preferences.md`. User can edit/skip.
8. Install Claude Code skill (`~/.claude/skills/mirador/`) and slash command (`/mirador`).
9. Optional: also install for Codex (`~/.codex/skills/mirador/`).
10. Create the user's Vercel project for static-preview + landing hosting (or reuse if exists from alpha).
11. Print: "Mirador ready. `mirador new <slug>` to create your first artifact."

### 7.2 — `mirador new <slug>`

Creates a new artifact in the workspace.

1. `mkdir <workspace>/artifacts/<slug>/`
2. Generate `CONTEXT.md` from a 2-question prompt (purpose, audience).
3. Open Claude Code in that folder with the Mirador skill active.
4. Lives entirely local until shared. No GitHub repo created.

### 7.3 — `mirador share <slug> --with <email> [--note "..."] [--role reviewer]`

Promotes a workspace artifact to a shared repo.

1. Resolve `<email>` → GitHub handle via API. If ambiguous, ask user.
2. `git subtree split` (or fresh init, default fresh — `--keep-history` flag opts into history).
3. Create new GitHub repo (`<slug>` under user namespace or configured org). Private by default.
4. Add invitee as collaborator with write access.
5. Generate static preview HTML using **the alpha's existing themed-render pipeline** (theme, password gate, etc.).
6. Generate landing page HTML (`/i/<slug>/`) showing prompt-seed + two buttons ("Open in Claude Code" / "Just view").
7. Deploy both `/d/<slug>/` and `/i/<slug>/` to the user's Vercel project.
8. Compose `@mirador-invitation` prompt-seed.
9. Replace workspace folder with `.mirador-link` pointer (§5.2).
10. Copy landing URL to clipboard. Print: `Share copied: https://mirador-danielm.vercel.app/i/<slug>/`.

### 7.4 — `mirador open <slug>` (the killer demo)

This is where the brain meets the artifact.

1. Resolve `<slug>`: workspace folder, `.mirador-link`, or fresh URL (cloned to `~/.mirador/shared/<slug>/`).
2. Read artifact manifest → role expected.
3. Run `git fetch && git pull --ff-only` if it's a shared artifact.
4. Compute "what changed since last-seen" (diff vs. `last-seen.json` entry).
5. Load relevant brain sections (the role + any preferences). Bootstrap a session-scoped skill that says: "here is the artifact path, here is the user's role, here is a tool `mirador-brain` for on-demand brain queries."
6. Open Claude Code at that folder.
7. The skill instructs the agent's first turn to produce **exactly** the tabular brief from §11.1 — no prose monologue.
8. Update `last-seen.json` with the current commit SHA + timestamp.

### 7.5 — `mirador request "<title>" --to <email> [--by <date>] [--context "..."]`

Symmetric to share, but for an artifact that doesn't exist.

1. Compose `@mirador-request` prompt-seed.
2. Create a `outgoing-requests/<slug>.md` stub in the requester's workspace.
3. Generate landing page at `/r/<slug>/` on requester's Vercel.
4. Copy landing URL to clipboard.

No repo is created. Nothing exists on the recipient's side until they accept.

### 7.6 — `mirador accept --from-request` (paste-driven)

When the recipient pastes a `@mirador-request` seed:

1. Skill parses → CLI runs `mirador accept --from-request <parsed>`.
2. Brain advises (one-line summary): *"María asks for q3-forecast by Friday. Your brain says you usually accept finance asks but push back on board-audience ones without data attached. Accept, decline, or counter-propose?"*
3. On accept: create `artifacts/<slug>/` in recipient's workspace, pre-filled `CONTEXT.md` with the request's note. Mark `auto_invite: [maria@simetrik.com]` in the artifact's `.mirador/manifest.json`.
4. Send `@mirador-response` (status: accepted) back via the same channel (copy to clipboard for recipient to paste back to María).
5. Update María's landing (her next push to her Vercel) to show "Daniel accepted, started 2026-05-21."

### 7.7 — `mirador decline --from-request --reason "..."`

1. Send `@mirador-response` (status: declined, with reason).
2. Update the requester's landing to show declined state.
3. No artifact created.

### 7.8 — `mirador inbox` (or just `mirador` with no args)

Computed at each invocation from:
- `outgoing-requests/` + `incoming-requests/` directories (status, expiration)
- Each `.mirador-link` → `git fetch` → diff vs. `last-seen.json` for activity
- GitHub Notifications API (mentions, issues, PR comments on Mirador repos)
- Brain flags (computed on-the-fly when an item matches a brain pattern)

Output: §11.2.

---

## 8. CLI Surface

| Command | Purpose |
|---|---|
| `mirador init` | First-run setup. Creates workspace repo, brain, configures auth. |
| `mirador new <slug>` | Create a new artifact in workspace. |
| `mirador open <slug>` | Open an artifact in Claude Code with brain applied. |
| `mirador share <slug> --with <email>` | Promote workspace artifact to shared repo + invite. |
| `mirador unshare <slug>` | Bring a shared artifact back to workspace. Archives the shared repo. |
| `mirador request "<title>" --to <email>` | Ask for an artifact that doesn't exist. |
| `mirador accept --from-request [text]` | Accept a request. |
| `mirador decline --from-request [text] --reason "..."` | Decline a request. |
| `mirador respond --status completed --re <slug> --to <email>` | Send a status update. |
| `mirador list` | List all artifacts in workspace + shared. |
| `mirador inbox` | Show pending items. (Also default for `mirador` no-args.) |
| `mirador brain [--topic <x>]` | Inspect / edit brain. Used by the agent on-demand. |
| `mirador diff <slug>` | Show changes since last open. |
| `mirador upgrade` | Migrate alpha config to v2 workspace. |
| `mirador config` | View / edit `mirador.json`. |

---

## 9. Skill Behavior

`~/.claude/skills/mirador/SKILL.md` instructs Claude Code:

1. **Trigger on prompt-seeds:** if the user's message starts with `@mirador-invitation`, `@mirador-request`, or `@mirador-response`, immediately call the appropriate `mirador` CLI parser. Do NOT interpret the seed's content yourself — let the CLI parse.
2. **Trigger on artifact open:** when Claude Code is started inside a workspace folder or a shared-artifact clone, look for `.mirador/` metadata. If present, surface the tabular session brief (§11.1) as the first turn.
3. **Brain access is on-demand only.** Do not preload brain content. Call `mirador brain --topic <x>` when you need a specific bit. Update brain only after the user explicitly accepts a suggestion (pattern from `superpowers:remember`).
4. **Never auto-commit.** Suggest changes; user reviews and decides.
5. **Stay tabular.** When listing items (inbox, changes, requests), produce tables, not prose summaries.

---

## 10. Relationship to the Alpha (absorption)

The current `mirador-cli` alpha is the **static-preview + landing-page subsystem** of v2.

| Alpha capability | Role in v2 |
|---|---|
| `mirador init` | Extended (now also creates workspace repo + brain) |
| `mirador share <file.html>` (publish single HTML to Vercel) | Becomes the internal mechanism `_publishStatic()` used by `mirador share` (the v2 verb) and by landing-page generation |
| Themes (default, memo, deck, none, custom) | Apply to `/d/<slug>/` (static preview) and `/i/<slug>/` (landing) |
| Password gate | Available for `/d/<slug>/` when sender wants the read-only preview gated |
| `mirador config` | Extends to manage workspace + brain settings |

**Migration:** `mirador upgrade` is idempotent. It:
1. Checks if `~/.mirador/` (alpha home) exists.
2. Creates the v2 workspace repo and clones to `~/.mirador/workspace/`.
3. Moves `~/.mirador/site/d/*` into `workspace/artifacts/` as unshared artifacts (with `.mirador/legacy.json` marker).
4. Bootstraps an empty brain; offers the brain-seeding prompt.
5. Leaves alpha config in place so the user can fall back if they want.

No existing alpha user is forced to upgrade. Alpha continues to work standalone.

---

## 11. UX Specifications

### 11.1 — `mirador open` first turn (session brief)

The agent's first message MUST follow this structure (no narrative monologue):

```
q2-draft  ·  shared with Daniel, Alice  ·  last opened by you 2d ago

CHANGES SINCE YOU                 BY      WHEN
─────────────────────────────────────────────────
Added: BBVA Q3 risk bullet (p4)   Alice   yesterday
Moved: scope bullet up (p2)       Alice   yesterday
Edited: forecast number ($2.1M)   Alice   2h ago

⚑ Brain flag: BBVA bullet has no date — your usual instinct is to push back.

Next: mirador read p4  |  mirador diff  |  mirador comment p4
```

Rules:
- Header line: slug · collaborators · last-seen.
- Table: max ~5 rows. If more, show top 5 + "+N more (mirador diff)".
- Brain flag: zero, one, or two lines max. Each on a single line. Skip the section entirely if no flag is relevant.
- Next: 3–4 suggested commands, separated by `|`.

### 11.2 — `mirador inbox` output

Two modes, chosen automatically:

**Mode A — Single critical (one item dominates by brain priority gap >30%):**

```
⚠  María waits on your Q3 forecast — due Friday (in 2 days).
   → mirador accept q3-forecast

+ 7 more pending. `mirador inbox --all` to see them.
```

**Mode B — Tabular (default for multi-item):**

```
WHAT                              WHO     WHERE         WHEN
─────────────────────────────────────────────────────────────
Request: Q3 forecast              María   incoming      due Fri
Scope bullet edited               Alice   q2-draft      2h ago
"needs clarification on p4"       Bob     postmortem    yesterday
Request declined: data audit      Carlos  outgoing      3d ago
```

Brain ranks rows; never adds prose between them.

### 11.3 — Landing page (`/i/<slug>/`)

A static HTML page with:
- Header: artifact name, sender avatar, role expected, sender's note.
- Thumbnail of the artifact (first page rendered small).
- **Primary CTA (large, bold)**: "Open in Claude Code" → button copies prompt-seed to clipboard + shows the install snippet if not installed.
- **Secondary CTA (small)**: "Just view it (read-only)" → links to `/d/<slug>/`.
- Footer: "What is Mirador? → mirador.dev".

---

## 12. Brain — deeper spec

### 12.1 — Format

Same as Claude Code auto-memory. Each file: frontmatter (`name`, `description`, `metadata.type=brain`, optional `metadata.applies_to_role`) + markdown body. `brain/MEMORY.md` is the one-line-per-file index.

### 12.2 — Bootstrap (during `mirador init`)

5–10 questions, multi-choice with "Other" escape. Examples:
- Your primary role at work? (PM / Engineer / Designer / Exec / Founder / Other)
- When you review someone's work, what do you check first? (scope / correctness / timeline / clarity / Other)
- When you author something, what's your default audience size? (1–3 people / small team / company / public)
- What do you typically NOT want feedback on? (tone / formatting / scope / completeness / nothing)
- What domain language do you work in? (free text — e.g. "fintech, LatAm, B2B")

Generates the initial `role-author.md`, `role-reviewer.md`, `preferences.md`. User edits at will.

### 12.3 — Curation lifecycle

After any Mirador session where the agent made a non-trivial brain-flagged suggestion that the user accepted, the agent proposes:

> *"You accepted my flag on missing timelines. Want me to add `flag-missing-timelines: true` to your reviewer brain? (yes / no / edit)"*

User approves explicitly. Brain updates committed to workspace repo. (Inspired by `superpowers:remember`.)

### 12.4 — Role override

Artifact manifest declares `role_for_collaborators: reviewer`. When a collaborator opens it, their brain loads `role-reviewer.md` on top of `preferences.md`. The artifact author's own brain may have a different role for themselves (`role_for_owner: author`).

If a brain has no section for the declared role, only `preferences.md` loads. The skill warns once: "no reviewer brain found — `mirador brain init --role reviewer` to seed one."

---

## 13. Privacy & Boundaries

| What | Who can see it |
|---|---|
| Brain files (`<workspace>/brain/*`) | Only the brain's owner, locally. Workspace repo is private. |
| Workspace repo | Only the owner. |
| Shared artifact repo | Owner + invited collaborators (per GitHub permissions). |
| Static preview (`/d/<slug>/`) | Anyone with the URL (unlisted by default; password gate optional). |
| Landing (`/i/<slug>/`) | Anyone with the URL. |
| Prompt-seeds | Whoever the sender shows them to. |
| Brain flags surfaced as a comment on a shared artifact | All collaborators of that artifact (the act of commenting is a deliberate disclosure). |
| `last-seen.json` | Only the owner (lives in their workspace). |

Hard rule: **no Mirador command ever pushes brain content to a shared surface.** Any output from the brain that lands in a shared artifact does so because the human deliberately said yes.

---

## 14. Out of Scope for v2 (notable explicit exclusions)

- **CRDT realtime co-editing** (presence cursors, live multi-typing). Git-async is the model. May appear in the hosted tier later.
- **Hosted Mirador cloud** (brain hosting, repo hosting under our domain, web auth). Separate spec, separate product phase.
- **Mobile / browser-only access.** Mirador requires a terminal + Claude Code + git. Mobile is a static-preview-only experience via `/d/<slug>/`.
- **Team brain / shared context layer.** Each brain is personal. A future "team brain" is its own concept, not bolted onto the personal one.
- **AI-edit endpoint as a hosted service** (the v1 spec had this — calling Anthropic API from a server). In v2, every AI action runs in the user's local Claude Code. Mirador never makes API calls to LLM providers itself.
- **Comments on the static preview.** The preview is read-only. Interaction requires installing Mirador.
- **Non-GitHub git hosts in v2.0.** Architectural support exists (the code abstracts git operations), but GitLab/Gitea/Bitbucket adapters are deferred to v2.1.

---

## 15. Implementation Outline (vertical slices for multi-agent execution)

Each slice is independently shippable, demos a piece of the killer experience, and can be assigned to one agent + reviewer.

1. **VS-01: `mirador init` v2-extended.** Workspace repo creation, brain scaffolding, install flow. Demo: a user runs init and ends up with a workspace + brain on GitHub.
2. **VS-02: `mirador new` + `mirador open` (workspace-local).** Create artifact, open with brain-aware skill, see the tabular session brief on a folder with one commit. Demo: solo magic — the brain shapes the first turn.
3. **VS-03: `mirador share` (artifact → shared repo).** Snapshot promotion, invite, link-file replacement. Demo: solo → shared transition works; sender's workspace gets the pointer.
4. **VS-04: Static preview + landing page generation.** Reuse alpha pipeline; add `/i/<slug>/` landing template. Demo: a share command produces a working URL on the sender's Vercel.
5. **VS-05: Prompt-seed protocol + skill trigger.** Skill recognizes `@mirador-invitation`, calls CLI parser, opens shared artifact. Demo: paste-into-Claude works end-to-end.
6. **VS-06: `mirador request` + `accept` + `decline`.** Full request flow including expiration. Demo: María asks Daniel; Daniel accepts; artifact is created with pre-filled context.
7. **VS-07: `mirador inbox` (computed view).** Pulls from workspace + shared + GitHub Notifications + brain flags. Mode A / Mode B rendering. Demo: a user with multiple pending items sees the right table.
8. **VS-08: Brain lifecycle (init seed, on-demand access, agent-proposed updates, user-approved commits).** Demo: a brain update is suggested mid-session and committed to the brain repo only on yes.
9. **VS-09: Role override.** Artifact declares role; collaborator's brain activates the right section. Demo: two users open the same artifact with different brain roles, get visibly different first turns.
10. **VS-10: `mirador upgrade` (alpha → v2 migration).** Demo: an alpha user runs upgrade, their existing published docs become workspace artifacts.

Each VS has its own SAD + issues + dev plan, generated downstream of this PRD.

---

## 16. Success Criteria

v2 is shippable when:

1. Two collaborators with different brains open the same shared artifact and the first turn is visibly different — the difference is *due to the brain*, not noise. This is the demo.
2. A complete request → accept → share → open loop runs end-to-end across two machines using only the prompt-seed mechanism (no out-of-band communication needed beyond Slack-pasting the seed).
3. `mirador inbox` ranks correctly: a critical incoming request always appears above non-critical artifact changes, regardless of recency.
4. No brain content ever leaks into a shared repo, comment, or landing page without an explicit human approve step.
5. An existing alpha user can run `mirador upgrade` and lose nothing.
6. The full session — open, brain-flag, accept brain update, commit, share — runs comfortably within a single Claude Code conversation without context-window exhaustion (target: <60k tokens for a 30-minute session).

---

## 17. Open Questions (resolve during planning, not blockers for this spec)

- **Dedicated GitHub org vs. personal namespace** as default for shared-artifact repos. Spec recommends asking at `init`; default to dedicated org for cleanliness. Confirm during VS-01.
- **`mirador brain --topic <x>` ranking** — semantic search over brain files vs. simple substring vs. tag-based. Start with substring + frontmatter `applies_to_role`; semantic search is VS-08.5.
- **Conflict resolution semantics** when two collaborators commit to the same shared repo concurrently. Default = git merge with author-as-tiebreaker; revisit if observed pain.
- **Brain repo size limits.** Self-imposed soft cap at ~200 files; alert if exceeded.
- **Hosted-tier teaser.** What does the README hint at without overpromising? Resolve before public announcement.

---

## 18. Pinned Decisions (locked during this brainstorm, 2026-05-21)

- Sync model = git-native; hosted tier (B-tier) is a future, separate spec.
- Value primitive = protocol-over-git + private brain-per-user.
- Brain is strictly private. Format = Claude Code auto-memory style.
- Artifact unit = double-layer (workspace folders, shared repos only on share).
- Share = snapshot-clean default, history-preserved opt-in.
- Sharing post-state = link file (not submodule, not mirror sync).
- Identity = GitHub identity. No Mirador user store.
- Interface = Claude Code session orchestrated by the Mirador skill. No hosted Mirador frontend.
- Share-link = `@mirador-invitation` prompt-seed + landing page on the sender's own Vercel.
- Recipient experience = primary "Open in Claude Code", secondary "Just view it (read-only)". Sender does not choose; the landing gently steers.
- Skill trigger + CLI parse, both required (capas).
- Request flow = symmetric to share via `@mirador-request` prompt-seed.
- Requests expire 14 days after `by:` (or 30 days if undated).
- First-screen format = tabular brief + one-line brain flag + suggested next commands. No prose monologue.
- Inbox = computed view, no store. Mode A (single critical) or Mode B (tabular). No AI-prose summaries.
- External notifs: CLI primary, email digest opt-in, daemons rejected, integrations deferred to B-tier.
- Name preserved: "Mirador". Metaphor reinterpreted (the vantage point where artifact meets your lens). Tagline: *"Same artifact. Your lens."*
- Alpha is absorbed as v2's static-preview + landing subsystem, not deprecated.
- Target = full v2 spec (no MLV cut). Vertical slices feed multi-agent execution.

— end of spec —
