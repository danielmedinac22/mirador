# Mirador Alpha — Design Spec

**Date:** 2026-05-12
**Status:** Draft (pending review)
**Author:** daniel.medina@simetrik.com
**Scope:** Public alpha release. Skill-only product, BYO Vercel. The hosted SaaS lives in the V1 spec (`2026-05-12-mirador-design.md`).

---

## 1. Vision

Ship the smallest possible thing that proves the wedge: **after Claude generates an HTML artifact, the user can have a shareable URL in under a minute, without us hosting anything.**

The alpha is a Claude Code skill plus a thin CLI. It uses **the user's own Vercel account** as the hosting layer. Mirador adds the workflow, the theming, and the UX — Vercel does the bytes-on-the-internet part.

The alpha is a stepping stone. The V1 spec replaces Vercel with our own runtime once we have validated demand.

---

## 2. What's in scope

1. A Claude Code skill that activates when the agent has produced HTML in the session.
2. A Claude Code **slash command** `/mirador [archivo]` for explicit, user-driven invocation. Without args, Claude looks back in the conversation for the most recent HTML produced; with a path, uses it directly. Internally it triggers the same skill flow.
3. A Node CLI installed alongside the skill, with two public commands:
   - `mirador share <file>` — main flow
   - `mirador list` — view & manage your shared docs
3. A guided first-run that authenticates Vercel and creates the user's Mirador project.
4. A guided share flow that asks the user (through the skill, conversationally):
   - **name** (slug)
   - **theme** (default / pick / generate from reference)
   - **password** (no password / soft client-side gate)
   - **visibility** (unlisted link-only / public listed on index)
5. A theme system with:
   - 3 shipped themes: `default`, `deck`, `memo`, plus a pseudo-theme `none` (publish verbatim, no wrapping)
   - The ability to **generate a custom theme from a reference** — URL, screenshot, or natural-language description
   - Local persistence in `~/.mirador/themes/` so generated themes can be reused
6. A local static site that the CLI maintains and deploys to Vercel on each share.
7. Soft password gate (client-side JS) for password-protected docs.
8. A README + GIF demo + 5-minute quickstart.
9. Distribution: `curl ... | bash` one-line installer, plus `npm i -g @mirador/cli` for those who prefer it.

## 3. What's NOT in scope

Anything that requires our backend or a managed runtime. Everything below moves to V1:

- Comments / forks / version history / multi-player
- Server-side "edit with AI" (the skill can re-generate via Claude in the session, but no API)
- Real authentication / accounts
- Vercel-grade password protection (we only do soft gate; Pro detection is a *nice-to-have* not in MVP, see §11)
- Custom domains
- Analytics
- Audit log
- Embed widget
- Mobile

We also do **not** ship a long list of CLI commands. The visible surface is two commands. Everything else is conversational.

---

## 4. The User Story

> Daniel asks Claude to generate a one-page status report on Q2 results. Claude produces `q2-report.html`. Claude notices the Mirador skill is installed and asks: "Want me to publish this and give you a link?" Daniel says yes. The skill conversationally asks for a name, theme, and whether to password-protect. Daniel says "use the memo theme, no password". 15 seconds later he has a URL on his clipboard and a confirmation in the chat. He DMs it to his manager.

That is the entire alpha. Everything else in this spec exists to make that story work reliably.

---

## 5. Architecture

### Repo layout (same monorepo as V1 spec)

