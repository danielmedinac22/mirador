# Mirador Alpha — Design Spec

**Date:** 2026-05-12
**Status:** Active design (v2 — supersedes v1; see git history)
**Author:** daniel.medina@simetrik.com
**Scope:** Public alpha. Skill-only product. BYO Vercel. The CLI exists only for first-time setup; the **agent** drives every share. The hosted SaaS lives in the V1 spec (`2026-05-12-mirador-design.md`).

---

## 1. Vision

Ship the smallest possible thing that proves the wedge: **after an agent generates an HTML artifact, the user can have a shareable URL in under a minute, without us hosting anything.**

The alpha is a Claude Code skill plus slash command (with Codex support as a stretch goal), backed by a one-time setup wizard. After install, the user lives entirely inside their agent — they never type `mirador` again. Everything else happens through chat with their agent of choice.

---

## 2. Architecture in one paragraph

The product is a **skill + slash command** that ships into one or more AI agents. The agent itself does all the work — read HTML, apply theme, optionally encrypt for the password gate, write to `~/.mirador/site/`, deploy via `vercel` CLI, parse the URL, update the local config. The only thing the agent can't do natively is the password-gate crypto, for which we ship a 30-line standalone Node script. The `mirador` binary is **a setup wizard**, run once, that logs the user into Vercel, links the project, picks defaults, and installs the skill+command into the agent platforms the user selects. After init, the user never types `mirador` again.

---

## 3. In scope

1. A `mirador` binary with **two** commands, both setup-only:
   - `mirador init` — first-run interactive wizard
   - `mirador config` — re-run the wizard, change settings
2. A Claude Code **skill** (`SKILL.md`) and a **slash command** (`/mirador`) that contain the share flow as a prompt — the agent executes it step by step.
3. **Multi-agent install**: the init wizard asks which agents you use and copies the skill+command to the right place for each (Claude Code first-class; Codex best-effort).
4. **Configurable storage path**: default `~/.mirador/`, overridable (e.g., point at iCloud / Dropbox).
5. A **standalone encryption helper script** `~/.mirador/scripts/encrypt.mjs` that the agent invokes when password protection is requested.
6. **Themes**: 3 shipped (`default`, `deck`, `memo`) plus a pseudo-theme `none`. Custom themes are generated **by the agent's own model** from a URL, screenshot, or description — no Anthropic SDK in our binary, no API key handling.
7. **Default policies** the user picks once and the agent respects: theme, password (always-ask / never / always-on), visibility (unlisted / public).
8. README + GIF demo + 5-minute quickstart.
9. Distribution: `curl ... | bash` one-line installer, plus `npm i -g @mirador/cli` for those who prefer it.

---

## 4. Out of scope (deferred to V1 or beyond)

Anything that requires our backend or a managed runtime, plus:

- `mirador share` / `mirador list` as CLI commands — the agent does both, by composing shell calls and reading `~/.mirador/config.json`.
- Server-side AI calls — generation happens inside the user's agent, using its own model.
- Comments / forks / version history / multi-player.
- Real authentication; the gate is and stays client-side.
- Vercel-grade password protection (Pro feature) detection.
- Custom domains, analytics, audit log, embed widget, mobile, MCP-based Cursor integration.

---

## 5. User story

> Daniel installs Mirador once: `curl ... | sh`, then `mirador init`. The wizard asks which agents he uses (he picks **Claude Code** and **Codex**), where to keep his files (default `~/.mirador/`), runs `vercel login`, asks for a project name (`mirador-danielm`), picks `memo` as default theme, and confirms "always ask before adding a password". Two minutes later he is set up.
>
> A week later, inside Claude Code, he asks Claude to generate a Q2 status report as HTML. Claude produces `q2.html`. Daniel types `/mirador`. Claude looks back, finds `q2.html`, asks him three quick questions in chat (name? theme? password?), then transparently runs `vercel deploy` and writes a doc record. Claude prints `https://mirador-danielm.vercel.app/d/q2-report/` — Daniel copies it manually and DMs it to his manager.
>
> Daniel never typed `mirador` again after that first day.

