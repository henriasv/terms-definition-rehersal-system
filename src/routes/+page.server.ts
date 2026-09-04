import type { PageServerLoad } from './$types';
import { decorate } from '$lib/server/http';
import { cardStates, listTerms } from '$lib/server/vault';
import { stats } from '$lib/reviews';

export const load: PageServerLoad = async () => {
	const [terms, states] = await Promise.all([listTerms(), cardStates()]);
	const recent = [...terms].sort((a, b) => (b.fm.added ?? '').localeCompare(a.fm.added ?? '') || a.slug.localeCompare(b.slug)).slice(0, 5);
	return {
		stats: stats(terms, states),
		total: terms.length,
		todo: terms.filter((t) => !t.defined).length,
		recent: await Promise.all(recent.map(decorate)),
		allTags: [...new Set(terms.flatMap((t) => t.fm.tags ?? []))].sort()
	};
};
