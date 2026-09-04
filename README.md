# terms-definition-rehersal-system

Capture the terms you keep stumbling over in a new field, one Markdown file each, and rehearse them as spaced-repetition flashcards. Math in LaTeX or typst, molecules as SMILES, images pasted straight into the note.

Two parts share one folder on disk:

- **The vault** — a git repo you own: `Terms/*.md`, `Assets/`, `reviews.jsonl`. Plain files; also opens as an Obsidian vault.
- **The app** — a local web app (SvelteKit, runs on your machine) plus a small CLI. Both read and write the vault directly. Nothing leaves your computer.

## Quick start

```bash
pnpm install
setup/init-vault.sh            # creates ~/repos/terms-vault (or pass a path)
pnpm dev                       # opens http://localhost:5173
```

Requires Node ≥ 20, pnpm, and the `typst` CLI if you want typst rendering (`brew install typst`).

Add terms from the terminal too:

```bash
pnpm terms add "surface deprotonation constant" -t chemistry/surface
pnpm terms todo                # terms still without a definition
pnpm terms lint                # dialect mismatches, render errors, broken links
```

## Where to go next

- **New here?** → [Tutorial: getting started](docs/tutorial/getting-started.md)
- **Doing a specific thing?** → [How-to guides](docs/how-to/)
- **Exact details?** → [Reference](docs/reference/)
- **Why it is shaped this way?** → [Explanation](docs/explanation/)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)

## Layout

```
src/lib/term.ts        term files: parse, serialise, slugs, sections   (pure)
src/lib/math.ts        $…$ scanner and dialect sniffing                (pure)
src/lib/lint.ts        static checks                                   (pure)
src/lib/reviews.ts     review log + FSRS scheduling                    (pure)
src/lib/server/        vault I/O, rendering, typst, assets, lint
src/routes/            pages and /api endpoints
scripts/terms.ts       CLI
setup/init-vault.sh    create a vault
examples/vault/        sample vault used for development and tests
tests/                 vitest unit tests for the pure modules
```

## License

MIT.
