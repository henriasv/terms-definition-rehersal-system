# Term file format

One file per term: `Terms/<slug>.md`. YAML frontmatter, then Markdown. The canonical generator is `newTermFile()` in `src/lib/term.ts`.

## Slug

`slugify(term)`: lowercase, æ→ae ø→o å→a, strip diacritics, non-alphanumerics → `-`, trim. `Surface deprotonation constant` → `surface-deprotonation-constant`. The slug is the identifier in links, in the review log and in URLs; renaming a term changes it (see [CLI: rename](cli.md)).

## Frontmatter

| Field | Type | Required | Notes |
|---|---|---|---|
| `term` | string | yes | Display name. Should slugify to the filename; lint reports `slug-mismatch` otherwise. |
| `aliases` | list of strings | no | Alternative names; shown on cards, resolve in `[[links]]`. |
| `tags` | list of strings | no | Lowercase; nest with `/` (`chemistry/surface`). A leading `#` is stripped. |
| `math` | `latex` \| `typst` | no | Dialect of `$…$` in this file. Default `latex`. |
| `smiles` | string | no | Structure drawn on the card and term page. |
| `reverse` | bool | no | `false` disables the definition → term card. Default `true`. |
| `added` | ISO date | no | Set on creation. Orders new cards. |
| `source` | string | no | Free text, e.g. a literature-vault citekey. |

Unknown fields are preserved.

## Body

```markdown
# Term name

## Definition

…the card back. Non-empty means "defined": the term enters review.

## Notes

…anything else. Shown under "Full note" on the card back.
```

Other `## Sections` are allowed and preserved. Section lookup is case-insensitive and ignores `##` inside code fences.

## Inline syntax

| Syntax | Meaning |
|---|---|
| `$…$` / `$$…$$` | Inline / display math in the file's dialect. Backslash-escaped `\$` and `$` inside code are ignored; `$5 and $10` is not math. |
| ```` ```typst ```` | Always typst, compiled as a fragment (tables, figures). |
| ```` ```smiles ```` | One SMILES per line, drawn as structures. |
| `[[Target]]`, `[[Target\|label]]` | Link to a term by slug, name or alias (case-insensitive). Unresolved links render orange and lead to the new-term form. |
| `![[file.png]]` | Embed from `Assets/`. PDFs and other files become links. |

## Example

```markdown
---
term: Salicylic acid
aliases:
  - 2-hydroxybenzoic acid
tags:
  - chemistry/organic
math: latex
smiles: OC(=O)c1ccccc1O
added: '2026-09-04'
---

# Salicylic acid

## Definition

A phenolic acid, $\mathrm{C_7H_6O_3}$, with a carboxylic acid ortho to a hydroxyl group. Precursor of [[aspirin]].

## Notes

The intramolecular hydrogen bond lowers the first $\mathrm{p}K_a$ to about 2.97.
```
