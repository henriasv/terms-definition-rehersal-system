# Known limitations

- **Single machine, single user.** No auth, binds to localhost. Sync between machines is git, done by you.
- **Phone sync needs the computer's hosted tab.** The private Paper Study app saves cards and progress online. Automatic transfer to/from the local vault needs the desktop app and a paired Paper Study tab running on the computer. Phone review works while the computer is off. File transfer is available as a fallback.
- **NotebookLM uses unofficial interfaces.** Google changes can break the integration or require signing in again. Extraction runs on the computer; approved cards can be reviewed on the phone.
- **Concurrent offline reviews can conflict.** Reviewing the same card in both apps before they sync pauses import for recovery rather than silently replacing either history.
- **Light theme only.** The design system defines no dark palette; the app follows it.
- **Typst needs the CLI.** Without `typst` on `PATH`, typst snippets show an error instead of rendering. LaTeX needs nothing.
- **Inline typst alignment is approximate for tall content.** Snippets taller than 1.5 em above the baseline sit slightly high.
- **Optimiser needs data.** `terms optimize` wants a few hundred reviews before the fitted weights beat the defaults.
- **Undo is one level per card.** You can take back the most recent rating of a card, not older ones.
- **A name needs plain text.** A term whose name is only a SMILES token or a formula has no text to build a filename from and is refused; add a word.
