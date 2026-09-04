# Lint codes

| Code | Level | Meaning |
|---|---|---|
| `math-looks-typst` | error | `math: latex` but a `$…$` snippet uses typst syntax. |
| `math-looks-latex` | error | `math: typst` but a snippet uses LaTeX syntax. |
| `math-mixed` | warn | One snippet shows both. |
| `latex-error` | error | KaTeX failed to parse the snippet (message included). |
| `typst-error` | error | typst CLI failed (message and line included). |
| `broken-link` | warn | `[[target]]` matches no term, name or alias. Shown live in the editor; the **Add term** button creates it. |
| `missing-asset` | warn | `![[file]]` not present in `Assets/`. |
| `orphan-asset` | info | A file in `Assets/` that no term embeds. The Lint page offers a delete button; `terms assets --prune` removes them all. |
| `slug-mismatch` | warn | Filename does not equal `slugify(term)`. Everything still works (links by slug and log keys use the filename); `terms rename` normalises it. |
| `deprecated-smiles` | warn | Old `smiles:` frontmatter field. It is shown as an alias; saving the term once migrates it. |
| `duplicate-name` | warn | Two files share a `term:` (case-insensitive). |
| `alias-collision` | warn | An alias equals another term's name. |
| `undefined` | info | No definition; excluded from review. |
| `untagged` | info | No tags. |

Line numbers refer to the file, frontmatter included.
