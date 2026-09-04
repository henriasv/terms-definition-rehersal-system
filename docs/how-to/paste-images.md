# Paste images

Clip a figure from a paper, paste it into the note.

1. Copy an image to the clipboard (screenshot tool, right-click → copy image, …).
2. In the term editor, place the cursor where the figure belongs and paste.
3. The bytes go to `Assets/<slug>-<yyyymmdd>-<hash8>.<ext>` and `![[<that name>]]` is inserted at the cursor. Dropping a file on the editor does the same.

Identical bytes map to the same name, so pasting twice does not duplicate the file. Supported: PNG, JPEG, GIF, WebP, SVG, PDF (PDFs become links, not inline images).

The embed syntax is Obsidian's, so the note renders there too.

## Cleaning up

Images you pasted and later removed from the text stay in `Assets/`. The Lint page lists them as `orphan-asset` with a delete button, and `pnpm terms assets --prune` deletes them all.

## Keeping images out of git

If `Assets/` should live on Google Drive instead, make it a symlink at vault creation:

```bash
setup/init-vault.sh --assets "~/Google Drive/My Drive/terms-assets"
```

and uncomment `Assets/` in the vault's `.gitignore`. See [back up the vault](back-up-the-vault.md).
