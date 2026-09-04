# Back up the vault

The vault is a folder. Commit it.

- `Terms/`, `reviews.jsonl`, `config.json` — small text, always in git.
- `Assets/` — pasted images. Either commit them (a few hundred KB each is fine for a personal repo) or symlink the folder to cloud storage with `setup/init-vault.sh --assets <dir>` and add `Assets/` to the vault's `.gitignore`.
- `.cache/` — regenerable typst output, ignored by default.

Nothing here auto-commits or pushes. A reasonable habit is a `git commit -am "reviews"` at the end of a session; `reviews.jsonl` only ever grows, so merges between machines are trivial.
