# Review

## Session

**Review** → choose a tag (prefix match, so `chemistry` includes `chemistry/surface`) → **Start**.

| Key | Action |
|---|---|
| Space / Enter | Show answer; a second press rates Good |
| 1 | Again — back within a minute |
| 2 | Hard |
| 3 | Good |
| 4 | Easy |

The buttons show when each rating would bring the card back. Cards rated Again or Hard return later in the same session (anything due within `lookaheadMinutes`, default 20).

## What is in the queue

- Every card due now (overdue first), plus learning-step cards due within the lookahead.
- Then up to `newPerSession` (default 20) never-seen cards, oldest terms first, forward card before reverse.

Only terms with a non-empty `## Definition` produce cards. Set `reverse: false` in the frontmatter to skip the definition → term card for a term whose definition does not identify it uniquely.

## Tuning

`config.json` in the vault: `requestRetention` (default 0.9), `maximumInterval` (days), `newPerSession`, `lookaheadMinutes`. See [configuration](../reference/config.md).

## Resetting a card

Append a line to `reviews.jsonl`:

```json
{"t":"2026-09-04T10:00:00Z","event":"reset","card":"zeta-potential#fwd"}
```

The log is append-only; never edit earlier lines.
