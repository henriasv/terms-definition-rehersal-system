import { json } from '@sveltejs/kit';
import { VaultError } from './vault.ts';
import { plainName, type Term } from '../term.ts';
import { renderNames } from './render.ts';

/** Uniform JSON error responses for API routes. */
export function fail(e: unknown): Response {
	if (e instanceof VaultError) return json({ error: e.message }, { status: e.status });
	console.error(e);
	return json({ error: (e as Error)?.message ?? 'Internal error' }, { status: 500 });
}

export function summary(t: Term) {
	return {
		slug: t.slug,
		term: t.fm.term,
		plain: plainName(t.fm.term),
		aliases: t.fm.aliases ?? [],
		tags: t.fm.tags ?? [],
		defined: t.defined,
		math: t.math,
		added: t.fm.added ?? null,
		reverse: t.fm.reverse !== false,
		source: typeof t.fm.source === 'string' ? t.fm.source : null
	};
}
export type TermSummary = ReturnType<typeof summary>;

/** Summary plus the name and aliases rendered to HTML (math + structures). */
export async function decorate(t: Term) {
	const { termHtml, aliasesHtml } = await renderNames(t);
	return { ...summary(t), termHtml, aliasesHtml };
}
export type TermDecorated = Awaited<ReturnType<typeof decorate>>;
