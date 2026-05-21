# Mirador v1 — Solutions Architecture Doc (SAD)

**Date:** 2026-05-21
**Status:** Draft (pending review)
**Author:** daniel.medina@simetrik.com
**Companion to:** [`2026-05-21-mirador-v2-design.md`](2026-05-21-mirador-v2-design.md) (PRD)
**Working directory:** `/Users/equipo/Simetrik/html-viewer`

The PRD describes *what* Mirador v1 is. This SAD describes *how it's built*: module boundaries, data flow, integrations, security, and the decisions behind them.

---

## 1. Architecture statement

Mirador v1 is **a single Node CLI binary** that orchestrates:

- **The user's local file system** (workspace clone, brain files, configuration).
- **Three external systems**: GitHub (via `gh` CLI + REST API), Vercel (via `vercel` CLI), and Claude Code (via skill discovery in `~/.claude/skills/`).
- **A protocol-over-text** (`@mirador-*` prompt-seeds) that travels through any channel humans use (Slack, email, paste).

There is no Mirador-owned server, no Mirador database, no Mirador API. State is materialized either in git (durable, shared, signed by GitHub) or in flat files under `~/.mirador/` (local, ephemeral, single-user).

The CLI is the **only first-party process**. Everything else is convention over an existing substrate.

---

## 2. Component-connector view

```
┌──────────────────────────────────────────────────────────────────────┐
│                          User's machine                              │
│                                                                      │
│  ┌──────────────────┐         ┌────────────────────────────────┐    │
│  │  Claude Code     │ ◄─────► │  Mirador skill                 │    │
│  │  (any model)     │ trigger │  (~/.claude/skills/mirador/)   │    │
│  └──────────────────┘         └──────────────┬─────────────────┘    │
│                                              │ exec                  │
│                                              ▼                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  mirador (CLI binary)                                          │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────┐ │ │
│  │  │ commands/  │  │ services/  │  │ adapters/  │  │ shared/ │ │ │
│  │  │ (verbs)    │──│ (logic)    │──│ (external) │──│ (utils) │ │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └─────────┘ │ │
│  └────────────┬─────────────┬──────────────┬────────────────────┘ │
│               │             │              │                       │
│  ┌────────────▼──┐ ┌────────▼──────┐ ┌────▼───────┐               │
│  │ ~/.mirador/   │ │ workspace     │ │ shared     │               │
│  │ config, logs, │ │ repo (cloned) │ │ artifact   │               │
│  │ last-seen,    │ │  ├─ brain/    │ │ clones     │               │
│  │ session       │ │  ├─ artifacts/│ │ (cloned)   │               │
│  │ skills cache  │ │  └─ requests/ │ │            │               │
│  └───────────────┘ └───────────────┘ └────────────┘               │
└──────────────────────────────────────┬──────────────────────────────┘
                                       │
                ┌──────────────────────┼────────────────────────┐
                ▼                      ▼                        ▼
        ┌──────────────┐       ┌─────────────┐         ┌─────────────┐
        │  GitHub      │       │  Vercel     │         │  Anthropic/ │
        │  (REST + git)│       │  (CLI deploy│         │  Codex/etc. │
        │              │       │  to user's  │         │  (only via  │
        │              │       │  project)   │         │  Claude     │
        │              │       │             │         │  Code; CLI  │
        │              │       │             │         │  never calls│
        │              │       │             │         │  LLM APIs)  │
        └──────────────┘       └─────────────┘         └─────────────┘
```

### 2.1 — Internal layers

| Layer | Responsibility | Depends on |
|---|---|---|
| `commands/` | Top-level CLI verbs (init, new, open, share, request, accept, decline, inbox, brain, diff, list, upgrade, config). Each verb is a thin orchestrator. | `services/`, `shared/` |
| `services/` | Domain logic. Pure-ish (input → output) functions over the data model. Examples: `workspace.ts`, `brain.ts`, `share.ts`, `request.ts`, `inbox.ts`, `promptSeed.ts`. | `adapters/`, `shared/` |
| `adapters/` | All external system access. One file per external concern: `github.ts`, `vercel.ts`, `git.ts`, `gh-cli.ts`, `clipboard.ts`, `editor.ts`, `claudeCode.ts`. | `shared/` only |
| `shared/` | Cross-cutting: types, errors, path resolution, logging, config parsing. | nothing |

