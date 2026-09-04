# HTTP API

All routes are local, unauthenticated, JSON unless noted. Errors: `{ "error": "…" }` with a 4xx/5xx status.

| Method, path | Body / query | Returns |
|---|---|---|
| `GET /api/terms` | | `{ terms: Summary[] }` |
| `POST /api/terms` | `{ term \| names[], tags?, aliases?, math?, smiles?, definition?, source? }` | `{ terms: (Summary & {created})[] }` 201 |
| `GET /api/terms/:slug` | | `{ term: Summary & {raw}, rendered: {definition, body, errors} }` |
| `PUT /api/terms/:slug` | `{ raw }` (whole file) | same as GET |
| `PATCH /api/terms/:slug` | `{ rename }` | `{ term: Summary }` |
| `DELETE /api/terms/:slug` | | `{ ok }` |
| `POST /api/render` | `{ raw, slug? }` | `{ rendered, defined, math }` — preview, writes nothing |
| `POST /api/assets` | multipart `file`, `slug` | `{ name, url, markdown, reused }` 201 |
| `GET /assets/:name` | | the file |
| `GET /api/review/queue?tag=` | | `{ cards[], counts: {due, new, newTotal}, lookaheadMinutes }` |
| `POST /api/review` | `{ card, rating, ms? }` | `{ due, state, intervals, lookaheadMinutes }` |
| `GET /api/lint` | | `{ issues[] }` |

`Summary` = `{ slug, term, aliases, tags, defined, math, added, smiles, reverse }`.
