# Known limitations

- **Single machine, single user.** No auth, binds to localhost. Sync between machines is git, done by you.
- **No phone surface yet.** Capture and review are desktop only. A Telegram agent could call the same server functions.
- **Typst needs the CLI.** Without `typst` on `PATH`, typst snippets show an error instead of rendering. LaTeX needs nothing.
- **Inline typst alignment is approximate for tall content.** Snippets taller than 1.5 em above the baseline sit slightly high.
- **No FSRS parameter optimisation.** Defaults only; the log has what an optimiser needs.
- **Editor is a textarea.** Live preview, paste and drop work; there is no syntax highlighting or autocompletion for `[[links]]`.
- **Renames do not rewrite links in other files.** Links by name or alias keep working; links by the old slug break and lint reports them.
- **Asset deletion is manual.** Nothing removes orphaned files from `Assets/`.
