# Capture terms

The point of the system is that writing down a term costs seconds, even without a definition.

## From the dashboard

**Capture** panel: one term per line, tags apply to every line, ⌘↵ submits. Terms that already exist are reported, not duplicated.

## From the terminal

```bash
pnpm terms add "zeta potential" "Debye length" -t chemistry/colloids
pnpm terms add "aspirin" -t chemistry/organic -a "smiles:CC(=O)Oc1ccccc1C(=O)O"
pnpm terms add "point of zero charge" -t chemistry/surface --typst --def "The pH where net surface charge is zero."
```

`-t` tags (comma separated, nest with `/`), `-a` aliases, `--typst` sets `math: typst`, `--def` fills the definition.

## Metadata

Name, aliases, tags, math dialect, source and the reverse-card switch are edited in the rail on the left of the term page, not in the file text. The frontmatter is written for you; fields you add by hand in the file are preserved.

## By hand

Create `Terms/<slug>.md` in any editor. The only required frontmatter field is `term:`. See [term file format](../reference/term-file-format.md). Any safe filename works (`Zeta Potential.md` included); the canonical name is `slugify(term)`, `pnpm terms lint` tells you when they differ, and `pnpm terms rename` normalises it. Saving from the app never moves a file unless you change the name.

## Linking terms

Type `[[` in the editor and a completion list offers every term name and alias; accepting one closes the link. A link to a term that does not exist yet is flagged above the editor as you type, with an **Add term** button: one click creates the term with the current term's tags and puts it under *To define*, and the link turns live. The same button appears on the Lint page. Renaming a term repoints links that used its old name or slug in other notes; links through an alias keep working as they are.

## Later: the definition

The **Define** page works through undefined terms one at a time, oldest first, with **Save and next** and **Skip for now**; the badge in the header is the count. `pnpm terms todo` lists the same set. Undefined terms never appear in review, so a half-captured backlog costs nothing.
