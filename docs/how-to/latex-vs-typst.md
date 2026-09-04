# LaTeX vs typst

Every term file declares which dialect its `$…$` math uses:

```yaml
math: latex     # default; rendered by KaTeX in the browser
math: typst     # rendered by your local `typst` CLI to SVG
```

`$x$` is inline, `$$…$$` is display, in both dialects. With `math: typst` the display form becomes a typst block equation (`$ … $` with spaces).

Independent of the flag, a fenced block tagged `typst` is always compiled as a whole typst document fragment — tables, diagrams, anything typst can draw:

````markdown
```typst
#table(columns: 2, [oxide], [PZC], [SiO#sub[2]], [2–3])
```
````

## When you pick the wrong one

The linter (Lint page, or `pnpm terms lint`) looks at every `$…$` and compares its syntax with the flag:

```
error Terms/bad-example.md:13: math is "latex" but $frac(a, b)$ looks like typst (frac().
      fix: Set `math: typst` in the frontmatter, or rewrite the snippet in LaTeX.
```

Heuristics: backslash commands and `^{`/`_{` mean LaTeX; `frac(`, `sqrt(`, `^(`, `arrow.r`, `"quoted"` and bare Greek names mean typst. A snippet that mixes both is a warning. Real render failures are reported too, with KaTeX's or typst's own message and the file line, and the editor page shows them above the preview as you type.

## Rendering details

- KaTeX runs server-side into HTML; the CSS is bundled.
- typst runs as a child process (`typst compile --format svg`), cached under `<vault>/.cache/typst/` by content hash. Delete the cache any time. Set `TYPST_BIN` or `typstBin` in `config.json` if `typst` is not on `PATH`.
- Inline typst SVGs are sized in `em` and aligned to the text baseline; display and block output is centred.
