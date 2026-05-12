<div align="center">

# MIRADOR

**A place to share AI-generated HTML.**

**A Claude Code skill + CLI that turns any HTML your agent produces into a shareable link — published to your own Vercel, in under a minute.**

[![npm version](https://img.shields.io/npm/v/mirador-cli?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/mirador-cli)
[![npm downloads](https://img.shields.io/npm/dm/mirador-cli?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/mirador-cli)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<br>

```bash
npm i -g mirador-cli
```

**Works on macOS, Linux, and Windows. Requires Node 20+ and the Vercel CLI.**

<br>

*"My agent made the report. Mirador made the link."*

</div>

---

> [!IMPORTANT]
> **Status: public alpha.**
>
> The CLI and skill work today. The V1 managed runtime (multiplayer, hosted, real auth) is designed but not built — see [`docs/superpowers/specs/2026-05-12-mirador-design.md`](docs/superpowers/specs/2026-05-12-mirador-design.md). Expect rough edges; please file issues.

---

## Why Mirador

Your AI agent is great at producing HTML — reports, dashboards, decks, prototypes, one-off mini-apps. Sharing that HTML is annoying: zip it, upload it somewhere, fight with a static host, paste a URL.

Mirador removes the loop. You type `/mirador` (or your agent suggests it once it notices the HTML), answer three or four chat questions, and 15–30 seconds later you have a link. There's no Mirador server in the loop: your file deploys to **your own Vercel** account, on a project you control.

The complexity lives in the skill — theming, optional client-side password gate, Vercel orchestration. What you see is one command.

---

## How It Works

Four steps. The first three happen once.

### 1. Install

```bash
npm i -g mirador-cli
```

Or via the install script:

```bash
curl -fsSL https://mirador.dev/install.sh | sh
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

You can also skip `/mirador` entirely and just say *"publish that as a Mirador link"* — the skill triggers itself once Claude notices you've made HTML.

### 4. Share

```
Published. https://mirador-<you>.vercel.app/d/q2-report/
```

That's it. The URL lives on your Vercel project. You own it; you can take it down anytime from your Vercel dashboard.

---

## Themes

Four built in:

| Theme | What it's for |
|-------|---------------|
| `default` | Neutral, works for most pages |
| `memo` | Serif, document-style — reports, write-ups, long-form |
| `deck` | Presentation, dark — slide-like content |
| `none` | Publish verbatim, no wrapping |

You can also ask for a **custom theme generated from a reference** during the share flow:

- **URL** — *"make it look like vercel.com"*
- **Screenshot** — attach an image
- **Description** — *"warm earth tones, serif headings, generous whitespace"*

Your agent's own model writes the CSS. Generated themes save to `~/.mirador/themes/<name>/` so you can reuse them.

---

## Password Protection

Mirador can encrypt a page so visitors need a password to view it. **Read this before you trust it with anything sensitive.**

The encryption is **client-side only**: AES-GCM with PBKDF2 (200,000 iterations). The user's password derives the key in the browser at view time. A view-source attacker only sees ciphertext.

But it is **not real authentication**. Anyone who has the page can run unlimited offline password guesses, and someone watching a logged-in user's browser can grab the decrypted content. Treat it as a deterrent for casual viewing — not as protection for confidential data.

For real auth, wait for V1, or use Vercel Pro's project-level password protection.

---

## What's In This Repo

| Path | What's in it |
|------|--------------|
| [`alpha/`](alpha/) | The public alpha — CLI, skill, themes. See [`alpha/README.md`](alpha/README.md) for the deep dive. |
| [`docs/superpowers/specs/2026-05-12-mirador-alpha-design.md`](docs/superpowers/specs/2026-05-12-mirador-alpha-design.md) | Alpha design spec (skill-only, BYO Vercel) |
| [`docs/superpowers/specs/2026-05-12-mirador-design.md`](docs/superpowers/specs/2026-05-12-mirador-design.md) | V1 design spec (managed runtime, multiplayer) |
| [`docs/superpowers/plans/2026-05-12-mirador-alpha.md`](docs/superpowers/plans/2026-05-12-mirador-alpha.md) | Alpha implementation plan |

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

**Your agent made the artifact. Mirador makes the link.**

</div>