```
mirador/
├── alpha/                          ← LIVES HERE
│   ├── README.md
│   ├── install.sh                  ← one-line installer
│   ├── package.json                ← @mirador/cli
│   ├── command/
│   │   └── mirador.md              ← /mirador slash command
│   ├── src/                        ← CLI source (TypeScript)
│   │   ├── index.ts                ← entrypoint, command routing
│   │   ├── commands/
│   │   │   ├── share.ts
│   │   │   └── list.ts
│   │   ├── flows/                  ← conversational flows
│   │   │   ├── init.ts             ← first-run Vercel setup
│   │   │   ├── name.ts
│   │   │   ├── theme.ts
│   │   │   └── password.ts
│   │   ├── theme/
│   │   │   ├── apply.ts            ← inject theme into HTML
│   │   │   ├── generate.ts         ← AI-generate theme from reference
│   │   │   └── store.ts            ← read/write ~/.mirador/themes/
│   │   ├── site/
│   │   │   ├── build.ts            ← assemble local static site
│   │   │   └── deploy.ts           ← shell out to vercel CLI
│   │   ├── config.ts               ← ~/.mirador/config.json
│   │   └── prompt.ts               ← interactive TTY prompts
│   ├── skill/
│   │   ├── SKILL.md                ← Claude Code skill manifest
│   │   └── README.md
│   ├── themes/                     ← shipped themes
│   │   ├── default/
│   │   ├── deck/
│   │   └── memo/
│   └── templates/
│       ├── site-index.html         ← the user's mirador.app/ home page
│       └── password-gate.html      ← client-side gate boilerplate
├── docs/superpowers/specs/
│   ├── 2026-05-12-mirador-design.md         ← V1
│   └── 2026-05-12-mirador-alpha-design.md   ← THIS DOC
└── README.md
```

### Component boundaries

| Unit | Purpose | Depends on |
|---|---|---|
| `commands/*` | Top-level CLI command handlers, thin orchestrators | flows, site |
| `flows/*` | Stateful interactive conversations | prompt, config, theme |
| `theme/apply` | Pure function: HTML + theme → themed HTML | sanitizer (DOMPurify) |
| `theme/generate` | Calls Anthropic SDK with a reference, returns a theme | Anthropic SDK |
| `theme/store` | Read/write themes on disk | fs |
| `site/build` | Assembles `~/.mirador/site/` from config + docs | fs |
| `site/deploy` | Shells out to `vercel deploy --prod`, parses output | child_process |
| `config` | Read/write `~/.mirador/config.json` | fs |
| `prompt` | TTY input + selectable lists; abstracted so it's testable | enquirer |

Each unit must be understandable on its own: a one-paragraph header in the file explaining what it does, what its public interface is, and what it depends on. Tests for each unit live next to it (`*.test.ts`).

### Data on disk

```
~/.mirador/
├── config.json
│     {
│       "vercel": {
│         "project_id": "...",
│         "project_name": "mirador-danielm",
│         "domain": "mirador-danielm.vercel.app",
│         "org_id": "..."
│       },
│       "default_theme": "default",
│       "docs": [
│         {
│           "slug": "q2-report",
│           "title": "Q2 Status Report",
│           "theme": "memo",
│           "password_protected": true,
│           "visibility": "unlisted",
│           "url": "https://mirador-danielm.vercel.app/d/q2-report/",
│           "created_at": "2026-05-12T15:24:00Z"
│         }
│       ]
│     }
├── site/                          ← what gets deployed to Vercel
│   ├── index.html                 ← list of public docs (if any)
│   ├── d/
│   │   └── q2-report/
│   │       ├── index.html         ← themed user HTML (with gate if password)
│   │       └── original.html      ← user's unmodified HTML, kept for reference
│   └── _mirador/
│       └── assets/                ← shared CSS/JS used by gates and index
├── themes/
│   ├── default/
│   │   ├── meta.json              ← {name, description, tags, generated_from?}
│   │   ├── theme.css
│   │   └── head.html              ← optional <link>/<meta> to prepend
│   ├── deck/
│   ├── memo/
│   └── <user-generated>/
└── logs/
    └── deploys.log                ← appended by site/deploy
```

### How a share runs end-to-end

