# Mirador Alpha

Publish AI-generated HTML to your own Vercel project. One setup command; everything else happens inside your AI agent.

> **Status:** alpha. Skill-only product, no managed runtime yet. The V1 SaaS lives in [its own spec](../docs/superpowers/specs/2026-05-12-mirador-design.md).

## What Mirador is

Mirador is a **Claude Code skill + slash command** (with best-effort Codex support) that turns any HTML file your agent produces into a shareable link in under a minute. There's no Mirador server: your HTML deploys to **your own Vercel** account.

After the first-time setup, you live inside your agent. You type `/mirador` (or wait for your agent to suggest publishing) and answer three or four chat questions — name, theme, password, visibility. Your agent does the rest: applies the theme, optionally encrypts for the password gate, and runs `vercel deploy` for you.

## Install

```
curl -fsSL https://mirador.dev/install.sh | sh
```

or via npm:

```
npm i -g mirador-cli
```

Requires **Node 20+** and the **Vercel CLI** (`npm i -g vercel`) plus a free Vercel account.

## Setup (≈ 90 seconds)

```
mirador init
```

The wizard walks you through:

1. **Which agents do you use?** Multi-select. Claude Code is first-class; Codex is best-effort; "Otro / manual" gives you copy-paste instructions.
2. **Where to store your files?** Default `~/.mirador/`. Pick a path inside iCloud Drive or Dropbox if you want cross-device sync.
3. **Vercel** — checks you're logged in (runs `vercel login` if not), asks for a project name, creates the project on your Vercel.
4. **Default theme** — `default`, `memo`, `deck`, or `none`.
5. **Password default policy** — always-ask, never, or always-on.
6. **Visibility default** — `unlisted` (link-only) or `public`.

When it's done, you'll have:

- `~/.mirador/` with your themes, site, scripts, and config
- `~/.claude/skills/mirador/SKILL.md` (Claude Code skill)
- `~/.claude/commands/mirador.md` (the `/mirador` slash command)

## Use it

In Claude Code, after producing or referencing an HTML file:

```
/mirador q2-report.html
```

Claude will ask you (in chat):

```
slug? → q2-report
theme? → memo
password? → no
visibility? → unlisted
```

15–30 seconds later you get a URL:

```
Published. https://mirador-danielm.vercel.app/d/q2-report/
```

You can also skip `/mirador` and just say *"publish that as a Mirador link"* — the skill triggers itself once Claude notices you've made HTML.

## Themes

Three shipped: `default` (neutral), `memo` (serif/document), `deck` (presentation/dark). Plus `none` (publish verbatim, no wrapping).

You can ask for a **custom theme generated from a reference** during the share flow:
- **URL**: "make it look like vercel.com"
- **Screenshot**: attach an image
- **Description**: "warm earth tones, serif headings, generous whitespace"

Your agent's own model writes the CSS. Generated themes save to `~/.mirador/themes/<name>/` for reuse.

## Security — read this if you use the password gate

The password protection is **client-side only**. We use AES-GCM with PBKDF2 (200,000 iterations) to encrypt the page content; the user's password derives the key in the browser to decrypt at view time. View-source attackers see only ciphertext.

**But it is not real authentication.** Anyone who has the page can run unlimited offline password guesses, and someone watching a logged-in user's browser memory can grab the decrypted content. Treat it as a deterrent for casual viewing — not as protection for confidential data.

For real auth, wait for V1 (or use Vercel Pro's password protection on your project).

## Uninstall

```
npm uninstall -g mirador-cli
rm -rf ~/.mirador ~/.claude/skills/mirador ~/.claude/commands/mirador.md ~/.codex/skills/mirador
```

(Adjust the `.codex` line if you didn't install for Codex.)

## Links

- [Alpha design spec](../docs/superpowers/specs/2026-05-12-mirador-alpha-design.md)
- [Implementation plan](../docs/superpowers/plans/2026-05-12-mirador-alpha.md)
- [V1 (managed runtime) spec](../docs/superpowers/specs/2026-05-12-mirador-design.md)
