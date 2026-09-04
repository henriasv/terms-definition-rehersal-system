# Configuration

## Environment

| Variable | Meaning |
|---|---|
| `TERMS_VAULT` | Vault path. Overrides `setup/.local.conf`. |
| `TYPST_BIN` | Path to the typst executable. Default `typst`. |
| `PORT` | Port for `pnpm start` (built app). Dev server uses Vite's default 5173. |

## `config.json` in the vault

All fields optional.

```json
{
  "requestRetention": 0.9,
  "maximumInterval": 365,
  "newPerSession": 20,
  "lookaheadMinutes": 20,
  "typstBin": "typst"
}
```

- `requestRetention` — target recall probability at review time. Higher means more frequent reviews.
- `maximumInterval` — cap on scheduling, in days.
- `newPerSession` — never-seen cards introduced per session.
- `lookaheadMinutes` — learning-step cards due within this window count as due, so an "Again" comes back inside the same session.

Changes take effect on the next request; no restart.
