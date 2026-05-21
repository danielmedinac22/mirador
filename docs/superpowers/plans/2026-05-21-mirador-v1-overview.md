# Mirador v1 — Implementation Overview

**Date:** 2026-05-21
**Status:** Active
**Author:** daniel.medina@simetrik.com
**Reference docs:**
- PRD: [`docs/superpowers/specs/2026-05-21-mirador-v2-design.md`](../specs/2026-05-21-mirador-v2-design.md)
- SAD: [`docs/superpowers/specs/2026-05-21-mirador-v1-sad.md`](../specs/2026-05-21-mirador-v1-sad.md)

This is the **dispatch table** for Mirador v1 implementation. Each vertical slice has:
- A scope summary,
- A demoable acceptance criterion,
- Dependencies on other slices,
- The CLI surface it touches,
- The modules (per SAD §2) it creates or modifies,
- A model recommendation for autonomous execution.

When a slice begins implementation, a detailed task-by-task plan is written as `docs/superpowers/plans/2026-05-21-mirador-v1-<slug>.md` and linked from its GitHub issue.

---

## Global conventions for all slices

- **Working tree:** `v1/` (parallel to `alpha/`).
- **Stack:** TypeScript strict, Node 20+, `commander`, `@clack/prompts`, `tsup`, `vitest`, `biome`.
- **Module layout:** `src/commands/`, `src/services/`, `src/adapters/`, `src/shared/` (SAD §2.1).
- **One-way deps:** commands → services → adapters → shared. No exceptions.
- **No LLM API calls from the CLI.** Anthropic SDK is forbidden in v1.
- **Tests:** Vitest unit per service + at least one integration test per slice that exercises the full CLI invocation.
- **No new external dependencies** without justification (added to the slice plan and approved at review).
- **Commits per slice:** one feature commit + one test commit minimum. Squash on merge.
- **Branch naming:** `feat/v1-vs-<NN>-<slug>` (e.g. `feat/v1-vs-01-init`).

---

## Slice dependency graph

```
VS-01 (init) ─┬─► VS-02 (new + open, workspace-local)
              │
              ├─► VS-08 (brain lifecycle)
              │
              ▼
VS-03 (share) ─► VS-04 (preview + landing) ─► VS-05 (prompt-seed + skill trigger)
                                                       │
                                                       ▼
                                              VS-06 (request / accept / decline)
                                                       │
                                                       ▼
                                              VS-07 (inbox)
                                                       │
                                                       ▼
                                              VS-09 (role override)
                                                       │
                                                       ▼
                                              VS-10 (upgrade from alpha)
```

VS-02 and VS-08 can run in parallel once VS-01 is done. VS-09 can start as soon as VS-02 + VS-08 are done. VS-10 is gated on everything else (full surface needed).

---

## VS-01 — `mirador init` (workspace + brain scaffold)

**Goal:** A user can run `mirador-v1 init` once and end up with:
- A private GitHub repo `<handle>-mirador` (or in a dedicated org if chosen).
- Local clone at `~/.mirador/workspace/`.
- Scaffolded `brain/`, `artifacts/`, `incoming-requests/`, `outgoing-requests/`, `logs/`, `mirador.json`.
- Initial brain files (`brain/role-author.md`, `brain/role-reviewer.md`, `brain/preferences.md`) generated from a 5–10-question wizard.
- Mirador skill + slash command installed to `~/.claude/skills/mirador/` and `~/.claude/commands/mirador.md`.
- Vercel project ensured (reuse if exists from alpha).

**CLI surface:** `mirador init` (with `--reset`, `--org <name>`, `--namespace personal|org` flags).

**Modules touched:**
- `commands/init.ts`
- `services/workspace.ts`, `services/brain.ts`, `services/skill.ts`, `services/vercel-project.ts`
- `adapters/github.ts`, `adapters/vercel.ts`, `adapters/git.ts`, `adapters/gh-cli.ts`, `adapters/fs.ts`
- `shared/paths.ts`, `shared/config.ts`, `shared/errors.ts`