---

## 6. The two surfaces

The product has exactly two user-facing surfaces. The CLI is **setup only**. The skill+slash is where every share happens.

### Surface A — CLI: setup-only

| Command | Purpose | Frequency |
|---|---|---|
| `mirador init` | First-run wizard. Configure Vercel, defaults, install skill+command into selected agents. | Once. |
| `mirador config` | Re-run the same wizard with current values as defaults. Change which agents are installed, switch default theme, etc. | Rarely. |

There are no other CLI commands. Not hidden, not internal. The binary is **a wizard**.

### Surface B — Skill + Slash Command

- **Skill** (`~/.claude/skills/mirador/SKILL.md`): Claude offers to publish after producing HTML in the session. Passive trigger.
- **Slash command** (`~/.claude/commands/mirador.md`): the user types `/mirador [archivo]`. Active trigger.

Both deliver the same prompt to Claude. The prompt is the **whole spec of the share flow** — see §8.

---

## 7. The init wizard

`mirador init` walks the user through these questions, one at a time, using `@clack/prompts` for nice TTY UI. Each has a sensible default; the wizard takes maybe 90 seconds end-to-end.

1. **Which AI agents do you use?** (multi-select)
   - [ ] Claude Code  → installs to `~/.claude/skills/mirador/` and `~/.claude/commands/mirador.md`
   - [ ] Codex CLI    → installs to `~/.codex/skills/mirador/` (path verified in init; if unknown, prints manual instructions)
   - [ ] Otro / manual → prints copy-paste instructions for the user's setup

2. **Where should Mirador store your files?**
   - Default: `~/.mirador/`
   - Custom path: useful for syncing themes/site via iCloud Drive, Dropbox, or git.
   - Whatever path is chosen, the binary stores it in `~/.mirador-home` (a tiny pointer file at `$HOME`) so future runs find it. Internal modules resolve all paths from this pointer.

3. **Vercel project setup**
   - Verifies `vercel --version` works; otherwise prints install link and exits.
   - Runs `vercel login` if `vercel whoami` fails (the user does the OAuth dance in the browser).
   - Asks for a project name (default: `mirador-<username>`).
   - Runs `vercel link --yes --name <project-name>` from a temp directory; copies `.vercel/project.json` next to the storage path.

4. **Default theme**
   - Choices: `default`, `deck`, `memo`, `none`. The user can change per-doc later.

5. **Password default policy**
   - `always-ask` (default) — agent asks every time
   - `never` — agent never asks; sharing is always unprotected
   - `always-on` — agent asks for the password every time (assumes you want one)

6. **Visibility default**
   - `unlisted` (default) — link-only, not on the index page
   - `public` — listed on the index of your Mirador site

After the answers, init:

- Writes `<storage-path>/config.json` with the answers.
- Creates `<storage-path>/themes/`, `<storage-path>/site/`, `<storage-path>/scripts/`.
- Copies the shipped themes from the package into `<storage-path>/themes/`.
- Copies `scripts/encrypt.mjs` from the package into `<storage-path>/scripts/`.
- Copies the skill + slash command into the directories chosen in question 1.
- Prints a "ready" message with a next-step hint: "Open Claude Code and type `/mirador`."

`mirador config` runs the exact same flow, but pre-fills every prompt with the current config and skips Vercel-link (just re-verifies auth).

---

## 8. What the agent does (the share flow)

This is the contract the skill + slash command embed as a prompt for the agent. The user never sees it; they just answer questions in chat.

