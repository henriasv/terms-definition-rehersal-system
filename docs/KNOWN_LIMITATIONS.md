# Known limitations

- **Single machine, single user.** No auth, binds to localhost. Sync between machines is git, done by you.
- **No phone surface yet.** Capture and review are desktop only. A Telegram agent could call the same server functions.
- **Typst needs the CLI.** Without `typst` on `PATH`, typst snippets show an error instead of rendering. LaTeX needs nothing.
- **Inline typst alignment is approximate for tall content.** Snippets taller than 1.5 em above the baseline sit slightly high.
- **Optimiser needs data.** `terms optimize` wants a few hundred reviews before the fitted weights beat the defaults.
- **Undo is one level per card.** You can take back the most recent rating of a card, not older ones.
- **A name needs plain text.** A term whose name is only a SMILES token or a formula has no text to build a filename from and is refused; add a word.
