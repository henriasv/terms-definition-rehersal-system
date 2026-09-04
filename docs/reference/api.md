# HTTP API

All routes are local, unauthenticated, JSON unless noted. Errors: `{ "error": "…" }` with a 4xx/5xx status.

| Method, path | Body / query | Returns |
|---|---|---|
| `GET /api/terms` | | `{ terms: Decorated[] }` |
| `POST /api/terms` | `{ term \| names[], tags?, aliases?, math?, definition?, source? }` | `{ terms: (Decorated & {created})[] }` 201 |
| `GET /api/terms/:slug` | | `{ term: Summary & {raw}, rendered: {definition, body, errors} }` |
| `PUT /api/terms/:slug` | `{ raw }` (whole file) **or** `{ term?, aliases?, tags?, math?, reverse?, source?, body? }` (`body` = Markdown after the H1) | same as GET plus `renamed`; a changed name moves the file and the response carries the new slug |
| `PATCH /api/terms/:slug` | `{ rename }` | `{ term: Summary }` |
| `DELETE /api/terms/:slug` | | `{ ok }` |
| `POST /api/render` | `{ body, math, term?, aliases?, tags?, slug? }` | `{ html, errors, defined, termHtml, aliasesHtml, issues }` — preview plus the live lint checks (dialect mismatch, broken links, missing assets); writes nothing |
| `POST /api/assets` | multipart `file`, `slug` | `{ name, url, markdown, reused }` 201 |
| `GET /assets/:name` | | the file |
| `GET /api/review/queue?tag=` | | `{ cards[], counts: {due, new, newTotal}, lookaheadMinutes }` |
| `POST /api/review` | `{ card, rating, ms? }` | `{ due, state, intervals, lookaheadMinutes }` |
| `GET /api/lint` | | `{ issues[] }` |

`Summary` = `{ slug, term, plain, aliases, tags, defined, math, added, reverse, source }` (`plain` is the name without markup). `Decorated` = Summary + `termHtml`, `aliasesHtml`. GET and PUT also return `raw` and `body`.
