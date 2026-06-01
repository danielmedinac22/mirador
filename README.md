<div align="center">

<img src="v1/site-assets/assets/lockup-readme.svg" alt="mirador" width="220"/>

<br><br>

**Same artifact. Your lens.**

The medium where many minds converge on one living artifact — each through their own AI, guided toward an owned vision. Git-native CLI + agent shim. The HTML is just a view.

[![npm version](https://img.shields.io/npm/v/mirador-cli?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/mirador-cli)
[![npm downloads](https://img.shields.io/npm/dm/mirador-cli?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/mirador-cli)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<br>

```bash
npm i -g mirador-cli
```

macOS, Linux, Windows. Node 20+. Works with Claude Code, Codex, or Gemini.

<br>

*"My agent read it the way I would. Not the way you wrote it."*

</div>

---

> [!IMPORTANT]
> **Status: V1 — the convergence era.**
>
> Mirador was an HTML publisher. Internal use showed it "felt like an HTML generator with extra steps," and "solo even when shared." So it was redefined: the artifact is now a **document many people refine** — each through their own AI — converging toward a vision. Publish-era users keep everything (`mirador upgrade`). Design + per-slice build plans live in [`docs/superpowers/`](docs/superpowers/). Bugs → [GitHub issues](https://github.com/danielmedinac22/mirador/issues).

---

## The idea

Google-Docs-with-AI has multiplayer editing but no per-person lens. Notion sees the shared workspace, not *your* private context. Mirador is the only tool where collaboration is **contextual**: one artifact, many private contexts, each reading and refining it through their own AI, converging toward one owned vision.

A *mirador* is a lookout. What you see depends on where you stand and the eyes you bring. The artifact is the landscape; your context is your eyes; the vision is the horizon you walk toward together.

---

## What the loop looks like

**Daniel (machine A, Claude Code)** drafts and shares:

```bash
mirador new q3-strategy        # a markdown++ doc + a one-line vision placeholder
mirador vision q3-strategy --set "board-ready Q3 narrative anchored on NRR"
mirador watch q3-strategy      # live local mirror — watch the HTML morph as your AI drafts
mirador share q3-strategy --with maria@simetrik.com   # private repo + an onboarding seed → clipboard
```

**María (machine B, Codex)** pastes the `@mirador-invitation` block into her agent. It onboards her with **zero manual setup** — installs the CLI if missing, clones, reads *her* brain, briefs her, and leaves her refining. She tightens §Retention; her agent auto-drafts the *why* and pushes:

```bash
mirador push q3-strategy --intent "Backed the retention claim with the Q2 NRR figure."
```

**Daniel pulls** — and gets a brief shaped by *his* context, not a raw diff:

```
$ mirador open q3-strategy

q3-strategy  ·  handoff  ·  since 15f00e7
vision: board-ready Q3 narrative anchored on NRR

CHANGED SECTIONS
  §retention  Retention  —  modified

INTENT NOTES
  e946ed9  maria: Backed the retention claim with the Q2 NRR figure.
```

His agent reframes that packet through his own memory into a one-screen brief — *what changed → why it matters to him → how it moves toward the vision → what to refine next*. **María's agent and his agent produce visibly different briefs from the same change — because the brains are different.** That difference is the product.

```
$ mirador status q3-strategy

q3-strategy   ·   vision: board-ready Q3 narrative anchored on NRR   ·   owner: daniel
  LOCKED     §1 Summary   §4 Risks
  CONTESTED  §3 Retention (1 open challenge)
  OPEN       §2 Timeline   §5 Appendix
```

That's the loop: refine through your own AI, every change carries its intent, each reader gets a brief in their own context, the owner steers toward the vision. Async over git — no servers, no realtime channel between users.

---

## The multi-agent flow

You don't actually type those commands. **You talk to your agent** — Claude Code, Codex, or Gemini — and a thin per-agent **shim** turns the conversation into `mirador` calls. The CLI is a deterministic engine (no model inside it); each agent brings the lens and the hands. Same artifact, same protocol, whichever agent each collaborator brings.

```
                  one artifact · markdown++ in git
           vision: "board-ready Q3, anchored on NRR"
      ┌─────────────────────┼─────────────────────┐
  Claude Code             Codex                 Gemini
   (Daniel)              (María)               (Sofía)
   SKILL.md             AGENTS.md             GEMINI.md     ← thin shims · one contract
      └─────────────────────┼─────────────────────┘
                    mirador CLI · one engine
         parse · render · diff · merge · handoff · status
```

What it feels like — nobody types a command:

> **María → Codex:** *"Daniel shared q3-strategy. Get me in."*
> *Codex, silently:* installs `mirador-cli`, clones the repo, runs `mirador open`, reads **María's** memory.
> **Codex → María:** *"You're in. He's anchoring the Q3 board narrative on NRR, and §Retention is hand-wavy — that's your area. Tighten it?"*
> **María → Codex:** *"Yes. Q2 NRR was 112%; cite the board deck."*
> *Codex, silently:* edits §Retention, then `mirador push --intent "Backed the retention claim with the Q2 NRR figure (112%)." --move tighten`.

Daniel, on a different agent, pulls:

> **Daniel → Claude Code:** *"Anything new on q3-strategy?"*
> *Claude, silently:* `mirador open`, reads **Daniel's** memory.
> **Claude → Daniel:** *"María backed the NRR claim with the Q2 figure — it de-risks the board number and moves us toward the vision. §3 still has one open challenge. Next: lock §Retention · check §Timeline still matches the date."*

Same change, two agents, two brains — and **the briefs differ because the brains differ, not because the agents do.** What crosses between them is plain text: git commits, intent notes (`.mirador/intents/<sha>.md`), and paste-able `@mirador-*` seeds. No agent ever talks to another agent; they converge through git.

| Agent | Reads as your brain | Shim it installs |
|---|---|---|
| Claude Code | auto-memory + project `CLAUDE.md` | `~/.claude/skills/mirador/SKILL.md` |
| Codex | `AGENTS.md` | `~/.codex/skills/mirador/AGENTS.md` |
| Gemini | `GEMINI.md` | `~/.gemini/skills/mirador/GEMINI.md` |
| anything else | `AGENTS.md` / `CLAUDE.md` convention | manual mode |

**No supported agent? The CLI is the floor.** `mirador handoff` prints the same packet and `mirador push --intent` records the same note — the whole loop by copy-paste.

---

## Why it's built this way

- **Brain = your agent's living memory.** No wizard, no separate store. Mirador reads what your agent already maintains (Claude memory, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`). It's strictly private — **it never enters git or a handoff packet**, only its *effects* (your refinements, your intent notes) are shared.
- **The artifact is a document, not a page.** markdown++ (stable section anchors + fenced `chart`/`table`/`callout`) behind a format seam; HTML is a render target. Two people editing different sections merge cleanly; same section routes to the owner.
- **The collaboration intelligence is invisible.** No roles to declare, no vocabulary to learn. The agent shim infers everything. *Having mirador makes you collaborate better without learning a system.*
- **Model-agnostic, CLI-first.** The CLI is a deterministic engine (no LLM calls); each agent gets a thin shim; manual mode (`mirador handoff` + `mirador push --intent`) is a clean floor for any agent.
- **No Mirador servers.** Your repos on GitHub, your view on your Vercel. Zero hosting cost. The live cockpit is a local read-only mirror, not a hosted frontend.

---

## Setup

```bash
npm i -g mirador-cli
mirador init        # detects your agent's memory as your brain — no brain wizard
```

`init` confirms your brain source, creates your workspace + Vercel project, and installs the shim for your agent (`mirador shim install --agent claude|codex|gemini` to add others).

---

## The command surface

| Command | What it does |
|---|---|
| `mirador new <slug>` | Scaffold a markdown++ artifact + a vision placeholder |
| `mirador preview <slug>` | Render the themed HTML view of the source |
| `mirador refine <slug>` | Open the artifact for refinement through your agent |
| `mirador push <slug> --intent "<why>"` | Commit a refinement with an auto-drafted intent note |
| `mirador open <slug>` | Get the brain-shaped handoff for what changed |
| `mirador handoff <slug>` | Emit the raw handoff packet (manual mode) |
| `mirador diff <slug>` | Structured, section-level diff |
| `mirador vision <slug> [--set]` | Show / evolve the vision (owner-gated) |
| `mirador status <slug>` | Convergence state — locked / contested / open |
| `mirador watch <slug>` | Live local cockpit (read-only mirror) |
| `mirador share <slug> --with <email>` | Promote to a shared repo + an onboarding seed |
| `mirador comment <slug> --text "<…>"` | Compose a paste-back comment (no clone) |
| `mirador brain` | Show what Mirador reads as your brain (diagnostic) |
| `mirador upgrade` | Migrate a publish-era install (keeps old docs as broadcast HTML) |

---

## Themes

Five purpose-built renderers — shared design tokens, intrinsic light + dark, voice-aligned chrome. They render the markdown++ source; the visual identity is locked in [`docs/design/spec.md`](docs/design/spec.md).

| Theme | Thesis | For |
|---|---|---|
| `page` | The safe canvas. | General content. The default that doesn't apologize. |
| `memo` | Read with intention. | Reports, write-ups, letters. Drop cap, signature block. |
| `deck` | Slides that scroll. | Presentations. `scroll-snap`, arrow-key nav, counter. |
| `console` | Code is content. | Postmortems, scripts. `$ > #` prompt headings. |
| `atlas` | Numbers earn the spotlight. | Dashboards, data. Tabular figures, KPI cards, sticky tables. |

Plus `none` (publish verbatim).

---

## Password protection

Mirador can encrypt a published view so visitors need a password. **Read this before trusting it with anything sensitive.**

Encryption is **client-side only**: AES-GCM with PBKDF2 (200,000 iterations); the password derives the key in the browser at view time. A view-source attacker sees only ciphertext — but it is **not real authentication**: anyone with the page can run unlimited offline guesses, and someone watching a logged-in browser can grab the decrypted content. Treat it as a deterrent for casual viewing, not protection for confidential data. For real auth, use Vercel Pro's project-level password protection.

---

## What's in this repo

| Path | What's in it |
|---|---|
| [`v1/`](v1/) | The convergence CLI — document/brain seams, refine + two-brain handoff, vision/owner/state, cockpit, per-agent shims, onboarding, migration. Ships on npm as `mirador-cli`. |
| [`alpha/`](alpha/) | The publish-era alpha (absorbed, not deprecated). See [`alpha/README.md`](alpha/README.md). |
| [`docs/design/`](docs/design/) | The design system: tokens, voice spec, locked decisions. |
| [`docs/superpowers/`](docs/superpowers/) | The convergence design + the CV-00…CV-08 build plan and per-slice sub-plans. |

---

## Uninstall

```bash
npm uninstall -g mirador-cli
rm -rf ~/.mirador ~/.claude/skills/mirador ~/.claude/commands/mirador.md \
       ~/.codex/skills/mirador ~/.gemini/skills/mirador
```

---

## License

MIT. See [LICENSE](LICENSE).

---

<div align="center">

**Same artifact. Your lens. Our vision.**

</div>
