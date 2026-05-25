# Mirador V1 — Design Spec

> Canonical record of decisions from the design grilling session (2026-05-23/25).
> If a question comes up — "why this color?", "why this font?", "why 5 themes?" —
> the answer lives here. If the answer is missing, add it.

## Identity

| Token | Value | Notes |
|---|---|---|
| Archetype | **A + 10% C** | 90% dev-tool minimalist (Linear, Vercel, Stripe). 10% magic tech (Raycast) for personality beats. |
| Accent color | `#2541B2` Royal Cobalt | Not Linear-indigo, not Stripe-navy. Deep blue tied to collaboration. |
| Accent gradient | `linear-gradient(135deg, #2541B2 0%, #4F7DF3 100%)` | CTAs only. Not for body text or borders. |
| Focus ring | `0 0 0 3px rgba(79, 125, 243, 0.35)` | Same cobalt family. Constant across all themes. |
| Background light | `#fafafa` chrome / `#ffffff` content | Off-white for chrome, pure white for artifact content. |
| Background dark | `#0a0a0a` near-black | Not pure `#000` (too harsh). |
| Text primary light | `#0a0a0a` | Near-black. |
| Text primary dark | `#fafafa` | Off-white. |
| Text muted | `#666` light / `#999` dark | One step down only. |
| Borders | `#e5e5e5` light / `#1f1f1f` dark | Subtle. |

## Typography

| Slot | Font | Source | Weights |
|---|---|---|---|
| UI / chrome | **IBM Plex Sans** | Self-hosted WOFF2 (latin subset) | 400, 500, 600 |
| Mono (seeds, slugs, code) | **IBM Plex Mono** | Self-hosted WOFF2 | 400, 500 |
| Editorial (memo theme only) | **IBM Plex Serif** | Self-hosted WOFF2 | 400, 600 |
| Console theme code | **JetBrains Mono** | Self-hosted WOFF2 | 400, 500 |
| Memo theme body alternative | **Newsreader** | Self-hosted WOFF2 (italic + roman) | 400, 600 italic |

Rationale: Plex is one family across sans/mono/serif → coherence from CLI to memo. Not Vercel-derivative. Free, Apache 2.0.

### Type scale (chrome only — themes define their own)

```
xs    0.75rem    12px
sm    0.8125rem  13px   (seeds, captions)
base  0.9375rem  15px   (body)
md    1rem       16px   (lift body in dense surfaces)
lg    1.25rem    20px
xl    1.5rem     24px
2xl   2rem       32px   (H1)
3xl   2.5rem     40px
4xl   clamp(2.5rem, 5vw, 4rem)  (display hero)
```

Line-height: `1.5` body, `1.25` headings, `1.6` long-form prose.

Tracking:
- Display: `-0.02em`
- H1: `-0.015em`
- Wordmark: `-0.04em`
- Body: `0`

## The mark

### Aperture (the symbol)

```
┌─────────┐
│         │
│      ▪  │   ← inner square cobalt #2541B2
│         │
└─────────┘
   outer outline 1.5px stroke
```

- Outer: square, 24×24 grid units, 1.5px stroke
- Inner: 6×6 unit square, cobalt fill
- Inner position: top-right with 4-unit margin (~phi proportion from edges)
- Light mode: outer stroke `#0a0a0a`
- Dark mode: outer stroke `#fafafa`
- Inner: always cobalt — never changes

### Wordmark

```
mirador.
```

- IBM Plex Sans Semibold (600)
- Lowercase, always
- Tracking `-0.04em`
- Dot on `i` is painted cobalt `#2541B2`
- Standalone usage appends a period `mirador.` (the "magic C" signature)

### Lockups

| Use | Composition |
|---|---|
| Horizontal primary | `[aperture] mirador` (mark + wordmark inline) |
| Stacked | aperture above wordmark |
| Standalone symbol | aperture only (favicon, npm icon) |
| Standalone wordmark | `mirador.` with period |

### Animation variants

| Variant | Behavior | Use |
|---|---|---|
| Static | Inner square fixed top-right | 95% of cases |
| Live (breathing) | Inner pulses opacity 0.7→1.0, 2s, ease-in-out infinite | CLI spinner contexts, hero of future mirador.dev |
| Reveal | Inner slides in from `+8px / -8px` to final position, 280ms `cubic-bezier(.2, .8, .2, 1)` | Landing page first-load |
| Pulse | Inner brightens to `#4F7DF3` and back to `#2541B2`, 320ms | After "Copied" action — the mark **responds** to user actions |

## Voice

Confident with a wink. English-only. Rules in [`voice.md`](./voice.md).

Three iconic samples (canonical):
- "Daniel sent you q2-report."
- "Copied. Paste it in."
- "Locked."

## Themes — system architecture

5 themes ship out of the box. Each declares light + dark variants intrinsically via `prefers-color-scheme`.

```
v1/site-assets/themes/
├── tokens.css          ← shared (spacing, motion, radii, focus ring)
├── reset.css           ← shared modern reset
├── page/
│   ├── theme.css
│   ├── meta.json
│   └── preview.html
├── memo/
├── deck/
├── console/
└── atlas/
```

