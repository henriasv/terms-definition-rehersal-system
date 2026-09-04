import type { PageServerLoad } from './$types';
import { decorate } from '$lib/server/http';
import { cardStates, listTerms } from '$lib/server/vault';
import { stats } from '$lib/reviews';

export const load: PageServerLoad = async () => {
	const [terms, states] = await Promise.all([listTerms(), cardStates()]);
	const tagCounts = new Map<string, number>();
	for (const t of terms) for (const tag of t.fm.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
	const recent = [...terms].sort((a, b) => (b.fm.added ?? '').localeCompare(a.fm.added ?? '')).slice(0, 8);
	return {
		stats: stats(terms, states),
		total: terms.length,
		todo: await Promise.all(terms.filter((t) => !t.defined).map(decorate)),
		recent: await Promise.all(recent.map(decorate)),
		tags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
	};
};