```
INPUT: optional file path from slash args; otherwise the agent finds the most
recent HTML artifact in the session.

STEPS:

1. RESOLVE STORAGE
   Read ~/.mirador-home to find the storage root. Read <root>/config.json for
   defaults. If either is missing, tell the user to run `mirador init` first.

2. ASK QUESTIONS (in chat, respecting defaults from config)
   - name: slug (lowercase a-z, 0-9, dashes). Suggest from <title> or filename.
   - theme: list themes from <root>/themes/. If user wants custom, ask for
     URL / screenshot / description, then GENERATE the theme.css yourself
     (use vision/reasoning), write into <root>/themes/<name>/{meta.json, theme.css, head.html}.
   - password: per policy. If 'always-ask' or 'always-on', ask. If 'never', skip.
   - visibility: per policy.

3. APPLY THEME
   Read user HTML. Build themed HTML by string manipulation:
   - Ensure <head> exists; if not, insert one.
   - Insert <style data-mirador-theme="<name>">...</style> + theme's head.html
     before </head>.
   - Wrap body content in <div class="mirador-content">...</div>.
   - If theme name is "none", skip wrapping and styling entirely.

4. (OPTIONAL) WRAP WITH PASSWORD GATE
   If password given, run:
     node <root>/scripts/encrypt.mjs \
       --in <tmp themed file> \
       --out <final file> \
       --password "<pw>"
   This produces an HTML document that shows the gate UI; the original content
   is AES-GCM ciphertext in a <script> constant, decrypted only after the
   user types the correct password in the browser.

5. WRITE TO SITE
   Final HTML → <root>/site/d/<slug>/index.html
   Original HTML → <root>/site/d/<slug>/original.html (verbatim, for reference)

6. REBUILD INDEX (optional, only if visibility=public)
   <root>/site/index.html lists all public docs from config.json. The agent
   regenerates it from a template at <root>/templates/site-index.html.

7. DEPLOY
   Run via shell:
     vercel deploy --prod <root>/site --yes --no-clipboard
   Parse stdout for https://... URL.
   Fallback if parse fails: https://<config.vercel.domain>/d/<slug>/

8. APPEND TO CONFIG
   Add a doc record to config.json:
     { slug, title, theme, passwordProtected, visibility, url, createdAt }

9. PRINT
   Print the URL to the user in chat with a one-line confirmation.
```

This algorithm is written out verbatim in `alpha/skill/SKILL.md` and is the contract every agent platform follows.

---

## 9. Storage layout

```
<storage-path>/                            ← default ~/.mirador/, configurable
├── config.json
│     {
│       "version": 1,
│       "storage_path": "/Users/.../mirador",
│       "vercel": {
│         "projectId": "...",
│         "projectName": "mirador-danielm",
│         "domain": "mirador-danielm.vercel.app",
│         "orgId": "..."
│       },
│       "agents": ["claude-code", "codex"],
│       "defaults": {
│         "theme": "memo",
│         "password_policy": "always-ask",
│         "visibility": "unlisted"
│       },
│       "docs": [ { slug, title, theme, passwordProtected, visibility, url, createdAt } ]
│     }
├── themes/                                ← shipped + user-generated
│   ├── default/{meta.json, theme.css, head.html}
│   ├── deck/...
│   ├── memo/...
│   └── <user-generated>/
├── site/                                  ← what gets deployed to Vercel
│   ├── index.html                         ← lists public docs
│   ├── d/<slug>/index.html                ← themed (and optionally gated) doc
│   └── .vercel/project.json               ← so `vercel deploy` is linked
├── templates/                             ← shared static templates
│   ├── site-index.html
│   └── password-gate.html
├── scripts/
│   └── encrypt.mjs                        ← standalone Node script for the gate
└── logs/
    └── deploys.log                        ← agent appends one line per deploy
```

A pointer file `~/.mirador-home` contains the absolute path to the storage root when it isn't `~/.mirador/`. The agent reads it first to find everything else.

---

## 10. Themes

### Shipped themes