| Theme | Thesis | Primary font | Light base | Dark base | Distinguishing detail |
|---|---|---|---|---|---|
| `page` | The safe canvas. | IBM Plex Sans | `#ffffff` | `#0a0a0a` | TOC sticky when H2 count ≥ 3 |
| `memo` | The Substack memo. | Newsreader serif + Plex Sans chrome | `#fafaf5` sepia | `#1a1812` warm dark | Drop cap, signature block, footnotes |
| `deck` | Real slides. | Plex Sans Bold | `#fafafa` | `#0a0a0a` | Full-bleed `scroll-snap`, "3 / 12" counter, arrow nav |
| `console` | Code as content. | JetBrains Mono | `#fafafa` | `#0a0a0a` (default) | Prompt-style `$ heading`, line numbers, syntax highlight |
| `atlas` | Data as protagonist. | Plex Sans + tabular nums | `#ffffff` (default) | `#0a0a0a` | Sticky table headers, zebra rows, KPI card primitives |

Shared tokens that all themes respect:
- Spacing scale (4pt base, 11 steps)
- Radii (`0`, `4`, `8`, `12`px)
- Motion (`200ms ease-out` default, `320ms cubic-bezier(.2,.8,.2,1)` for reveals)
- Focus ring (always cobalt — signature crosses themes)

Tokens each theme overrides:
- Type scale + family
- Color palette
- Content max-width
- Border treatment
- Shadow style (none in `console`, dramatic in `deck`, subtle in `page`)

## Touchpoint inventory + priority

| # | Surface | Who sees it | Batch |
|---|---|---|---|
| A | Landing of invite (`/i/<slug>/`, `/r/<slug>/`) | Receiver who does not know Mirador | B2 |
| B | Themed preview (`/d/<slug>/`) | Receiver + author | B2 |
| C | Site index (Vercel project root) | Curious visitor | B2 |
| D | Password gate | Receiver of locked link | B2 |
| E | CLI (init, new, share, inbox, etc.) | Author | B3 |
| F | Prompt-seeds + SKILL.md | Receiver/author in agent | B3 |
| G | README + npm | Prospect before install | B3 (lite) |
| (Future) | mirador.dev | Public web | Out of V1 |

## The wow moment

Landing first-paint choreography (~2s total):

```
T=0ms     Page loads. Pure background.
T=120ms   Aperture outer fades in (opacity 0→1, 200ms ease-out).
T=320ms   Aperture inner cobalt slides in top-right
          (translate +8px/-8px → 0, 280ms cubic-bezier(.2,.8,.2,1)).
T=600ms   Hero copy reveal — masked from below (translateY 8px → 0,
          opacity 0 → 1, 320ms).
T=720ms   Sub copy + CTAs fade in, stagger 40ms apart.
T=900ms   Seed block fades in (opacity 0 → 1, 240ms).
T=1100ms  Themed preview iframe loads below the fold.
```

Click on "Open in Claude Code":
1. Seed text gets highlight-selected with cobalt-soft background, 240ms
2. Button label mutates: "Open in Claude Code" → "Copied. Paste it in."
3. Aperture inner does a **single pulse** (320ms) — the mark responds to user action
4. Cursor returns to default

This pulse is the brand signature. Every interaction → mark responds. Builds muscle memory.

## Tooling stack

| Skill | Role | When invoked |
|---|---|---|
| `frontend-design` | Primary implementation driver | Start of each batch |
| `hallmark` | Anti-AI-slop audit | End of each batch before merge |
| `ui-ux-pro-max` | Reference lookup (palettes, patterns, fonts) | Ad-hoc queries during design |
| `prototype` | Variant exploration | Once at start of B2 (landing variants) |
| `verify` | Live browser check | Before merging B2 |

## Quality bar — how we know it is studio-level

1. **Hallmark audit pass** — anti-AI-slop checklist
2. **Live browser check** — local static server + screenshots reviewed with Daniel
3. **Side-by-side vs references**:
   - Landing vs Vercel design blog hero
   - `memo` vs Stripe Press
   - `deck` vs Pitch / Apple keynote pages
   - `console` vs Warp docs
   - `atlas` vs Linear analytics
4. **Receiver test** — Daniel sends a real share to a Simetrik colleague who does not know Mirador, asks reaction
5. **Performance**:
   - Landing FCP < 1.2s including self-hosted Plex
   - Theme CSS < 12KB minified per theme
   - Zero external JS dependencies

## Out of scope for V1 polish

- Logo elaborated (a geometric mark + wordmark is enough)
- Secondary / tertiary color palette (black + white + cobalt period)
- Aperture-per-theme animation personality (v1.1)
- Landing timeline (depends on inbox state, v1.1)
- Audio/voice cues (wrong context for shared work)
- mirador.dev marketing site (post-V1)
- Theme variants (light/dark toggle) beyond intrinsic `prefers-color-scheme`
- Internationalization beyond English

## Batches

| Batch | Status | Scope | Order |
|---|---|---|---|
| B1 · Foundation | in-progress | tokens, fonts, brand assets, voice spec, copy strings | first — unblocks all |
| B2 · Web surfaces | blocked by B1 | 5 themes + landing + gate + site index | second |
| B3 · CLI + skill + README | blocked by B1 | text-only touchpoints | third |

## Source of truth

This file. Update when decisions change.
