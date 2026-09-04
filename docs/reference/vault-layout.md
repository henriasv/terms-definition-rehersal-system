# Vault layout

```
terms-vault/
  Terms/                one .md per term            (git)
  Assets/               pasted images, PDFs         (git or symlink to cloud storage)
  reviews.jsonl         append-only review log      (git)
  config.json           optional scheduler settings (git)
  .cache/typst/         rendered typst SVGs         (ignored, regenerable)
  .gitignore
  README.md
```

`setup/init-vault.sh [path] [--assets dir]` creates this and runs `git init`.

## Locating the vault

In order: `TERMS_VAULT` environment variable; `VAULT=…` in `setup/.local.conf` (written by the init script); `~/repos/terms-vault`.

## Write discipline

Every writer (app, CLI) writes a tempfile in the target directory and renames it into place. `reviews.jsonl` is only ever appended to. Nothing holds a lock; nothing caches vault state between requests, so external edits (Obsidian, `vim`, `git pull`) are picked up immediately.
