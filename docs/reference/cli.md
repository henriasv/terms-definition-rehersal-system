# CLI

`pnpm terms <command>` (runs `scripts/terms.ts` with tsx). Uses the same vault resolution as the app.

| Command | Effect |
|---|---|
| `add "Name" ["Name 2" …] [-t tags] [-a aliases] [--typst] [--def "text"]` | Create term files. Existing slugs are reported as `exists`. Tags and aliases are comma separated; names and aliases may contain `$math$` and `smiles:…` tokens. |
| `list [--tag prefix] [--todo]` | One line per term: `?` marks undefined, then slug and tags. |
| `todo` | Terms without a definition. |
| `due [--tag prefix]` | What a review session would contain now. |
| `lint` | All checks incl. real KaTeX/typst render errors. Exit code 1 if any error-level issue. |
| `rename <slug> "New name"` | Rewrite `term:` and the H1, move the file, log a rename event. |
| `path` | Print the vault path. |

Output goes to stdout; counts to stderr, so `pnpm -s terms list | wc -l` is exact.
