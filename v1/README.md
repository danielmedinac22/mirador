# mirador v1 (in development)

The implementation of mirador v1 — the first stable, multiplayer release. Runs in parallel with [`alpha/`](../alpha/) until consolidation.

> **Status:** all 10 vertical slices landed. Design polish (B1·B2·B3) shipped.
> What is missing: end-to-end share against a clean Vercel project, more
> integration tests, mirador.dev marketing site.

## Design

The V1 surface is locked in [`docs/design/spec.md`](../docs/design/spec.md). The voice spec
lives in [`docs/design/voice.md`](../docs/design/voice.md). Both are canonical.

Implementation spec: [`docs/superpowers/specs/2026-05-21-mirador-v2-design.md`](../docs/superpowers/specs/2026-05-21-mirador-v2-design.md).

(The internal codename is "v2" — second design iteration. What ships is V1.)

## What lives in here

| Path | What |
|---|---|
| [`src/`](src/) | The CLI source — commands, services, adapters, shared |
| [`site-assets/`](site-assets/) | The brand chrome that gets installed alongside the Vercel site — tokens, fonts, themes, marks |
| [`skill/`](skill/) | The Claude Code skill (`SKILL.md`) |
| [`scripts/`](scripts/) | Dev tools — design preview server, smoke builder |
| [`tests/`](tests/) | End-to-end suite |

## Themes (V1, new system)

Five canvases with shared tokens, light + dark intrinsic via `prefers-color-scheme`:

| Theme | Thesis |
|---|---|
| `page` | The safe canvas. |
| `memo` | Long-form, read with intention. |
| `deck` | Slides that scroll. |
| `console` | Code is content. |
| `atlas` | Numbers earn the spotlight. |

Plus `none` (publish verbatim).

## Vertical slices

| Slice | Scope | Status |
|---|---|---|
| VS-01 | `mirador init` v1 (workspace repo + brain scaffold) | ✓ |
| VS-02 | `mirador new` + `mirador open` (workspace-local, brain-aware first turn) | ✓ |
| VS-03 | `mirador share` (workspace → shared repo + invite) | ✓ |
| VS-04 | Static preview + landing page generation | ✓ (rebuilt in B2) |
| VS-05 | Prompt-seed protocol + skill trigger | ✓ |
| VS-06 | `mirador request` + `accept` + `decline` | ✓ |
| VS-07 | `mirador inbox` (Mode A / Mode B) | ✓ |
| VS-08 | Brain lifecycle | ✓ |
| VS-09 | Role override | ✓ |
| VS-10 | `mirador upgrade` (alpha → v1 migration) | ✓ |
| B1 | Design foundation (tokens, marks, fonts, voice) | ✓ |
| B2 | Web surfaces (landing wow moment, 5 themes, gate, index) | ✓ |
| B3 | CLI + skill + README voice alignment | ✓ |

## How `v1/` relates to `alpha/`

- `alpha/`: published as `mirador-cli` on npm. Frozen against new features. Receives only bug fixes.
- `v1/`: when consolidation happens, `alpha/` is archived, `v1/` becomes `cli/` and publishes as `mirador-cli@1.0.0`.
- The two share themes (legacy) and templates via copy-now. No premature abstraction.

## Local dev

```bash
cd v1
npm install
npm run build
npm test
```

Binary is `mirador-v1` during dev to avoid colliding with globally-installed `mirador-cli@alpha`.

## Design preview (local)

To eyeball the V1 chrome + 5 themes + landing wow moment:

```bash
node scripts/smoke-design.mjs        # builds /tmp/mirador-design-preview/
node scripts/serve-design.mjs        # starts http://127.0.0.1:7100/
open http://127.0.0.1:7100/i/q2-letter/   # the landing
```
