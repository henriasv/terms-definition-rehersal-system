# Decisions

Recorded from the design conversation (September 2026) so later changes can be judged against the original intent.

**Computer only.** Reviewing happens at the desk, so the app is a local server that reads the vault folder directly. No GitHub API, no sync layer, no token. A phone surface (Telegram via nanoclaw, as the literature vault does) can be added later; it would only need to call the same functions in `src/lib/server/`.

**Typst through the CLI, not WASM.** Because the app is local, `typst compile` is available, complete (packages, fonts, tables) and cached per snippet. In-browser typst.ts was the alternative and is still possible if the app ever leaves the machine.

**Per-file math flag.** `math: latex | typst` in the frontmatter, defaulting to LaTeX so files render unchanged in Obsidian. The linter catches the wrong combination with a pointed message. A per-snippet marker was rejected as noise in the common case.

**Both card directions.** Term → definition and definition → term, scheduled independently. `reverse: false` opts a term out when its definition is not a good prompt.

**Assets in the vault, paste to file.** Pasting an image writes `Assets/<slug>-<date>-<hash>.<ext>` and inserts an Obsidian embed. The folder can be a symlink to Google Drive when binaries should stay out of git, mirroring the literature vault's `PDFs/`.

**Files, not a database.** Same reasoning as the literature vault: one Markdown file per term, an append-only JSONL log for reviews, state derived by replay. See [files, not a database](files-not-database.md).

**Undefined terms are normal.** Capture speed was the stated priority, so a term with only a name is a complete, valid file that simply does not produce cards yet.

**Structures are names, not a field.** A SMILES is written as `smiles:…` inside the name or an alias, alongside `$math$`. It is then shown wherever the name is shown, and a term needs no extra field to be a molecule.

**Links, no graph.** `[[wikilinks]]` resolve by slug, name or alias, and Obsidian will draw a graph if wanted. The app itself does not build one.