`default` (clean & neutral), `memo` (serif document), `deck` (presentation), plus the pseudo-theme `none` (publish verbatim, no wrapping). All shipped inside the npm package; `mirador init` copies them into `<storage-path>/themes/`.

### Generated themes (agent-side)

The agent does the generation. When the user picks `+ generate from a reference…` in the share flow:

- **URL** — the agent fetches the page (it has shell/curl access), reads HTML + linked CSS, then writes a `theme.css` that captures the visual language. CSS must be scoped under `.mirador-content { ... }`.
- **Screenshot** — the user attaches/points to an image. The agent uses its vision capability to write the CSS.
- **Description** — natural language. The agent writes CSS from the description.

The agent writes the result directly to `<storage-path>/themes/<name>/{meta.json, theme.css, head.html}`. No SDK call, no API key, no helper binary. The agent's own model is the generator.

`meta.json` shape:
```
{
  "name": "boardish",
  "description": "Inspired by boardroom decks; cool blues, generous whitespace.",
  "generated_from": { "type": "url" | "image" | "description", "ref": "..." },
  "created_at": "..."
}
```

---

## 11. Password gate

Client-side only. Invoked from inside the agent's share flow. The agent runs:

```
node <storage-path>/scripts/encrypt.mjs --in <themed.html> --out <gated.html> --password "<pw>"
```

`scripts/encrypt.mjs` is a small standalone Node script (no npm deps; uses `node:crypto.subtle`) that:

1. Reads the input HTML.
2. Derives `key = PBKDF2(password, salt, 200_000, SHA-256)`.
3. Encrypts the HTML with AES-GCM. Embeds `salt`, `iv`, and ciphertext as base64 constants in the gate template at `<storage-path>/templates/password-gate.html`.
4. Writes the result to the output path.

The gate page renders an input + button; on submit, it derives the key in the browser via `window.crypto.subtle`, decrypts the ciphertext, and replaces the document with the result. No third-party JS crypto library on either side.

**Threat model — same as before:** view-source attackers see only ciphertext; a determined attacker who watches a real user's browser memory can still grab the decrypted content. The gate page and the skill flow both say so out loud.

---

## 12. Vercel integration

`mirador init` handles all Vercel auth and project linking. Specifically:

1. Verifies `vercel` is on PATH.
2. Verifies `vercel whoami`; if not logged in, runs `vercel login` (browser flow).
3. Asks for a project name; runs `vercel link --yes --name <name>` from a temp dir.
4. Copies the resulting `.vercel/project.json` into `<storage-path>/site/.vercel/`.

After init, the **agent** runs every deploy directly via shell:

```
vercel deploy --prod <storage-path>/site --yes --no-clipboard
```

The agent parses stdout for the deployment URL. Fallback: construct `https://<config.vercel.domain>/d/<slug>/` from the stable project domain stored in config.

If `vercel` errors at deploy time (auth expired, network), the agent surfaces the error to the user and suggests `mirador config` to re-auth.

---

## 13. Multi-agent support

The wizard installs the skill+command into one or more agent homes:

| Agent | Skill path | Slash command path | Status |
|---|---|---|---|
| Claude Code | `~/.claude/skills/mirador/SKILL.md` | `~/.claude/commands/mirador.md` | First-class |
| Codex CLI | `~/.codex/skills/mirador/SKILL.md` (verified during init implementation) | not applicable yet | Best-effort |
| Cursor | n/a (uses MCP, not skills) | n/a | Deferred to v0.2 |
| Other | — | — | Manual: init prints the file contents to paste |

**Best-effort policy:** if Codex's exact layout is unknown at init time, the wizard prints a manual install snippet and writes the files to `<storage-path>/install-hints/codex.md` so the user can copy them.

The skill prompt itself is **agent-agnostic**: it describes the share flow in plain English, with shell commands the agent runs. Any agent that can read files, write files, and run shell can follow it.

---

## 14. Distribution

