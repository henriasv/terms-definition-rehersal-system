# Configuration

## Environment

| Variable | Meaning |
|---|---|
| `TERMS_VAULT` | Vault path. Overrides `setup/.local.conf`. |
| `TYPST_BIN` | Path to the typst executable. Default `typst`. |
| `PORT` | Port for `pnpm start` (built app). Dev server uses Vite's default 5173. |
| `HOST` | Built app bind address. `pnpm start` defaults to `127.0.0.1`. |
| `ORIGIN` | Browser address of the built app. `pnpm start` defaults to `http://HOST:PORT`; set explicitly if your browser uses a different address. |
| `BODY_SIZE_LIMIT` | Built app request limit. `pnpm start` defaults to `45M`, allowing PDFs up to 40 MB plus form data. |

## `config.json` in the vault

All fields optional.

```json
{
  "requestRetention": 0.9,
  "maximumInterval": 365,
  "newPerSession": 20,
  "lookaheadMinutes": 20,
  "typstBin": "typst",
  "w": [0.4, 0.6, "…"]
}
```

- `requestRetention` — target recall probability at review time. Higher means more frequent reviews.
- `maximumInterval` — cap on scheduling, in days.
- `newPerSession` — never-seen cards introduced per session.
- `lookaheadMinutes` — learning-step cards due within this window count as due, so an "Again" comes back inside the same session.
- `w` — FSRS weights. Absent means the algorithm defaults; `pnpm terms optimize` writes fitted ones here (plus `optimizedAt`).

Changes take effect on the next request; no restart.
