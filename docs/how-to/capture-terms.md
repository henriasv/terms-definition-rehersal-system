# Capture terms

The point of the system is that writing down a term costs seconds, even without a definition.

## From the dashboard

**Capture** panel: one term per line, tags apply to every line, ⌘↵ submits. Terms that already exist are reported, not duplicated.

## From the terminal

```bash
pnpm terms add "zeta potential" "Debye length" -t chemistry/colloids
pnpm terms add "aspirin" -t chemistry/organic --smiles "CC(=O)Oc1ccccc1C(=O)O"
pnpm terms add "point of zero charge" -t chemistry/surface --typst --def "The pH where net surface charge is zero."
```

`-t` tags (comma separated, nest with `/`), `-a` aliases, `--typst` sets `math: typst`, `--def` fills the definition.

## Metadata

Name, aliases, tags, math dialect, SMILES, source and the reverse-card switch are edited in the form at the top of the term page, not in the file text. The frontmatter is written for you; fields you add by hand in the file are preserved.

## By hand

Create `Terms/<slug>.md` in any editor. The only required frontmatter field is `term:`. See [term file format](../reference/term-file-format.md). The slug must match `slugify(term)`; `pnpm terms lint` tells you if it does not, and `pnpm terms rename` fixes it.

## Later: the definition

`pnpm terms todo` lists undefined terms; so does the dashboard. Undefined terms never appear in review, so a half-captured backlog costs nothing.