**Rule**: dependencies point only downward. `commands/` never imports from another `commands/` file. `adapters/` never imports from `services/` or `commands/`. This is what makes vertical slices independently buildable.

### 2.2 — Skill layer (separate concern)

The Mirador skill (`v1/skill/SKILL.md` → installed to `~/.claude/skills/mirador/`) is *not part of the CLI runtime*. It is a text file that Claude Code reads to know:

- When to trigger (paste of `@mirador-*`, presence of `.mirador/` in cwd).
- Which CLI subcommand to invoke as a result.
- What conventions to follow for the first-turn brief format.

The skill never contains business logic. It is a stable contract between Claude Code's behavior and the CLI's surface. Updating the skill is one of the CLI's responsibilities (`mirador init`, `mirador upgrade`).

---

## 3. Data layer

### 3.1 — Where each piece of state lives

| State | Location | Owner | Mutability | Privacy |
|---|---|---|---|---|
| Brain content | `<workspace>/brain/*.md` (in workspace repo on GitHub, private) | User | Frequent (curation) | **Private** — never leaves user's clone or shared via Mirador |
| Workspace artifacts (unshared) | `<workspace>/artifacts/<slug>/*` | User | Frequent | Private |
| Workspace → shared link | `<workspace>/artifacts/<slug>/.mirador-link` (one file) | User | Rare | Private |
| Shared artifact content | Dedicated shared repo, GitHub | All collaborators | Frequent | Per repo permissions |
| Artifact manifest | `<shared-repo>/.mirador/manifest.json` | Author | Rare (on init / role changes) | Same as repo |
| Outgoing request stub | `<workspace>/outgoing-requests/<slug>.md` | Requester | On request lifecycle | Private |
| Incoming request stub | `<workspace>/incoming-requests/<slug>.md` | Recipient | On accept/decline | Private |
| Static preview HTML | User's Vercel: `/d/<slug>/index.html` | Sender | On every share/update | Unlisted URL |
| Landing page HTML | User's Vercel: `/i/<slug>/index.html` | Sender | On every share | Unlisted URL |
| Request landing | User's Vercel: `/r/<slug>/index.html` | Requester | On request status change | Unlisted URL |
| `last-seen` per artifact | `~/.mirador/last-seen.json` | User (local only) | Every `mirador open` | Local |
| CLI config | `~/.mirador/config.json` | User | Rare | Local |
| Session skill (ephemeral) | `~/.mirador/session-skills/<id>/SKILL.md` | CLI (created on open, GC'd on next open) | Per-session | Local |
| Activity logs | `<workspace>/logs/activity.log` | CLI | Append-only | Private |

### 3.2 — Computed (no canonical store)

- **The inbox** — recomputed at every `mirador inbox` call from workspace + shared clones + GitHub Notifications + brain flags. There is no `inbox.db`.
- **The change list for a session brief** — recomputed at every `mirador open` from `last-seen.json` + `git log`.
- **Brain flag matches** — recomputed by scanning brain files against artifact content/diffs at session start.

This intentional choice ("computed over stored") is what keeps the system stateless from Mirador's POV. Git is the canonical store; everything else is a view.

### 3.3 — Why git over a database

| Concern | Git answer |
|---|---|
| Durability | GitHub durability |
| Versioning | Native (commits) |
| Access control | GitHub collaborators / org permissions |
| Sync | `fetch` + `pull` + `push` |
| Audit | `git log`, `git blame` |
| Conflict resolution | Standard merge / rebase |
| Backup | `git clone` |
| Offline | Native |

A database (SQLite local + Postgres cloud, as in the v1 hosted spec) would solve the same problems but introduce: schema migrations, sync protocol, server hosting, auth, backup story. **Git already solves all of this for our use case.** The cost is that some operations are slower than a tuned DB (e.g., listing all artifacts requires a directory scan). For Mirador's scale (single-user workspace, low-tens of shared artifacts per user), this is irrelevant.

---

## 4. Deployment view

### 4.1 — What gets installed where

| Artifact | Where | Installed by |
|---|---|---|
| `mirador` binary | `~/.local/bin/mirador` (or wherever `npm i -g` puts it) | `npm i -g mirador-cli` |
| Mirador skill | `~/.claude/skills/mirador/SKILL.md` | `mirador init` (CLI writes file) |
| Slash command | `~/.claude/commands/mirador.md` | `mirador init` |
| Workspace repo | `~/.mirador/workspace/` (clone) + `github.com/<owner>/<handle>-mirador` | `mirador init` |
| Shared artifact repos | `~/.mirador/shared/<slug>/` (clone) + `github.com/<owner>/<slug>` | `mirador share` / `mirador open` |
| Vercel project | `mirador-<handle>.vercel.app` | `mirador init` (reuses alpha logic) |
| Local config | `~/.mirador/config.json` | `mirador init` |

### 4.2 — What runs where

- The CLI runs **only on the user's machine**.
- No long-lived process. Every `mirador <verb>` is a fresh invocation, completes, exits.
- No daemon, no background sync, no file watcher. (Rejected in PRD §11.3 / §9.3.)

### 4.3 — Distribution

- npm package: `mirador-cli` (currently alpha; will accept v1 once feature-complete).
- Optional install script: `curl -fsSL https://mirador.dev/install.sh | sh`.
- Skill ships inside the CLI (not as a separate npm package). `mirador init` writes the skill files; `mirador upgrade` rewrites them.

---

## 5. Security architecture

### 5.1 — Trust model

- **The local machine is trusted.** Brain files, config, workspace clones live in plaintext under `~/.mirador/` / `~/<handle>-mirador/`. Standard OS-level filesystem permissions are the only protection.
- **GitHub is trusted as the auth and sync substrate.** Mirador never stores GitHub tokens itself — `gh` CLI owns that.
- **Vercel is trusted for static hosting only.** No secrets ever published; everything in `/d/<slug>/` and `/i/<slug>/` is intended for unlisted public URL access.
- **Recipients of prompt-seeds are not trusted by the system** — they are trusted by the sender's act of sending. The seed itself contains no secrets.
- **The artifact's HTML is not trusted at view time** (alpha's existing iframe + CSP sandbox carries over; see PRD §10).