```
1. CLI: parse `mirador share q2-report.html`
2. config.ensureInitialized()
   └── if no config.json: run flows/init (vercel login + project create)
3. flows/name → ask user for slug, default = filename or <title>
4. flows/theme → ask user:
     - keep default
     - pick from list (3 shipped + user's)
     - generate from reference:
         - paste URL    → fetch HTML/CSS, send to Claude, get theme.css + meta
         - paste image  → vision call to Claude, get theme.css + meta
         - describe     → text-only call to Claude, get theme.css + meta
       → save into ~/.mirador/themes/<name>/, set as choice for this doc
5. flows/password → ask user:
     - none (default)
     - protect → ask for password, hash with PBKDF2, embed gate
6. theme/apply(html, theme) → themed HTML
7. site/build → assembles ~/.mirador/site/ with new doc added
8. site/deploy → `vercel deploy --prod`, captures URL
9. config: persist new doc record
10. print URL + copy to clipboard
```

`mirador list` is a much shorter flow: list docs from config, allow selection to (a) copy URL, (b) open in browser, (c) delete. Delete = remove from `site/d/<slug>/`, redeploy, drop from config.

---

## 6. The Skill & the Slash Command

Mirador exposes itself to Claude Code through **two** surfaces that share the same underlying skill behavior:

- **Skill** (`~/.claude/skills/mirador/SKILL.md`) — Claude decides when to suggest it. Triggered passively after the agent produces HTML in the session.
- **Slash command** (`~/.claude/commands/mirador.md`) — the user explicitly types `/mirador` (optionally with a file path). Triggered actively.

Both delegate to the same conversational flow described below. The slash command is just a deterministic entry point so the user doesn't have to wait for Claude to "notice" the opportunity.

### `/mirador` slash command

```markdown
---
description: Publish an HTML artifact to your Mirador (your own Vercel) and get a shareable link.
---

The user invoked `/mirador $ARGUMENTS`.

If `$ARGUMENTS` is a path to an HTML file, use that file. Otherwise, look back in the
conversation for the most recently produced HTML artifact and offer to publish it
(asking the user to confirm if the choice is ambiguous).

Then drive the Mirador share flow:
1. Ask the user for a name (suggest one from the file's <title> or filename).
2. Ask which theme — list installed themes; offer to generate one from a URL,
   screenshot, or description if they want something custom.
3. Ask whether to password-protect (warn it's a soft client-side gate).
4. Ask visibility (unlisted by default).

Then run:
  mirador share <absolute path> --non-interactive \
    --name <slug> --theme <name> --visibility <unlisted|public> [--password "<pw>"]

Print the resulting URL in chat with a one-line confirmation.
```

### `SKILL.md` description (draft):

> Use this skill when you have just produced an HTML artifact in the session — a report, dashboard, presentation, document, prototype, or mini-app — and the user might want to view or share it. Wraps the `mirador` CLI to publish the file to the user's own Vercel and return a shareable URL. The skill is conversational: it asks the user about name, theme (with the option to generate one from a URL, screenshot, or description), and optional password protection.

### Trigger heuristic

The skill is *offered*, not auto-invoked: when the agent produces an HTML file, it asks the user "want me to publish this and give you a link?" before running the skill. This keeps it from running unsolicited.

### Conversational contract

The skill must guide the user through the share flow **in chat**, not by spawning interactive TTY prompts the user can't see. That means:

- The skill asks "what should we call it?" → user replies in chat → skill calls `mirador share <file> --name <slug> --non-interactive` with the answer.
- Same for theme and password.
- The CLI exposes a `--non-interactive` mode where every flow input can be passed as a flag, used by the skill. The conversational flows run only when a human invokes the CLI directly from a terminal.

This is the one place where the CLI has more flags than the user types. Those flags are the skill's contract, not the user's UX.

---

## 7. Theme from reference

This is the most interesting feature in the alpha. It uses Claude's vision and reasoning to produce a usable CSS theme from whatever the user has at hand.

### Three input modes

