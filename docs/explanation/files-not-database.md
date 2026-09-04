# Files, not a database

The vault has no database. Terms are Markdown, reviews are JSONL, the typst cache is a folder of SVGs you can delete.

This is the same choice the literature vault made, for the same reasons: the vault is `git`-able, greppable, readable in any editor, and outlives the app. `ls Terms/` is a table of contents; `grep -l 'tags:.*geochem' Terms/*.md` is a query; `tail reviews.jsonl` is the review history.

What it costs is query power and referential integrity. Both are handled by keeping writers honest (atomic writes, an append-only log, deterministic slugs) and by a linter that finds broken links and mismatched flags, rather than by a schema.

The one place performance mattered, typst rendering, is solved with a content-addressed cache that can be thrown away at any time.