Two install paths, both leading to the same setup:

### One-liner

```
curl -fsSL https://mirador.dev/install.sh | sh
```

`install.sh`:
1. Requires Node 20+.
2. Probes that `npm` global installs work without sudo (no silent `sudo`).
3. `npm i -g @mirador/cli`.
4. Reminds the user to run `mirador init` to set up.

### npm

```
npm i -g @mirador/cli
mirador init
```

### Uninstall

```
npm uninstall -g @mirador/cli
rm -rf ~/.mirador ~/.claude/skills/mirador ~/.claude/commands/mirador.md ~/.codex/skills/mirador
```

Documented in the README. No `mirador uninstall` command.

---

## 15. Pinned decisions

- **CLI = wizard only.** Two commands: `init` and `config`. No `share`, no `list`. The agent does the rest.
- **Theme generation is agent-side.** No Anthropic SDK in the binary; the agent's own model produces themes.
- **Encryption helper is a standalone Node script** in `<storage-path>/scripts/encrypt.mjs`. The agent invokes it via shell. Uses `node:crypto.subtle` (Node 20+ native).
- **Storage path is configurable** via `mirador init`/`config`. Default `~/.mirador/`. A pointer file `~/.mirador-home` records the chosen location.
- **Default policies live in config**: theme, password, visibility. The agent respects them and only asks when policy permits.
- **Multi-agent install** in the wizard: Claude Code first, Codex best-effort, manual for everything else.
- **No `mirador list` in the binary.** "What have I shared?" is something the user asks the agent.

---

## 16. Success criteria

1. `curl ... | sh && mirador init` produces a working setup in **under 3 minutes** on a fresh macOS or Ubuntu account (assuming the user has a Vercel account and Node 20).
2. After init, typing `/mirador <file.html>` in Claude Code yields a viewable URL in **under 60 seconds** (excluding Vercel deploy time).
3. Theme generation from a screenshot of a real reference site visibly resembles the reference for **8 of 10** test inputs (judged by the author).
4. The password gate, with a strong password, resists a **30-minute** view-source-and-poke attempt by a security-aware engineer.
5. The README quickstart works verbatim on a clean macOS and a clean Ubuntu.
6. The same `mirador init` (with both Claude Code and Codex selected) results in `/mirador` working in both agents.

---

## 17. Roadmap (build order)

1. CLI scaffold (`alpha/package.json`, `tsconfig`, biome, vitest).
2. CLI entrypoint with `init` and `config` commands only.
3. `paths.ts` + `~/.mirador-home` pointer + config read/write.
4. Init wizard, end-to-end: agent selection, storage path, Vercel link, defaults.
5. Shipped themes + `templates/site-index.html` + `templates/password-gate.html` committed to the package.
6. `scripts/encrypt.mjs` standalone helper + tests.
7. `SKILL.md` + `/mirador` command markdown — the prompt that drives the agent.
8. `mirador config` (re-run wizard).
9. Installer (`install.sh`) + README + multi-agent install verification.
10. Manual end-to-end smoke: install → init → `/mirador` in Claude Code → URL.
11. Codex layout research + best-effort install path.
12. Pre-release polish (GIF demo, success-criteria walkthrough).

---

## 18. Open questions

- **Codex skill/slash layout.** Confirm `~/.codex/skills/<name>/SKILL.md` is the right place; if not, find it during step 11.
- **Final installer domain** (`mirador.dev`?). Decision before going public.
- **`mirador config` behavior on partial changes** (e.g., adding Codex months later): does it re-run the full wizard, or jump to a "add agent" sub-flow? Tentative: full wizard with current values as defaults; if it gets annoying, add the sub-flow in v0.2.
- **Whether `/mirador` should accept inline HTML** (not just a file path), e.g., `/mirador <<EOF ...html... EOF`. Tentative no; the agent already produces HTML files in-session, and accepting inline strings makes the prompt heavier.