1. **URL** — the user pastes a web page they want their doc to look like. The CLI fetches the HTML and any linked CSS files using a plain HTTP client (no JS execution, no headless browser) and passes the raw text to Claude, which produces a single self-contained `theme.css` that captures the typographic, color, and spacing language. Stylesheets that are too dynamic (JS-driven, gated, login-walled) get a graceful fallback to "couldn't fully fetch, here is a best-effort theme based on the visible structure".
2. **Screenshot** — the user attaches an image. The skill sends the image to Claude (vision) with a prompt that asks for the same `theme.css`. Works for designs that aren't crawlable (Figma exports, paper sketches photographed, designs from other tools).
3. **Description** — the user describes in natural language: "calm, navy and beige, generous whitespace, serif headings, sans body". Pure text-to-theme via Claude.

### Output contract

Every theme generated returns:

```
~/.mirador/themes/<name>/
├── meta.json
│     {
│       "name": "boardish",
│       "description": "Inspired by boardroom decks; cool blues, generous whitespace.",
│       "generated_from": { "type": "url"|"image"|"description", "ref": "..." },
│       "created_at": "..."
│     }
├── theme.css         ← scoped under .mirador-content { ... } to avoid conflicts
└── head.html         ← optional, e.g. Google Fonts <link>
```