### 5.2 — What never crosses a boundary

| Boundary | What stays in |
|---|---|
| Brain repo → any other repo | Brain content. Pushed only to the user's brain repo (or workspace repo if brain is a subfolder). Never copied into a shared artifact repo as a side effect. |
| Brain content → shared comments | Unless the user explicitly composes a comment that quotes their brain, brain content never appears in shared issues / PR comments. |
| Local config → any remote | API tokens (`gh`, `vercel`) live in their respective CLIs' keychains, not in `~/.mirador/config.json`. |
| Prompt-seed → secrets | The seed format has no provision for tokens or passwords. If a user tries to pass `--with-password` to `share`, the password gates the static preview but is never in the seed. |

### 5.3 — Threats explicitly considered

| Threat | Mitigation |
|---|---|
| Malicious HTML in a shared artifact | iframe sandbox + CSP at view time (alpha pipeline). The artifact is rendered with `sandbox="allow-scripts"` only — no same-origin, no parent-frame access. |
| Prompt-seed forgery (someone pretends to be Daniel) | The `From:` header is informational — the actual trust is in the repo URL. GitHub access controls determine what the recipient can do. Worst case: a forged seed asks the recipient to clone a malicious repo; they see the repo URL and decide. |
| Compromised Vercel project | Sender's static previews could be tampered with. Mitigation is per-Vercel-project; out of Mirador's scope. |
| Compromised brain | Local file system access by an attacker. Same threat as any local-only AI tool; out of Mirador's scope. Brain repo private + 2FA on GitHub is the boundary. |
| Recipient's Claude misinterprets a seed and runs harmful command | Skill instructs Claude to ONLY call `mirador open --from-seed`, which parses deterministically. No LLM-driven command construction. |
| `mirador open` accidentally pushing brain content | The CLI's brain access is read-only by default. Brain mutation goes through a dedicated `mirador brain update` path that requires explicit user approval. |

