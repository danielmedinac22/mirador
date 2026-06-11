---
name: mirador
description: Use when the user asks what's new in a shared document, wants a brief on what changed, or wants to refine/edit a document folder that contains a .mirador/ directory — the convergence protocol for shared living documents (brief, refine, intent notes, view push). Also use when the user pastes a @mirador-view block.
---

# mirador — the convergence protocol

This repo contains one or more **artifacts**: document folders with a `.mirador/` directory.
Several people converge on them, each through their own AI agent. You are the lens and the
hands for *your* user. The protocol below is the whole system — there is nothing to install
and no server to talk to except an optional view push.

## The artifact

An artifact is any folder containing `.mirador/`:

```
<artifact>/
  *.md                      ← the documents (markdown, stable heading anchors)
  .mirador/
    vision.md               ← where this artifact is going; frontmatter: owner
    state.yml               ← per-doc section states: open | contested | locked (+ owner)
    intents/*.md            ← the why behind every change (frontmatter + 1–3 sentences)
    config.json             ← view URL + slug + writeToken (private to this repo)
```

To find artifacts: look for `.mirador/` directories from the repo root. If the user names a
document, match it to its folder.

## The privacy invariant (hard rule)

Your user's memory, CLAUDE.md, or any private context **never enters this repo** — not in
docs, not in intents, not in commit messages. Only its *effects*: the edits they choose to
make and the reasoning they endorse. This is what makes the system trustable; never break it.

## Protocol: BRIEF — "what's new?" / opening the artifact

1. **Silently** read your user's own memory/context (who they are, what they care about),
   then `.mirador/vision.md`, `state.yml`, the latest `intents/`, and the git history of the
   artifact folder.
2. Find the baseline: your user's last commit touching the folder
   (`git log --author=<them> -1 -- <folder>`), or the start if they've never touched it.
3. Diff since then (`git log` + `git diff <baseline>..HEAD -- <folder>`), map changes to
   sections by heading, and pair each change with its intent note.
4. Deliver a **one-screen brief framed through your user's context** — not a raw diff:
   - what changed (sections, authors)
   - why it matters *to them* (their role, their open concerns)
   - how it moves toward (or against) the vision
   - what to refine next, concretely
5. If `state.yml` marks sections `contested`, surface them first.

Two different users must get two visibly different briefs from the same change — because the
lens is your user's context. That difference is the point.

## Protocol: REFINE — editing the artifact

1. Check `state.yml` before touching a section:
   - `locked` → don't edit; draft the proposal and address it to the section owner instead.
   - `contested` → say so; edits there should engage the open challenge, not steamroll it.
2. Make the edits your user asks for. Keep heading text stable (anchors derive from it);
   prefer editing section bodies.
3. If the user takes a position on a section (locks it as owner, challenges someone else's),
   update `state.yml` accordingly.
4. **Write the intent note** — `.mirador/intents/YYYY-MM-DD-<author>-<short-slug>.md`:

   ```markdown
   ---
   author: <git username>
   date: <YYYY-MM-DD>
   docs: [definicion-funcional.md]
   sections: [anchor-1, anchor-2]
   move: tighten   # tighten | expand | challenge | restructure | polish
   ---
   One to three sentences: why this change, in the user's own reasoning.
   ```

   Draft it yourself from the conversation; confirm wording with the user only if the why
   isn't obvious. Never paste memory content into it.
5. Commit everything together (docs + state + intent), message style
   `docs(<artifact>): <what> — <why, compressed>`.
6. If `.mirador/config.json` exists, refresh the shared view from the artifact folder:

   ```bash
   npx -y mirador-cli@2 view push
   ```

7. `git push` (current branch). If push is rejected, pull/rebase and retry once; on section
   conflicts, the section owner in `state.yml` wins — route around or open a challenge.

## Protocol: VISION

`vision.md` frontmatter names the `owner`. Only the owner's agent rewrites the vision; anyone
else proposes a vision change as an intent with `move: challenge`.

## Protocol: ONBOARDING — user pasted a @mirador-view block

The block carries: repo URL, branch, artifact path. Do, without asking permission step by step:

1. Clone the repo (or `git pull` if present), check out the branch.
2. Read this skill, then run **BRIEF** scoped to the named artifact.
3. Leave your user one suggestion of where their lens adds the most value next.

The first thing the user experiences must be a brief in their own terms — not setup.