The CSS is scoped under `.mirador-content { ... }` (we wrap the user's `<body>` content in a `<div class="mirador-content">` at apply time) so the theme never bleeds into our gate UI or the deployed site's index page.

### What's NOT in the alpha

- Multi-page theme variants
- Theme marketplace / sharing across users
- Editing a generated theme through the skill (the user can hand-edit the CSS file; not a guided flow)

---

## 8. Password gate

Client-side only. Invoked from inside the `share` flow (`flows/password`); it is **not** a standalone CLI command. The flow:

1. User provides a password in the share flow.
2. CLI derives a `key = PBKDF2(password, salt, 200_000, sha-256)`. Stores `salt` and `kdf_iter` in the page.
3. CLI encrypts the themed HTML body with AES-GCM using `key`. The ciphertext is embedded in `index.html` as a base64 string. The salt and IV are in plain text.
4. The page's visible content is the gate UI; the encrypted body is *not* rendered until the user enters the password, the key is re-derived in the browser, and the body is decrypted.

Both ends use the same primitive: the CLI uses Node's `crypto.subtle` (`globalThis.crypto.subtle`, available natively on Node 20+); the gate uses `window.crypto.subtle` in the browser. No third-party JS crypto library on either side.

This means: someone viewing the HTML source sees ciphertext, not plaintext. **It's still client-side**, so a determined attacker who watches a real user's browser memory could grab the decrypted content. We disclose this honestly in the skill flow and in the gate page footer ("client-side gate — disuasive, not authentication"). Real auth comes with V1.

The gate boilerplate lives in `alpha/templates/password-gate.html` and is the same for every doc.

---

## 9. Vercel integration

The CLI shells out to the official `vercel` CLI. We require it on PATH and instruct the user to install it during `init` if missing.

### First-run init flow (`flows/init`)

1. Check `vercel --version`. If missing, print install instructions and exit.
2. Check `vercel whoami`. If not logged in, run `vercel login` (interactive in a real terminal; in `--non-interactive` mode, instruct the skill to ask the user to log in manually first).
3. Ask for a project name. Default: `mirador-<username>`.
4. Run `vercel link --yes --name <project-name>` from a temporary directory to create the project.
5. Pull the resulting `.vercel/project.json` into our config.
6. Pick a default theme.
7. Persist `config.json`.

### Deploy

```
vercel deploy ~/.mirador/site --prod --yes --no-clipboard
```

The CLI parses stdout for the deployed URL (Vercel CLI prints `https://...` on success). If parsing fails, we fall back to the project's stable production domain stored in config (e.g. `https://mirador-danielm.vercel.app`), since Vercel always aliases that domain to the latest prod deploy. We then append `/d/<slug>/` to get the final doc URL.

### What if the user doesn't have Vercel?

The init flow detects this and explains:
> "Mirador needs a free Vercel account for the alpha. We don't host anything ourselves yet — your files live in your own account. Sign up at vercel.com, then re-run."

We do not block on Vercel-account creation, we just message and exit.

---

## 10. Distribution

Two install paths, both leading to the same `~/.mirador/` setup:

### One-liner

```
curl -fsSL https://mirador.dev/install.sh | sh
```

`install.sh` is committed in `alpha/install.sh`. It:

1. Requires Node 20+. Fails with a clear message otherwise.
2. Checks that `npm` global installs work without sudo (probes the npm global prefix; if it points under `/usr/local` and isn't user-writable, prints instructions for using `nvm` / `volta` or running with sudo, then exits non-zero). We do *not* silently `sudo`.
3. `npm i -g @mirador/cli`.
4. Runs `mirador skill install` (an internal command, not user-facing) which copies the skill bundle to `~/.claude/skills/mirador/`.
5. Prints next steps.

### npm

```
npm i -g @mirador/cli
mirador skill install   # hidden command, but documented in the README
```

### Uninstall

```
npm uninstall -g @mirador/cli
rm -rf ~/.mirador ~/.claude/skills/mirador
```

We document this in the README. We do *not* ship a `mirador uninstall` command — too rarely used to justify the surface.

---

## 11. Pinned decisions

- **Password = soft (client-side) gate, always.** Vercel Pro detection deferred to v0.2 (post-alpha).
- **Shipped themes:** `default`, `deck`, `memo`. No more in alpha; more come through user-generated themes.
- **Visible commands:** `share`, `list`. Period. No `theme`, no `init`, no `delete` as top-level — they live inside flows.
- **Hidden commands:** `mirador skill install` (called by installer only, documented in README). No others.
- **Skill never auto-runs.** It offers. The agent must ask the user before invoking.
- **AI calls** for theme generation use `claude-sonnet-4-6`; vision is built into Sonnet 4.6, no separate model required.

---

## 12. Success criteria

The alpha is successful when:

1. A first-time user with Node + a Vercel account can run `curl ... | sh` and have a working `mirador` in under 2 minutes.
2. From inside Claude Code, after producing an HTML file, the user can answer 3 conversational questions (name, theme, password) and have a URL in under 60 seconds (excluding Vercel deploy time, which we don't control).
3. Generating a theme from a screenshot of a real website produces a result that visibly resembles the reference for at least 8 of 10 test inputs (judged by the author; we don't ship without this bar).
4. The password gate, with a strong password, resists a 30-minute "view source and try to extract" attempt by a security-aware engineer who has the page but not the password.
5. The repo is public on GitHub with the README quickstart actually working on a fresh macOS and a fresh Ubuntu.

---

## 13. Roadmap

In order:

1. CLI scaffold (`alpha/package.json`, `src/index.ts`, command routing, `--non-interactive` flag).
2. Config module + first-run init flow (no Vercel yet — just config write).
3. Shipped themes (`default`, `deck`, `memo`) committed under `alpha/themes/`.
4. `theme/apply` — pure function with tests.
5. `site/build` — assemble the static site locally; verify by opening files in a browser.
6. Vercel integration (`flows/init` + `site/deploy`).
7. `share` command end-to-end with default theme, no password.
8. `flows/name`, `flows/password` (client-side gate), `flows/theme` (pick from list only).
9. `theme/generate` from URL / image / description.
10. `list` command (view, copy, open, delete).
11. Skill manifest (`SKILL.md`) + `mirador skill install`.
12. Installer (`install.sh`) + README + GIF demo.
13. Make the repo public.

---

## 14. Open questions

- Final installer domain (`mirador.dev`? something else?). Decision before public.
- Whether `list` should let the user re-share an existing doc with a different theme (basically "re-theme"). Tentative: yes, it's one extra branch in the same flow. Treats themes as mutable per-doc.
