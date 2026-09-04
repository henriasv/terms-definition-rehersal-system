import type { PageServerLoad } from './$types';
import { listTerms } from '$lib/server/vault';

export const load: PageServerLoad = async () => {
	const terms = await listTerms();
	const counts = new Map<string, number>();
	for (const t of terms) {
		if (!t.defined) continue;
		const seen = new Set<string>();
		for (const tag of t.fm.tags ?? []) {
			// count the tag and each ancestor once per term
			const parts = tag.split('/');
			for (let i = 1; i <= parts.length; i++) seen.add(parts.slice(0, i).join('/'));
		}
		for (const s of seen) counts.set(s, (counts.get(s) ?? 0) + 1);
	}
	return { tags: [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
};