**Acceptance criteria:**
- [ ] Fresh user (no `~/.mirador/`) can run `mirador-v1 init` interactively and reach success.
- [ ] Workspace repo created on GitHub, cloned locally, scaffolded with brain + folders.
- [ ] `mirador.json` written with `version: 1`, vercel domain, brain location, defaults.
- [ ] Skill `~/.claude/skills/mirador/SKILL.md` installed (still placeholder body — VS-05 fills it).
- [ ] Re-running `mirador-v1 init` is idempotent (detects state, offers `--reset`).
- [ ] Pre-flight failures (no `gh`, no `vercel`, no `git`) print clear remediation.
- [ ] Unit tests for each service; integration test exercising init end-to-end against a mocked GitHub + Vercel.

**Deps:** none (foundational).

**Suggested model:** Claude Opus 4.7 for the wizard prompts (UX feel), Codex for the adapter scaffolding. Implementable autonomously.

---

## VS-02 — `mirador new` + `mirador open` (workspace-local, brain-aware first turn)

**Goal:** A user can create a workspace artifact, open it in Claude Code, and the first turn produced by the agent follows the tabular brief format from PRD §11.1 — using the brain.

**CLI surface:** `mirador new <slug>`, `mirador open <slug>` (workspace-local for now).

**Modules touched:**
- `commands/new.ts`, `commands/open.ts`
- `services/artifact.ts`, `services/session.ts`, `services/changeLog.ts`
- `adapters/claudeCode.ts`, `adapters/editor.ts`
- `shared/lastSeen.ts`

