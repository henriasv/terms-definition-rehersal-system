import type { PageServerLoad } from './$types';
import { listTerms } from '$lib/server/vault';

export const load: PageServerLoad = async () => {
	const terms = await listTerms();
	return { allTags: [...new Set(terms.flatMap((t) => t.fm.tags ?? []))].sort() };
};
