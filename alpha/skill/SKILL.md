---
name: mirador
description: Use after producing an HTML artifact in the session (report, dashboard, presentation, document, prototype, or mini-app) and the user wants to share it. Publishes the file to the user's own Vercel project. Walks the user through name, theme (with optional theme-from-reference generation done by your own model), and password protection, then deploys via `vercel` CLI and prints the URL.
---

# Mirador — share an HTML artifact

You publish HTML to the user's own Vercel project. The user already ran `mirador init`; everything you need is in their local Mirador home.

## When to use

You just produced an HTML artifact (a report, deck, dashboard, document, prototype). **Offer; never auto-run.** Say something like *"Want me to publish this and give you a link?"* and wait for confirmation.

## How the share flow works — follow exactly

### 1. Locate the user's Mirador home

Read the pointer file `~/.mirador-home` if it exists; its contents are an absolute path. Otherwise use `~/.mirador/`. Call this `$ROOT`.

Read `$ROOT/config.json`. If it doesn't exist, tell the user to run `mirador init` from a terminal first, then stop.

### 2. Identify the file

If the slash command provided an argument, use it. Otherwise look back in the current session for the most recently produced HTML file and offer it. Confirm if ambiguous.

### 3. Ask the user, in chat, respecting defaults from `config.json`

- **slug** (`name`): suggest from the file's `<title>` or filename. Validate: lowercase letters, digits, dashes only.
- **theme**: list the themes under `$ROOT/themes/` (each has a `meta.json`). Default is `config.defaults.theme`. Also offer `+ generate from a reference…`.
- **password**:
  - If `config.defaults.password_policy === 'never'`, do not ask.
  - If `'always-ask'`, ask the user yes/no.
  - If `'always-on'`, ask for the password (assume yes).
- **visibility**: default `config.defaults.visibility`. Only ask if you think the user might want to change it.

### 4. If the user wants to generate a theme

Ask them for one of:
- **URL** — fetch the page with `curl -s <url>` (or your equivalent), read any linked CSS, then write a CSS file under 4KB scoped under `.mirador-content { ... }` that visibly captures the typographic and color language.
- **Screenshot/image** — examine the image and write the CSS.
- **Description** — write the CSS from the description.

Save the result to `$ROOT/themes/<theme-name>/`:
- `meta.json`: `{ "name": "<n>", "description": "...", "generated_from": { "type": "url"|"image"|"description", "ref": "..." }, "created_at": "<ISO>" }`
- `theme.css`: the CSS you wrote, scoped under `.mirador-content`
- `head.html`: any `<link>`/`<meta>` tags the theme needs (e.g., Google Fonts). Empty if none.

Then use `<theme-name>` as the chosen theme.

### 5. Apply the theme to the user's HTML

Read the user's HTML. Then construct the themed HTML:

1. If theme name is `none`, skip steps 2–4.
2. Ensure a `<head>` exists; if not, insert one right after `<html>` (or wrap the whole content if there is no `<html>`).
3. Before `</head>`, insert (in order): the contents of `$ROOT/themes/<theme>/head.html`, then `<style data-mirador-theme="<theme>">` + the contents of `$ROOT/themes/<theme>/theme.css` + `</style>`.
4. Wrap the `<body>` content in `<div class="mirador-content"> ... </div>`. If there's no `<body>`, wrap everything between `</head>` and `</html>`.

### 6. If a password was given, wrap with the gate

Write the themed HTML to a temp file. Then run:

```
node $ROOT/scripts/encrypt.mjs \
  --in <temp-themed.html> \
  --out $ROOT/site/d/<slug>/index.html \
  --password "<password>" \
  --template $ROOT/templates/password-gate.html
```

The output is the gate page with ciphertext embedded.

### 7. Otherwise, write the themed HTML directly

```
mkdir -p $ROOT/site/d/<slug>/
write themed HTML → $ROOT/site/d/<slug>/index.html
write original HTML → $ROOT/site/d/<slug>/original.html   (verbatim, no theme)
```

### 8. Rebuild the public index if visibility=public

If the doc is `public`, regenerate `$ROOT/site/index.html` from `$ROOT/templates/site-index.html`:
- Replace `{{empty_or_list}}` with empty string if there's at least one public doc; otherwise "No public docs yet."
- Replace `{{list_html}}` with `<ul><li><a href="/d/<slug>/"><title></a></li>...</ul>` for each public doc in the config.

Otherwise leave the index alone.

### 9. Deploy

Run via shell:

```
vercel deploy --prod $ROOT/site --yes --no-clipboard
```

Capture stdout. The deployed URL is in there (`https://...`). If you can't parse it, use the fallback: `https://<config.vercel.domain>/d/<slug>/`.

### 10. Update the config

Append a doc record to `config.json`'s `docs` array:

```
{
  "slug": "<slug>",
  "title": "<title from <title> tag, or slug>",
  "theme": "<theme-name>",
  "passwordProtected": <bool>,
  "visibility": "<unlisted|public>",
  "url": "<url>",
  "createdAt": "<ISO now>"
}
```

### 11. Log the deploy

Append a line to `$ROOT/logs/deploys.log`: `<ISO now>\t<slug>\t<url>\n`.

### 12. Report

Print the URL to the user in chat with one line of confirmation, e.g.:
> Published. `https://mirador-danielm.vercel.app/d/q2/`

## When things go wrong

- `vercel` not found or `vercel whoami` fails → tell the user to run `mirador config`.
- `$ROOT/config.json` missing → tell the user to run `mirador init`.
- The user wants a feature this flow doesn't cover (multi-player, comments, edit-in-browser) → tell them honestly that the alpha doesn't have it; V1 will.

## Don't

- Don't auto-run on every HTML file you produce — always offer first.
- Don't promise the password gate is real authentication. Tell the user it's a client-side gate, disuasive only.
- Don't invent themes outside `$ROOT/themes/`; the directory is the source of truth.
- Don't keep secrets in `config.json` (passwords are never stored — only `passwordProtected: true`).
