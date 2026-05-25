<div align="center">

<img src="v1/site-assets/assets/lockup-readme.svg" alt="mirador" width="220"/>

<br><br>

**Share AI-generated HTML in under a minute.**

A Claude Code skill + CLI that turns any HTML your agent produces into a shareable link — published to your own Vercel.

[![npm version](https://img.shields.io/npm/v/mirador-cli?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/mirador-cli)
[![npm downloads](https://img.shields.io/npm/dm/mirador-cli?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/mirador-cli)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<br>

```bash
npm i -g mirador-cli
```

macOS, Linux, Windows. Node 20+, Vercel CLI required.

<br>

*"My agent made the report. mirador made the link."*

</div>

---

> [!IMPORTANT]
> **Status: V1 public.**
>
> CLI, Claude Code skill, themes, and the collaboration layer (share, request, inbox, brain, dashboard) all ship today. Bugs go to [GitHub issues](https://github.com/danielmedinac22/mirador/issues). Telemetry is minimal — please report what breaks.

---

## What it looks like

After `mirador init` (90 seconds, once), publish from inside Claude Code:

```
> /mirador q2-report.html

slug?       → q2-report
theme?      → memo
password?   → no

Live at https://mirador-yourname.vercel.app/d/q2-report/
```

Share it with a colleague — adds them to the artifact's private GitHub repo and copies an invitation seed to your clipboard:

```
$ mirador share q2-report --with maria@simetrik.com --role reviewer

Shared q2-report to yourname/q2-report.
Invitation seed — paste into Claude Code or send to collaborator:

@mirador-invitation

From: yourname
Artifact: q2-report
Role expected: reviewer
Sent: 2026-05-26T09:14:00Z

Paste this whole block into Claude Code to open.
Read-only: https://mirador-yourname.vercel.app/d/q2-report/
Landing: https://mirador-yourname.vercel.app/i/q2-report/

— mirador.

Live at https://mirador-yourname.vercel.app/i/q2-report/
```

Maria pastes the block into her Claude Code. Her Claude reads the invitation directly — fetches the read-only doc, parses the seed, opens a session with full context. No copy-paste of background, no "let me catch you up." She reviews, then responds with a single block:

```
@mirador-response

From: maria
Re-request: q2-report
Status: accepted
Note: Looks good. Two comments on the timeline.

— mirador.
```

Everything you've published shows up on your dashboard, with one-click invitation links per artifact:

```
$ mirador dashboard

Opening https://mirador-yourname.vercel.app/
```

That's the loop. Three blocks, three commands, your own infrastructure.

---

## Why mirador

Your agent produces HTML. Sharing it manually is the loop that kills momentum — screenshot, paste in Slack, lose hierarchy, lose source. mirador removes that loop in one command: your HTML deploys to **your own Vercel**, your colleagues collaborate via paste-in-chat blocks, nothing touches an external server. The complexity lives in the skill — theming, optional password gate, Vercel orchestration. What you see is one command.

---

## How It Works

Four steps. The first three happen once.

### 1. Install

```bash
npm i -g mirador-cli
```

You also need the Vercel CLI and a free Vercel account:

```bash
npm i -g vercel && vercel login
```

### 2. Set up (~90 seconds)

```bash
mirador init
```

The wizard asks which agents you use (Claude Code is first-class, Codex is best-effort, "Otro / manual" gives you copy-paste instructions), where to store files (`~/.mirador/` by default — point it at iCloud or Dropbox for cross-device sync), creates your Vercel project, and sets defaults for theme, password policy, and visibility.

When it's done you'll have:

- `~/.mirador/` — themes, site shell, scripts, config
- `~/.claude/skills/mirador/SKILL.md` — the Claude Code skill
- `~/.claude/commands/mirador.md` — the `/mirador` slash command

### 3. Publish from your agent

Inside Claude Code, after producing or referencing an HTML file:

```
/mirador q2-report.html
```

Claude asks you, in chat:

```
slug?       → q2-report
theme?      → memo
password?   → no
visibility? → unlisted
```

The skill also auto-activates inside a mirador workspace and when you paste any `@mirador-invitation` / `@mirador-request` / `@mirador-response` block — see [`v1/skill/SKILL.md`](v1/skill/SKILL.md) for the full trigger matrix.

### 4. Share

```
Published. https://mirador-<you>.vercel.app/d/q2-report/
```

That's it. The URL lives on your Vercel project. You own it; you can take it down anytime from your Vercel dashboard.

---

## Themes

Alpha ships four (`default`, `memo`, `deck`, `none`). V1 introduces a redesigned theme system — five purpose-built canvases with shared design tokens, light + dark intrinsic, voice-aligned chrome:

| Theme | Thesis | What it's for |
|---|---|---|
| `page` | The safe canvas. | General-purpose content. The default that does not apologize. |
| `memo` | Long-form, read with intention. | Reports, write-ups, letters. Drop cap, signature block. |
| `deck` | Slides that scroll. | Presentations. `scroll-snap`, arrow-key nav, slide counter. |
| `console` | Code is content. | Postmortems, scripts, CLI dumps. `$ > #` prompt headings. |
| `atlas` | Numbers earn the spotlight. | Dashboards, data. Tabular figures, KPI cards, sticky tables. |

Plus `none` (publish verbatim, no wrapping).

Or ask for a **custom theme generated from a reference** during the share flow:

- **URL** — *"make it look like vercel.com"*
- **Screenshot** — attach an image
- **Description** — *"warm earth tones, serif headings, generous whitespace"*

Your agent's own model writes the CSS. Generated themes save to `~/.mirador/themes/<name>/` so you can reuse them.

---

## Password Protection

Mirador can encrypt a page so visitors need a password to view it. **Read this before you trust it with anything sensitive.**

The encryption is **client-side only**: AES-GCM with PBKDF2 (200,000 iterations). The user's password derives the key in the browser at view time. A view-source attacker only sees ciphertext.

But it is **not real authentication**. Anyone who has the page can run unlimited offline password guesses, and someone watching a logged-in user's browser can grab the decrypted content. Treat it as a deterrent for casual viewing — not as protection for confidential data.

For real auth, use Vercel Pro's project-level password protection. Server-side auth on the mirador surface itself is on the V2 roadmap.

---

## What's In This Repo

| Path | What's in it |
|---|---|
| [`alpha/`](alpha/) | The public alpha — CLI, skill, themes. Ships on npm as `mirador-cli`. See [`alpha/README.md`](alpha/README.md). |
| [`v1/`](v1/) | The current V1 surface — new theme system, brain, share/request/inbox/dashboard, brand chrome. See [`v1/README.md`](v1/README.md). |
| [`docs/design/`](docs/design/) | V1 design system: tokens, voice spec, every locked decision. |

---

## Uninstall

```bash
npm uninstall -g mirador-cli
rm -rf ~/.mirador ~/.claude/skills/mirador ~/.claude/commands/mirador.md ~/.codex/skills/mirador
```

(Drop the `.codex` line if you didn't install for Codex.)

---

## License

MIT. See [LICENSE](LICENSE).

---

<div align="center">

**Your agent made the artifact. mirador makes the link.**

</div>
