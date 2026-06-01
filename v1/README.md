<div align="center">

<img src="https://raw.githubusercontent.com/danielmedinac22/mirador/main/v1/site-assets/assets/lockup-readme.svg" alt="mirador" width="220"/>

<br><br>

**Same artifact. Your lens.**

The medium where many minds converge on one living artifact — each through their own AI, guided toward an owned vision. Git-native CLI + agent shim. The HTML is just a view.

[![npm version](https://img.shields.io/npm/v/mirador-cli?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/mirador-cli)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](https://github.com/danielmedinac22/mirador/blob/main/LICENSE)

<br>

```bash
npm i -g mirador-cli
```

macOS, Linux, Windows. Node 20+. Works with Claude Code, Codex, or Gemini.

<br>

*"My agent read it the way I would. Not the way you wrote it."*

</div>

---

Mirador is the only place where collaboration is **contextual**: one artifact, many private contexts, each reading and refining it through their own AI, converging toward one owned vision. Google-Docs-with-AI has multiplayer editing but no per-person lens; Mirador's whole point is the lens.

## The loop

```bash
mirador new q3-strategy                                  # a markdown++ doc + a vision
mirador vision q3-strategy --set "board-ready, anchored on NRR"
mirador watch q3-strategy                                # live local mirror as your AI drafts
mirador share q3-strategy --with maria@simetrik.com      # repo + onboarding seed → clipboard
```

María pastes the seed into her agent — it installs, clones, reads **her** brain, briefs her, leaves her refining. She pushes a change with an auto-drafted intent note; you `mirador open` and get a brief shaped by **your** context, not a raw diff. Same change, two brains, two visibly different briefs — that's the product.

## Commands

`new` · `preview` · `refine` · `push --intent` · `open` · `handoff` · `diff` · `vision` · `status` · `watch` · `share` · `comment` · `brain` · `upgrade`

## How it's built

- **Brain = your agent's living memory** — no wizard, no store; strictly private; never enters git or a handoff packet.
- **markdown++ document** behind a format seam; HTML is a render. Section-level merge; same-section conflicts route to the owner.
- **Model-agnostic, CLI-first.** Deterministic engine (no LLM calls) + a thin per-agent shim; manual mode is the floor.
- **No Mirador servers.** Your repos on GitHub, your view on your Vercel. The cockpit is a local read-only mirror.

Publish-era user? `mirador upgrade` keeps your published docs as broadcast HTML; new artifacts are markdown++.

---

**Full story, themes, and the two-brain demo:** [github.com/danielmedinac22/mirador](https://github.com/danielmedinac22/mirador#readme) · MIT.
