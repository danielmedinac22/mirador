# CV-08 — Migration from the publish-era · sub-plan

**Slice:** CV-08 · **Branch:** `feat/v1-cv-00-document-seam`
**Parent:** [build plan](./2026-06-01-mirador-v1-convergence-build-plan.md) · **Design:** [convergence design](../specs/2026-06-01-mirador-v1-convergence-design.md) §1.4, §16 · **Deps:** CV-00…CV-07
**Status:** ✅ Complete (2026-06-01) — 127 tests pass · lint + tsc clean · bundle builds · `upgrade --dry-run` smoke-tested.

## Goal

A publish-era user runs `mirador upgrade` and keeps their published HTML docs (as broadcast-only artifacts) while new artifacts default to markdown++. No loss.

## Decisions

- **Broadcast continuity is free from CV-00:** a migrated doc keeps its `index.html` and gets **no `source.md`**, so `renderPreview` already routes it through the raw-HTML escape hatch (viewable, not co-refinable). The migration just adds `broadcast_only: true` + the preserved `alpha_url` to `.mirador/legacy.json`. New artifacts get `source.md` (CV-00 scaffold) → markdown++.
- **No brain store** (CV-01): `runUpgrade` no longer creates `workspace/brain/`. Any pre-existing store is **read once** (`harvestOldBrain` → a one-line hint) and then left — the agent's memory is the brain; no parallel store is maintained.
- **Shim install** (CV-06): `runUpgrade` installs the detected agent's shim (generic → Claude, the fullest) + the slash command for Claude.
- **`--dry-run`** prints the plan (now: backup · workspace · migrate-doc broadcast · install-shim · harvest-brain) without changes.
- **shareRegistry / URLs preserved:** upgrade doesn't touch the shareRegistry, and each migrated doc keeps its `alpha_url`; `config.docs` is reset (computed-not-stored) while the artifacts carry their own legacy markers.

## Modules

- **Changes:** `services/upgrade.ts` (broadcast markers, drop brain store, harvest hint, install shim, extended result + plan actions), `commands/upgrade.ts` (outro surfaces shim + harvest; `--dry-run` unchanged shape).

## Acceptance → coverage

| Acceptance (CV-08) | Covered by |
|---|---|
| Published artifacts survive as broadcast HTML; URLs + shareRegistry preserved | `cv08-migration.test.ts` (index.html kept, `broadcast_only`, `alpha_url`) |
| New artifacts post-upgrade are markdown++ by default | `cv08-migration.test.ts` (`createArtifact` → source.md → markdown++ render) |
| Old brain store read once for a harvest hint; no parallel store maintained | `harvestOldBrain` + `cv08-migration.test.ts` |
| `--dry-run` prints the plan without changes | `planUpgrade` + smoke |
| Integration test: publish-era install → upgrade → continuity + new markdown++ | `cv08-migration.test.ts` |

## Out of scope (later)

- Removing the vestigial `config.brain.location` field (schema churn across init/e2e) — left as a harmless vestige; a future config-version bump can drop it.
- Republishing migrated broadcast docs through the new render pipeline — they keep their existing published HTML; re-publish on next `share`.
