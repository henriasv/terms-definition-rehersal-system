# terms-definition-rehersal-system

Local SvelteKit app + CLI over a Markdown "terms vault". Read `docs/explanation/decisions.md` before changing shape.

- Vault path: `TERMS_VAULT` → `setup/.local.conf` → `~/repos/terms-vault`. Dev against the sample: `TERMS_VAULT=examples/vault pnpm exec vite dev`.
- Pure logic (no fs) lives in `src/lib/{term,math,lint,reviews}.ts` and is unit-tested in `tests/` (`pnpm test`). Filesystem, rendering and typst are in `src/lib/server/`.
- Checks before finishing: `pnpm test`, `pnpm check` (svelte-check), `pnpm build`.
- Writes to the vault are tempfile + rename; `reviews.jsonl` is append-only, never rewritten.
- Imports of `$lib/...` must not carry a `.ts` extension; relative imports inside `src/lib` do (tsx runs the CLI).
- Do not commit the user's vault or `setup/.local.conf`.
