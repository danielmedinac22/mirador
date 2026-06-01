# Mirador V1 — the two-machine, two-brain demo (runbook)

**Purpose:** the manual confirmation of the §2 success criteria that can't be unit-tested — *two collaborators with different brains open the same changed artifact and get visibly different briefs, and the difference is the brain* (design §17.1). Everything else (the convergence loop, packet assembly, state) is covered by the 127-test suite; this is the live payoff.

**You need:** two machines (or two user accounts), each with a different agent + its own memory — e.g. **A** = Daniel on Claude Code, **B** = María on Codex (or Gemini). Both with `gh` authed. The reproducible no-setup version is `npm run demo:two-brains` (deterministic stand-in); this runbook is the real thing.

> Reproducible preview first: `cd v1 && npm run demo:two-brains` — same packet, two brains, two different briefs. Then run the live version below.

---

## Machine A — owner (Daniel · Claude Code)

```bash
npm i -g mirador-cli          # or: cd v1 && npm run build && node dist/index.js …
mirador init                  # no brain wizard — it detects Claude memory + confirms
mirador new q3-strategy       # scaffolds markdown++ source.md + a vision placeholder
mirador vision q3-strategy --set "board-ready Q3 narrative anchored on NRR"
mirador watch q3-strategy &   # live cockpit (read-only mirror) — watch it morph as you draft
# … draft the artifact through Claude (refine §Summary, §Timeline, §Retention) …
mirador share q3-strategy --with maria@simetrik.com   # repo + onboarding seed on the clipboard
```

Send María the seed (Slack/email — it's the `@mirador-invitation` block).

**Check:** `mirador brain` shows *Claude Code memory* as the source (read-only). `mirador status q3-strategy` shows the sections open.

---

## Machine B — collaborator (María · Codex or Gemini)

1. **Paste the `@mirador-invitation` block into her agent.** With the shim installed (`mirador shim install` runs in `init`, or the agent installs it), the agent **onboards her to refine, zero manual setup**:
   - installs `mirador-cli` if missing → `git clone <repo>` → `mirador open q3-strategy`.
2. The CLI prints the **handoff packet**; her agent reframes it **through her brain** (CFO lens) into a one-screen brief — *different from what Daniel would see*.
3. She refines from her lens (e.g. tightens §Retention with the real NRR figure), and her agent pushes:
   ```bash
   mirador push q3-strategy --intent "Backed the retention claim with the Q2 NRR figure." --move tighten
   ```
   (The `--move` is inferred + supplied by the shim; she never types it.)

**Lighter rungs (no clone):** T0 — open the read-only URL. T1 — `mirador comment q3-strategy --text "…"` (or her agent composes the `@mirador-response`); paste it back to Daniel.

---

## Machine A — pull and converge

```bash
git -C ~/.mirador/shared/q3-strategy pull        # or the cockpit's fetch loop surfaces it
mirador open q3-strategy                          # handoff: vector brief — "María moved us toward
                                                  #   the vision; from your lens, §3 now needs X"
mirador status q3-strategy                        # §retention now contested/locked; §1/§4 lockable
```

- The cockpit (`mirador watch`) updates and **surfaces María's brief in-view**.
- Daniel arbitrates a same-section conflict if any (owner-gated); endorses to lock.

---

## What to look for (the success criteria, design §17)

| # | Look for | Slice |
|---|---|---|
| 1 | **Two different briefs from the same change** — Daniel's (eng-manager lens) vs María's (CFO lens), and the difference is *the brain* | CV-03 |
| 2 | The intent note rode the commit; the merge was by section; Daniel's brief is a **vector** (toward the vision) | CV-02 / CV-04 |
| 3 | The cockpit mirrored the HTML live, then surfaced the pulled brief | CV-05 |
| 4 | `mirador status` shows locked/contested/open correctly | CV-04 |
| 5 | María reached *refining* from a paste with **zero manual setup** | CV-07 |
| 6 | The same loop ran in Claude **and** Codex/Gemini via its shim; manual mode (`mirador handoff`) is a usable floor | CV-06 |
| 7 | A publish-era machine `mirador upgrade` keeps old docs as broadcast HTML; new ones are markdown++ | CV-08 |
| 8 | **Privacy:** no brain content ever entered git or a packet (only the pointer) | CV-01 / CV-03 |

If #1 lands — two real brains, two visibly different briefs — the wedge is proven.
