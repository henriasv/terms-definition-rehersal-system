# Run without the dev server

```bash
pnpm build
pnpm start                 # http://127.0.0.1:5173
# Or use a different port:
PORT=4173 pnpm start
```

`pnpm start` serves the built app from `build/` with the same vault resolution as the CLI (`TERMS_VAULT`, then `setup/.local.conf`, then `~/repos/terms-vault`). It defaults to `HOST=127.0.0.1`, port 5173, and a 45 MB request limit for PDF uploads. It sets `ORIGIN` to the matching HTTP address so SvelteKit accepts form uploads. Open that exact address; if you use a different browser address, set `ORIGIN` to it. There is no authentication: bind to localhost only, which is the default.

To keep it running on macOS, a `launchd` plist pointing at `node scripts/start.mjs` with this repository as its working directory and `TERMS_VAULT` in its environment is enough. When running `node build` directly, set `HOST=127.0.0.1 PORT=5173 ORIGIN=http://127.0.0.1:5173 BODY_SIZE_LIMIT=45M` yourself.
