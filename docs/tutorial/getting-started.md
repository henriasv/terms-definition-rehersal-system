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

Click **Define** in the header (the badge counts terms without a definition). It lists everything waiting, oldest first; pick one, or start from the top. The workbench then shows one term at a time with the queue in the rail: the rail on the left holds aliases, tags as chips (Enter or comma adds one), the math dialect, a source and the reverse-card switch; the middle is a syntax-highlighted editor for the note body; the right is a live preview. Write under `## Definition` and press **Save and next** (⌘↵), or **Skip for now** to come back later. Any term can also be opened from the list: the term page is the same workbench with the name editable, ⌘S to save. Names and aliases may contain `$math$` and `smiles:…` tokens. Math goes in `$…$` (inline) or `$$…$$` (display). Paste an image from the clipboard and it lands in `Assets/` with an embed link inserted at the cursor. Changing the name renames the file; review history follows.

## 5. Review

Click **Review**, pick a tag or leave "All terms", **Start**. Space shows the answer, `1`–`4` rate it (Again, Hard, Good, Easy). Each defined term gives two cards: term → definition and definition → term. Ratings append to `reviews.jsonl`; nothing else changes.

## 6. Commit

The vault is a git repo. Commit when you like:

```bash
cd ~/repos/terms-vault && git add -A && git commit -m "first terms"
```

Next: [capture terms](../how-to/capture-terms.md), [LaTeX vs typst](../how-to/latex-vs-typst.md).
