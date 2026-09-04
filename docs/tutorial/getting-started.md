# Getting started

Ten minutes from clone to first review.

## 1. Install

```bash
git clone <this repo> ~/repos/terms-definition-rehersal-system
cd ~/repos/terms-definition-rehersal-system
pnpm install
brew install typst        # optional, only for typst math
```

## 2. Create a vault

```bash
setup/init-vault.sh
```

This creates `~/repos/terms-vault` with `Terms/`, `Assets/`, an empty `reviews.jsonl`, a `.gitignore`, and runs `git init`. The path is recorded in `setup/.local.conf` so the app and CLI find it. Pass a different path as the first argument, or `--assets <dir>` to keep images on cloud storage (see [back up the vault](../how-to/back-up-the-vault.md)).

## 3. Start the app

```bash
pnpm dev
```

The browser opens on the dashboard. The left panel is **Capture**: type one term per line, optionally tags, press ⌘↵. Each line becomes `Terms/<slug>.md` with an empty definition.

## 4. Define a term

Click a term under **To define**. The panel at the top holds the metadata as form fields: name, aliases and tags as chips (Enter or comma adds one), the math dialect, a source, and whether to ask the reverse card. Names and aliases may contain `$math$` and `smiles:…` tokens, which render as formulas and structures. Below it, the left pane is a syntax-highlighted editor for the note body and the right pane a live preview. Write under `## Definition`, save with ⌘S. Math goes in `$…$` (inline) or `$$…$$` (display). Paste an image from the clipboard and it lands in `Assets/` with an embed link inserted at the cursor. Changing the name renames the file; review history follows.

## 5. Review

Click **Review**, pick a tag or leave "All terms", **Start**. Space shows the answer, `1`–`4` rate it (Again, Hard, Good, Easy). Each defined term gives two cards: term → definition and definition → term. Ratings append to `reviews.jsonl`; nothing else changes.

## 6. Commit

The vault is a git repo. Commit when you like:

```bash
cd ~/repos/terms-vault && git add -A && git commit -m "first terms"
```

Next: [capture terms](../how-to/capture-terms.md), [LaTeX vs typst](../how-to/latex-vs-typst.md).
