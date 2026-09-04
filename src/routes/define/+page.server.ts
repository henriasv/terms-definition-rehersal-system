import type { PageServerLoad } from './$types';
import { decorate } from '$lib/server/http';
import { listTerms } from '$lib/server/vault';

/** The queue of undefined terms, oldest first. */
export const load: PageServerLoad = async () => {
	const terms = await listTerms();
	const todo = terms.filter((t) => !t.defined).sort((a, b) => (a.fm.added ?? '').localeCompare(b.fm.added ?? '') || a.slug.localeCompare(b.slug));
	return { queue: await Promise.all(todo.map(decorate)) };
};
