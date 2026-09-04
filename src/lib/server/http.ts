import { json } from '@sveltejs/kit';
import { VaultError } from './vault.ts';

/** Uniform JSON error responses for API routes. */
export function fail(e: unknown): Response {
	if (e instanceof VaultError) return json({ error: e.message }, { status: e.status });
	console.error(e);
	return json({ error: (e as Error)?.message ?? 'Internal error' }, { status: 500 });
}

export function summary(t: import('../term.ts').Term) {
	return {
		slug: t.slug,
		term: t.fm.term,
		aliases: t.fm.aliases ?? [],
		tags: t.fm.tags ?? [],
		defined: t.defined,
		math: t.math,
		added: t.fm.added ?? null,
		smiles: t.fm.smiles ?? null,
		reverse: t.fm.reverse !== false
	};
}
export type TermSummary = ReturnType<typeof summary>;
