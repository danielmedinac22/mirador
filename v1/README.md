# Mirador v1 (in development)

This folder is the implementation of **Mirador v1** — the first stable, multiplayer release of Mirador. It runs in parallel with [`alpha/`](../alpha/) until consolidation.

> **Status:** scaffold only. No commands implemented yet.

## Design source of truth

[`docs/superpowers/specs/2026-05-21-mirador-v2-design.md`](../docs/superpowers/specs/2026-05-21-mirador-v2-design.md)

(Spec is titled "Mirador v2" — second design iteration. The shipped product is **v1** because alpha is not a real version.)

## What this folder will contain

Per the spec's §15 vertical slices:

| Slice | Scope |
|---|---|
| VS-01 | `mirador init` v1 (workspace repo + brain scaffold) |
| VS-02 | `mirador new` + `mirador open` (workspace-local, brain-aware first turn) |
| VS-03 | `mirador share` (workspace → shared repo + invite) |
| VS-04 | Static preview + landing page generation (reuses alpha render pipeline) |
| VS-05 | Prompt-seed protocol + skill trigger |
| VS-06 | `mirador request` + `accept` + `decline` |
| VS-07 | `mirador inbox` (computed view, Mode A / Mode B) |
| VS-08 | Brain lifecycle (init seed, on-demand access, agent-proposed updates) |
| VS-09 | Role override |
| VS-10 | `mirador upgrade` (alpha → v1 migration) |

## How `v1/` relates to `alpha/`

- `alpha/`: published as `mirador-cli` on npm. Frozen against new features. Receives only bug fixes.
- `v1/`: develops the full v1 surface. When VS-10 lands and v1 is feature-complete, we consolidate: `alpha/` is archived, `v1/` is renamed to `cli/` (or merged into a `packages/cli/` workspace) and published as `mirador-cli@1.0.0`.
- The two folders share themes, templates, and the encryption script via copy-now / extract-shared-package-on-consolidation. No premature abstraction.

## Local dev

```bash
cd v1
npm install
npm run build
npm test
```

Binary is `mirador-v1` during development to avoid colliding with a globally installed `mirador-cli@alpha`.