### 5.4 — What we accept (not mitigated in v1)

- Brain content drift / staleness — relies on the user's diligence to curate.
- Cross-collaborator data leakage *through the human*: if Daniel quotes his brain in a shared comment, that's his choice and his disclosure. The system can't prevent it.
- A motivated attacker shipping a phishing static preview — same threat as any unlisted-URL host. Reputation/warning banners deferred to v1.x.

---

## 6. Key Architecture Decisions (ADRs)

Each ADR is a one-page record. Listed here as summaries; full ADRs live in `docs/adr/` if/when the project adopts that pattern.

| ID | Decision | Rationale |
|---|---|---|
| ADR-001 | **CLI binary, not a daemon.** No background process. Every command is one-shot. | Simplicity. No state to corrupt. No "is Mirador running?" UX. Cost: notifications must be pull (or external like email). Accepted. |
| ADR-002 | **State lives in git, not a database.** Workspace + brain + shared = git repos. | Durability, audit, sync, backup all free. Cost: slower at scale. Irrelevant for our scale. |
| ADR-003 | **GitHub identity = Mirador identity.** No Mirador user store. | Eliminates auth product. Pulls us cleanly into the agentic / GSD-tooling segment. Cost: requires GitHub account; gates segment. Accepted. |
| ADR-004 | **Per-artifact GitHub repo, deferred until share.** Solo work stays in workspace. | Solves GitHub clutter (drafts never become repos). Cost: `share` is a non-trivial operation (subtree split, repo create, invite). Accepted. |
| ADR-005 | **Prompt-seeds, not URLs, are the share primitive.** | Aligns with 2026 AI-native distribution. Cost: less click-and-go than a URL; mitigated by landing page that shows the seed. Accepted. |
| ADR-006 | **Landing pages live on the sender's Vercel, not on a Mirador-owned domain.** | Maintains the "no Mirador server" rule. Cost: requires every user to have a Vercel project. Already required by alpha. Accepted. |
| ADR-007 | **Brain is strictly per-user, never shared.** | The killer feature works only if the brain is private. Forces clean architecture; the moment we add "team brain", we have to design that separately as a different object. |
| ADR-008 | **Lazy brain loading via a tool, not upfront context.** | Avoids context-window exhaustion (Casas's "dumb zone" warning). Cost: more round-trips during a session. Accepted; cost is tolerable for the brain-aware experience. |
| ADR-009 | **No AI-prose summaries in scan contexts.** Tables / single-item only. | Direct user feedback. Information density > narrative. |
| ADR-010 | **Alpha is absorbed, not deprecated.** Its publish pipeline becomes v1's static + landing subsystem. | Preserves equity (npm installs, README). Maintains a clean migration path. |
| ADR-011 | **CLI internal architecture: `commands/` → `services/` → `adapters/` → `shared/`. One-way deps.** | Enables vertical-slice agentic implementation. Each slice can touch only its own command + needed services + their adapters without dependency tangles. |

---

## 7. Quality attributes & how we satisfy them

| Attribute | Target | How v1 satisfies it |
|---|---|---|
| Usability | A user can run `mirador init`, then `mirador share` an existing HTML, in <5 minutes from `npm i -g`. | Inherited from alpha's UX; init wizard explicitly designed for first-run. |
| Accessibility | CLI is keyboard-driven; static preview is screen-reader-readable. | Themes (memo, deck, default) are accessible HTML; no overrides for ARIA. |
| Interoperability | Works with any AI agent that can run a shell. Not Claude-Code-exclusive. | The skill is Claude-Code-specific, but the CLI itself is plain Node. Codex skill is shipped alongside (alpha pattern). |
| Compatibility | Existing alpha users are not broken. | `alpha/` stays; `v1/` is a separate folder until consolidation. `mirador upgrade` is idempotent. |
| Security & privacy | Brain never crosses to shared surfaces. No secrets stored by Mirador. | Hard architectural rule (§5.2). Tokens delegated to `gh`/`vercel`. |
| Compliance | No PII collection. No analytics phone-home in v1. | Local-only; nothing reports back. |

---

## 8. Failure modes & operational view

### 8.1 — What can fail, and how the CLI responds

| Failure | Detection | Response |
|---|---|---|
| `gh auth status` fails | Pre-flight in every command that touches GitHub | Print: "Run `gh auth login` and retry." Exit non-zero. |
| `vercel whoami` fails | Pre-flight in `share`, `init` | Print: "Run `vercel login` and retry." Exit non-zero. |
| Workspace repo doesn't exist (uninitialized) | First call to any command other than `init` | Print: "Run `mirador init` first." Exit non-zero. |
| Workspace clone is out-of-date with remote | At every `open` and `inbox`, `git fetch` + `pull --ff-only` | Auto-pull. On non-fast-forward, prompt for `git pull --rebase` or `--merge`. |
| Shared artifact has been deleted upstream | `git fetch` returns 404 | Mark artifact as "tombstoned" in workspace; offer to remove the `.mirador-link`. |
| Vercel deploy fails | Non-zero exit from `vercel deploy` | Print stderr verbatim; preserve local state; suggest `mirador share --retry-publish`. |
| GitHub API rate limit | 403 with rate-limit headers | Print remaining quota and reset time; suggest waiting. |
| Brain file is malformed (bad frontmatter) | Brain loader on `open` | Skip the file, log a warning, continue. Don't abort the session. |
| Prompt-seed parse fails | `--from-seed` parser | Print: "Could not parse seed. Verify it starts with `@mirador-*`." Exit non-zero. Do not invoke any side-effecting command. |
| Two collaborators commit concurrently | `git push` rejected | Standard git resolution: `pull --rebase`, then `push`. The CLI surfaces this; doesn't auto-resolve. |

### 8.2 — Observability

- All commands append to `<workspace>/logs/activity.log` (one line per invocation: timestamp, verb, args, outcome).
- No remote telemetry in v1.
- `mirador config --diagnose` prints versions, auth status, paths, recent log lines.

---

## 9. Open architecture questions (resolve during slice planning)

- **Should the workspace repo also hold the user's `.mirador/config.json`, or stays local-only?** Local-only (current plan) keeps secrets out; in-repo helps multi-machine sync. Trade-off pending.
- **One Vercel project per user, or one project per shared artifact?** One per user (current plan, matches alpha) is simpler; per artifact gives finer access control. Stick with one per user unless we hit conflicts.
- **For `mirador open`, do we render a one-shot HTML diff view (`mirador diff --open-in-browser`), or rely on Claude Code's terminal output for everything?** Decision deferred to VS-02 / VS-08 implementation.
- **Caching of GitHub API responses** (collaborators, notifications). Probably needed for performance, but adds invalidation complexity. Defer to VS-07.

---

## 10. Pinned architectural decisions (this SAD locks them)

- Single CLI binary, no daemon, no server-side Mirador process.
- State entirely in git + flat files.
- `commands/` → `services/` → `adapters/` → `shared/` one-way module structure.
- Skill is a separate concern; the CLI writes/updates it.
- All external integrations (`github`, `vercel`, `git`, `gh`, `clipboard`, `editor`) isolated behind adapters.
- Brain is private by construction; the codebase has no path that writes brain content into a shared repo.
- No LLM API calls from the CLI directly; all AI happens inside Claude Code (or Codex / equivalent) where the user's tokens live.

— end of SAD —
