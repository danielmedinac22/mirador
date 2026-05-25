# Mirador — Voice Spec

Confident with a wink. English-only. Active voice. No filler.

## Rules

| Rule | Yes | No |
|---|---|---|
| Cadence | "Open it. Read it. Share it." | "You can open it, then read it, then share it with others." |
| Subject active | "Daniel sent you q2-report." | "q2-report has been shared with you by Daniel." |
| Present tense | "Mirador makes the link." | "Mirador will create a link." |
| No filler | "Open in Claude Code" | "Click here to open in Claude Code" |
| No fake enthusiasm | "Published." | "Successfully published! 🎉" |
| Mono for data | "slug `q2-report` · theme `memo`" | "Slug: q2-report, Theme: memo" |
| One-line errors, no apology | "GitHub auth missing. Run `gh auth login`." | "Sorry! It looks like you might not be authenticated…" |
| Terminal states active | "Link copied." | "The link has been copied to your clipboard." |
| One personality beat per touchpoint | Tagline witty. Rest plain. | Witty everywhere → exhausting. |
| Product name lowercase | "Open in Claude Code. Or just use `mirador`." | "Open in Claude Code. Or just use Mirador." |
| Exception: start of sentence + wordmark | "Mirador makes the link." | "mirador makes the link." (mid-sentence) |

## Prohibited

- Decorative emoji (✨ 🚀 ⚡ ✅)
- "Effortlessly", "Seamlessly", "Empower"
- Em-dashes in marketing copy (allowed in docs)
- "Get started in seconds"
- Trailing "and more" / "and so much more"
- Affective personification ("Mirador helps you", "Mirador loves your artifacts")

## Canonical samples

These are the touchstones. Every new string should sound like one of these.

```
Daniel sent you q2-report.

He wants your eyes on it. Open in Claude Code.

Copied. Paste it in.

Locked.

Live at https://mirador-danielm.vercel.app/d/q2-report/

Vercel auth missing. Run `vercel login`.

Nothing here yet.

Ready. Try `mirador new <slug>`.

What's this? mirador.dev.
```

## Application matrix

| Touchpoint | Before (alpha) | After (V1) |
|---|---|---|
| Landing hero | "Daniel shared 'q2-report' with you" | "Daniel sent you q2-report." |
| Landing sub | "Role expected: reviewer" | "He wants your eyes on it. Open in Claude Code." |
| Landing CTA primary | "Open in Claude Code" | "Open in Claude Code" |
| Landing CTA secondary | "Just view it (read-only)" | "Or just read it." |
| Landing footer | "What is Mirador? Visit mirador.dev." | "What's this? mirador.dev." |
| Gate H1 | "Password required" | "Locked." |
| Gate sub | "Client-side gate — deters casual viewing; not authentication." | "Client-side gate. Deters viewers, not attackers." |
| Site index empty | "No artifacts yet." | "Nothing here yet." |
| CLI init outro | "Mirador ready. Try `mirador-v1 new <slug>`." | "Ready. Try `mirador new <slug>`." |
| CLI share success | "Published. https://..." | "Live at https://..." |
| Error (no Vercel auth) | "Error: not logged in to Vercel" | "Vercel auth missing. Run `vercel login`." |

## When in doubt

Read the sentence aloud. If it sounds like marketing, rewrite. If it sounds like a person told another person, keep.