**What "brain-aware first turn" means concretely (since VS-08 isn't built yet):**
- A session-scoped skill is written to `~/.mirador/session-skills/<id>/SKILL.md` containing:
  - The artifact's path,
  - A pointer to the user's brain location,
  - The exact template for the first-turn brief (tabular + brain flag + next commands).
- The brief format is *enforced by the skill text*. Brain content is read by Claude Code via the on-demand tool exposed in VS-08 — for VS-02, the brain flag section is left as a TODO comment in the skill and resolved when VS-08 lands.

**Acceptance criteria:**
- [ ] `mirador-v1 new q2-draft` creates `<workspace>/artifacts/q2-draft/` with a `CONTEXT.md` from a 2-question prompt.
- [ ] `mirador-v1 open q2-draft` writes a session skill, opens Claude Code at the folder.
- [ ] When Claude Code starts in that folder, its first turn matches the format spec (validated via golden test on the skill's instructions, plus a manual confirmation).
- [ ] `last-seen.json` is updated with current HEAD SHA + timestamp.
- [ ] Re-opening shows the table populated with `git log` since last-seen.
- [ ] Unit tests for `changeLog`, `session`, `artifact`. Integration test for the new → open round-trip.

**Deps:** VS-01.

**Suggested model:** Claude Opus 4.7 (the skill instruction crafting is high-leverage prose).

---

## VS-03 — `mirador share` (workspace → shared repo + invite)

**Goal:** Promoting an artifact to a shared repo: snapshot, repo creation, collaborator invite, link file.

**CLI surface:** `mirador share <slug> --with <email> [--role <role>] [--note "..."] [--keep-history]`.

**Modules touched:**
- `commands/share.ts`, `commands/unshare.ts`
- `services/share.ts`, `services/inviteResolver.ts`, `services/linkFile.ts`
- `adapters/github.ts` (extended for repo creation, collaborator invite, subtree-split), `adapters/git.ts`

**Acceptance criteria:**
- [ ] Resolves email → GitHub handle via API; ambiguous cases prompt the user.
- [ ] Creates the shared repo (private by default; `--public` opts into public).
- [ ] Default = snapshot-clean (fresh repo init). `--keep-history` uses `git subtree split`.
- [ ] Invitee added as collaborator with write access; invite email sent by GitHub.
- [ ] Artifact's workspace folder replaced with `.mirador-link` pointer file (PRD §5.2).
- [ ] `.mirador/manifest.json` written inside the shared repo with role, auto-invite list, ownership.
- [ ] `mirador-v1 unshare <slug>` brings the artifact back to workspace, archives the shared repo on GitHub.
- [ ] Idempotency: re-running `share` on a shared artifact updates collaborator set, doesn't recreate the repo.
- [ ] Integration test against a fixture GitHub API.

**Deps:** VS-02.

**Suggested model:** Codex (lots of API plumbing, less UX feel).

---

## VS-04 — Static preview + landing page generation (reuses alpha render pipeline)

**Goal:** Every share command also publishes a themed static preview (`/d/<slug>/`) and a landing page (`/i/<slug>/`) to the user's Vercel project.

**CLI surface:** integrated into `mirador share`; no new top-level verb. `mirador preview <slug>` available for manual republish.

**Modules touched:**
- `services/staticPreview.ts`, `services/landingPage.ts`
- `adapters/vercel.ts` (extended)
- Templates: `v1/templates/landing.html`, plus reused `v1/themes/*` (copied from `alpha/themes/`).

**Implementation note:** The themed-render code from `alpha/` is **copied** into `v1/services/staticPreview.ts` (not imported). When consolidation happens (post-VS-10), the shared logic is extracted into a `packages/shared/` workspace.

**Acceptance criteria:**
- [ ] `mirador-v1 share` produces both `/d/<slug>/index.html` and `/i/<slug>/index.html` on the user's Vercel.
- [ ] Themes (`default`, `memo`, `deck`, `none`) carry over identically from alpha.
- [ ] Password gate available for `/d/<slug>/` (carry over `alpha/scripts/encrypt.mjs`).
- [ ] Landing page renders: sender info, role, note, thumbnail, primary CTA (copy seed), secondary CTA (just view).
- [ ] Primary CTA copies the `@mirador-invitation` block to clipboard on click (client-side JS).
- [ ] Deploy is logged to `<workspace>/logs/activity.log`.
- [ ] Golden test for landing HTML output; integration test for the deploy command sequence.

**Deps:** VS-03.

**Suggested model:** Codex (template work + adapter glue).

---

## VS-05 — Prompt-seed protocol + skill trigger

**Goal:** The skill recognizes `@mirador-invitation`, `@mirador-request`, `@mirador-response` blocks pasted into Claude Code and dispatches them through the CLI.

**CLI surface:** `mirador open --from-seed`, `mirador accept --from-request`, `mirador decline --from-request`, `mirador respond` (parser entry points). `mirador parse-seed` for debugging.

**Modules touched:**
- `commands/openFromSeed.ts`, `commands/parseSeed.ts`
- `services/promptSeed.ts` (parser, validator, composer)
- `v1/skill/SKILL.md` rewritten with the full trigger contract (replacing the placeholder)

**Acceptance criteria:**
- [ ] Deterministic parser for all 3 seed types. Round-trips: compose → parse → identical struct.
- [ ] Validation rejects malformed seeds with clear error messages.
- [ ] Skill instructions explicitly tell Claude: "if user pastes a block starting with `@mirador-*`, call `mirador <verb> --from-* <text>`; do NOT interpret the seed yourself."
- [ ] Integration test: a Claude Code session given a sample seed invokes the correct command (validated via skill discovery test fixture).
- [ ] Unit tests for parser with malformed-seed fixtures (truncated, wrong order, missing required fields).

**Deps:** VS-03 (so seeds can carry real repo URLs), VS-04 (so they can carry landing URLs).

**Suggested model:** Claude Opus 4.7 (the SKILL.md instructions are prose-engineering).

---

## VS-06 — `mirador request` + `accept` + `decline`

**Goal:** A user can request an artifact that doesn't exist; the recipient pastes the seed, accepts or declines; on accept, the artifact is created in the recipient's workspace pre-filled with the request's context.

**CLI surface:** `mirador request`, `mirador accept`, `mirador decline`, `mirador respond`.

**Modules touched:**
- `commands/request.ts`, `commands/accept.ts`, `commands/decline.ts`, `commands/respond.ts`
- `services/request.ts`, `services/expiration.ts`
- Templates: `v1/templates/request-landing.html`

**Acceptance criteria:**
- [ ] `mirador-v1 request "Q3 forecast" --to maria@simetrik.com --by 2026-05-29 --context "..."` composes a `@mirador-request` seed, publishes request landing at `/r/<slug>/`, copies seed URL to clipboard, writes stub to `<workspace>/outgoing-requests/`.
- [ ] On accept: creates `<workspace>/artifacts/<slug>/` with pre-filled `CONTEXT.md`, marks auto-invite. Sends `@mirador-response status=accepted` seed (copied to clipboard).
- [ ] On decline: sends `@mirador-response status=declined --reason "..."`. No artifact created.
- [ ] Expiration: 14 days from `by:` (or 30 if no `by:`). Expired requests show up in inbox as actionable.
- [ ] Status updates on request landing: requester's Vercel re-publishes with new state (accepted / declined / completed / expired).
- [ ] Integration tests for full request → accept and request → decline flows.

**Deps:** VS-05.

**Suggested model:** Claude (UX flow + state machine clarity) for command logic; Codex for landing template.

---

## VS-07 — `mirador inbox` (computed view)

**Goal:** Running `mirador` (no args) or `mirador inbox` shows pending items in Mode A (single critical) or Mode B (tabular) per PRD §11.2. No persistent inbox store.

**CLI surface:** `mirador` (default), `mirador inbox [--all]`.

**Modules touched:**
- `commands/inbox.ts`
- `services/inbox.ts`, `services/ranker.ts`, `services/changeAggregator.ts`
- `adapters/github.ts` (extended for Notifications API)

**Acceptance criteria:**
- [ ] Computes inbox at every invocation from: outgoing/incoming requests, shared-repo fetches, GitHub Notifications, brain flags.
- [ ] Mode A triggered when one item has priority_score > 30% gap above #2; else Mode B.
- [ ] Mode B output is a tab-aligned table; no prose between rows; max 8 rows with `+ N more`.
- [ ] Brain flags computed on-the-fly (no preflight scan; lazy).
- [ ] Performance: <2s for a user with ~10 shared artifacts and ~50 GitHub notifications (caching at the adapter level).
- [ ] Unit tests for ranker, changeAggregator. Integration test for the inbox command against a fixture state.
- [ ] `--all` shows everything unranked, regardless of dominance.

**Deps:** VS-03, VS-04, VS-06 (needs all sources to aggregate).

**Suggested model:** Claude (ranking logic + format crafting).

---

## VS-08 — Brain lifecycle (init seed, on-demand access, agent-proposed updates)

**Goal:** Brain is loaded lazily by Claude Code via an on-demand tool exposed by the session skill. Updates proposed by the agent are written only after explicit human approval.

**CLI surface:** `mirador brain` (interactive), `mirador brain list`, `mirador brain show <topic>`, `mirador brain update --propose <text>` (internal — called by skill).

**Modules touched:**
- `commands/brain.ts`
- `services/brain.ts` (extended), `services/brainProposals.ts`
- The session skill (from VS-02) gets the `mirador brain` tool wired in
- Brain markdown format spec enforced

**Acceptance criteria:**
- [ ] `mirador-v1 brain list` shows all brain files with descriptions from frontmatter.
- [ ] `mirador-v1 brain show <topic>` prints the matching brain file's body.
- [ ] During a `mirador open` session, Claude can call `mirador brain --topic <x>` and get content back.
- [ ] When Claude proposes a brain update, it calls `mirador brain update --propose <text>`. The CLI writes to a staging file and prompts the user (interactive y/n/edit). On yes, the brain repo is updated; on edit, the user's `$EDITOR` opens.
- [ ] Role override: when an artifact declares `role_for_collaborators`, only that role's brain section + preferences activate.
- [ ] Tests: brain query, proposal, accept, reject, edit flows.
- [ ] Privacy assertion test: a unit test confirms no code path can write brain content into a shared repo's path.

**Deps:** VS-02 (session skill).

**Suggested model:** Claude (prose + privacy boundary logic).

---

## VS-09 — Role override

**Goal:** A shared artifact declares a role for collaborators; their brain's role-specific section activates when they open it.

**CLI surface:** `mirador share --role <role>` (already in VS-03 contract); read-only — no new commands.

**Modules touched:**
- `services/role.ts` (new)
- `services/session.ts` (extended to apply role)
- `services/brain.ts` (extended to load role-specific sections)
- `.mirador/manifest.json` schema updated

**Acceptance criteria:**
- [ ] Two test users with different brain `role-reviewer.md` sections open the same shared artifact (manifest declares role=reviewer). Their session briefs visibly differ in the brain-flag line.
- [ ] If the user has no brain section for the declared role, only `preferences.md` activates; warning prints once.
- [ ] `mirador-v1 brain init --role <role>` seeds an empty role-specific brain file (interactive).
- [ ] Manifest schema validated on artifact open; corrupt manifests print actionable error.

**Deps:** VS-02, VS-03, VS-08.

**Suggested model:** Claude.

---

## VS-10 — `mirador upgrade` (alpha → v1 migration)

**Goal:** An existing alpha user runs `mirador-v1 upgrade` and ends up with a full v1 setup without losing their alpha-published docs.

**CLI surface:** `mirador upgrade [--dry-run]`.

**Modules touched:**
- `commands/upgrade.ts`
- `services/upgrade.ts`
- `adapters/alpha-detector.ts`

**Acceptance criteria:**
- [ ] Detects `~/.mirador/` legacy layout (alpha).
- [ ] Creates v1 workspace repo + clones to `~/.mirador/workspace/`.
- [ ] Moves `~/.mirador/site/d/*` into `<workspace>/artifacts/` as unshared artifacts with `.mirador/legacy.json` marker preserving original URL.
- [ ] Bootstraps an empty brain; offers (but doesn't force) the brain-seeding wizard.
- [ ] Preserves alpha config so the user can continue running `mirador` (alpha) standalone.
- [ ] `--dry-run` prints what would happen without changing anything.
- [ ] Integration test: simulate an alpha install state, run upgrade, verify v1 state + alpha still functional.

**Deps:** VS-01 through VS-09 (full v1 surface).

**Suggested model:** Claude (migration UX is high-stakes; needs careful prose).

---

## Aggregate definition of done for v1

When all 10 slices merge, the following demo must run end-to-end on a fresh machine:

1. `npm i -g mirador-cli-v1-dev`
2. `mirador-v1 init` → workspace + brain + skill installed.
3. `mirador-v1 new q2-draft` → folder created.
4. Inside Claude Code at the folder, ask it to write a 1-pager HTML.
5. `mirador-v1 share q2-draft --with alice@example.com --role reviewer --note "test"` → repo created, alice invited, landing URL on clipboard.
6. Alice (different machine, different brain) does her own `mirador-v1 init`, then pastes the seed → opens session → her brain shapes her first turn differently from Daniel's.
7. Alice declines an unrelated request she received → requester's landing updates.
8. Daniel runs `mirador-v1` (no args) → inbox shows Alice's recent activity ranked above older items.
9. Daniel runs `mirador-v1 upgrade` on an old alpha-only machine → v1 takes over without breaking alpha.

— end of overview —
