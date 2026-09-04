# Use with Obsidian

The vault is Markdown with YAML frontmatter. **File → Open vault** on the vault folder and you get tags, backlinks, search and the graph for free.

- `[[Term name]]`, `[[slug]]` and `[[alias]]` all resolve here; Obsidian resolves the first two natively (aliases too if you keep `aliases:` in the frontmatter, which this system does).
- `![[image.png]]` embeds resolve in both as long as Obsidian's attachment folder is `Assets/` (Settings → Files and links → Default location for new attachments → `Assets`).
- `$…$` renders in Obsidian as LaTeX regardless of the `math:` flag; typst snippets show as source there.
- `reviews.jsonl`, `config.json` and `.cache/` are not notes; Obsidian ignores them.

Editing a note in Obsidian while the app is open is fine: the app re-reads files on every request and writes atomically. Avoid editing the same file in both at the same moment.
