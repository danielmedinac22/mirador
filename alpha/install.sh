#!/usr/bin/env bash
set -euo pipefail

require_node20() {
  local v="$(node -v 2>/dev/null || true)"
  [[ -z "$v" ]] && { echo "Node 20+ required. Install from https://nodejs.org/"; exit 1; }
  local major="${v#v}"; major="${major%%.*}"
  if (( major < 20 )); then echo "Node 20+ required (you have $v)."; exit 1; fi
}

require_npm_global_writable() {
  local prefix="$(npm config get prefix)"
  if [[ ! -w "$prefix" ]]; then
    cat >&2 <<EOF
npm global prefix is not user-writable: $prefix

Refusing to run with sudo silently. Either:
  - Use nvm / volta / fnm (recommended), OR
  - Re-run this installer with sudo (you accept responsibility), OR
  - See https://docs.npmjs.com/resolving-eacces-permissions-errors
EOF
    exit 1
  fi
}

require_node20
require_npm_global_writable

echo "Installing mirador-cli…"
npm i -g mirador-cli

echo
echo "Installed. Next: run \`mirador init\` to set up Vercel and your agents."
