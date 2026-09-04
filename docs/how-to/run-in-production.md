# Run without the dev server

```bash
pnpm build
PORT=4173 pnpm start        # node build
```

`pnpm start` serves the built app from `build/` with the same vault resolution as the CLI (`TERMS_VAULT`, then `setup/.local.conf`, then `~/repos/terms-vault`). There is no authentication: bind to localhost only, which is the default.

To keep it running on macOS, a `launchd` plist pointing at `node build` with `TERMS_VAULT` in its environment is enough.
