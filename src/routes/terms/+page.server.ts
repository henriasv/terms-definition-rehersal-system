import type { PageServerLoad } from './$types';
import { decorate } from '$lib/server/http';
import { listTerms } from '$lib/server/vault';

export const load: PageServerLoad = async () => {
	const terms = await listTerms();
	const tagCounts = new Map<string, number>();
	for (const t of terms) for (const tag of t.fm.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
	return { terms: await Promise.all(terms.map(decorate)), tags: [...tagCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
};
