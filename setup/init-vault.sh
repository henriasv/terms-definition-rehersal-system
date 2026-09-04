#!/usr/bin/env bash
# Create a terms vault: the folder that holds your term files, assets and review log.
#
#   setup/init-vault.sh [VAULT_PATH] [--assets /path/on/google/drive]
#
# Defaults to ~/repos/terms-vault. Records the path in setup/.local.conf so the
# app and CLI find it without TERMS_VAULT. Runs `git init` but leaves the first
# commit to you.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT="$HOME/repos/terms-vault"
ASSETS=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --assets) ASSETS="$2"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) VAULT="$1"; shift ;;
  esac
done
VAULT="${VAULT/#\~/$HOME}"
mkdir -p "$VAULT/Terms"
if [[ -n "$ASSETS" ]]; then
  ASSETS="${ASSETS/#\~/$HOME}"
  mkdir -p "$ASSETS"
  if [[ -e "$VAULT/Assets" && ! -L "$VAULT/Assets" ]]; then
    echo "Assets/ already exists as a real directory; not replacing it with a symlink." >&2
  else
    ln -sfn "$ASSETS" "$VAULT/Assets"
    echo "Assets/ -> $ASSETS"
  fi
else
  mkdir -p "$VAULT/Assets"
fi
[[ -f "$VAULT/reviews.jsonl" ]] || : > "$VAULT/reviews.jsonl"
if [[ ! -f "$VAULT/.gitignore" ]]; then
  cat > "$VAULT/.gitignore" <<'GI'
# Regenerable render cache
.cache/
.DS_Store
# Uncomment if Assets/ points at cloud storage and you do not want binaries in git:
# Assets/
GI
fi
if [[ ! -f "$VAULT/README.md" ]]; then
  cat > "$VAULT/README.md" <<'RM'
# Terms vault

One Markdown file per term under `Terms/`, pasted images under `Assets/`,
review history in `reviews.jsonl`. Managed by terms-definition-rehersal-system;
also opens cleanly as an Obsidian vault.
RM
fi
if [[ ! -d "$VAULT/.git" ]]; then
  git -C "$VAULT" init -q
  echo "git init done in $VAULT (no commit made yet)."
fi
printf 'VAULT=%s\n' "$VAULT" > "$HERE/.local.conf"
echo "Vault ready at $VAULT"
echo "Recorded in $HERE/.local.conf. Start the app with: pnpm dev"
