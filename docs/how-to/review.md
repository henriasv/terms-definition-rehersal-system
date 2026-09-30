# Review

## Session

**Review** → choose a tag (prefix match, so `chemistry` includes `chemistry/surface`) → **Start**.

| Key | Action |
|---|---|
| Space / Enter | Show answer |
| 1 | Again — back within a minute |
| 2 | Hard |
| 3 | Good |
| 4 | Easy |
| U | Undo the last rating (also available after the session ends) |

The buttons show when each rating would bring the card back. Cards rated Again or Hard return later in the same session (anything due within `lookaheadMinutes`, default 20).

Long questions use a smaller reading size. The card contents scroll inside the card, while the answer and rating controls stay visible. Space reveals without assigning a rating; use 1–4 to rate deliberately. Shortcuts do not override focused buttons, links, fields, or expandable notes. Use **End session** to stop; saved ratings remain recorded. **Edit card** opens separately so the session stays in place.

Paper collections appear by title in the collection selector. **Back to paper** returns to their suggestions and source PDF.

## What is in the queue

- Every card due now (overdue first), plus learning-step cards due within the lookahead.
- Then up to `newPerSession` (default 20) never-seen cards, oldest terms first, forward card before reverse.

Only terms with a non-empty `## Definition` produce cards. Set `reverse: false` in the frontmatter to skip the definition → term card for a term whose definition does not identify it uniquely.

## Tuning

`config.json` in the vault: `requestRetention` (default 0.9), `maximumInterval` (days), `newPerSession`, `lookaheadMinutes`. See [configuration](../reference/config.md).

## Undoing a rating

Press `U` or click *undo last rating*. The log gets an `undo` event for that card, its state reverts to before the rating, and the card comes back up. Only the most recent rating per card can be undone this way.

## Fitting the scheduler to you

Once a few hundred reviews have accumulated:

```bash
pnpm terms optimize
```

This fits FSRS weights to your `reviews.jsonl` (via `fsrs-rs-nodejs`) and writes them to `config.json` as `w`. The app picks them up on the next request. Below 200 reviews the command refuses; `--min N` overrides.

## Resetting a card

Append a line to `reviews.jsonl`:

```json
{"t":"2026-09-04T10:00:00Z","event":"reset","card":"zeta-potential#fwd"}
```

The log is append-only; never edit earlier lines.
