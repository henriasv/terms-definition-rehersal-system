import type { PageServerLoad } from './$types';
import { summary } from '$lib/server/http';
import { renderTerm } from '$lib/server/render';
import { listAssets, listTerms } from '$lib/server/vault';
import { lintTerm } from '$lib/lint';
import { vaultPath } from '$lib/server/config';
import { linkTargets, splitTitle } from '$lib/term';

/** The queue of undefined terms, oldest first; ?skip=a,b puts those at the back for this visit. */
export const load: PageServerLoad = async ({ url }) => {
	const [terms, assets] = await Promise.all([listTerms(), listAssets()]);
	const skip = (url.searchParams.get('skip') ?? '').split(',').filter(Boolean);
	const todo = terms.filter((t) => !t.defined).sort((a, b) => (a.fm.added ?? '').localeCompare(b.fm.added ?? '') || a.slug.localeCompare(b.slug));
	const ordered = [...todo.filter((t) => !skip.includes(t.slug)), ...todo.filter((t) => skip.includes(t.slug))];
	const current = ordered[0];
	const base = { total: todo.length, skip, allTags: [...new Set(terms.flatMap((t) => t.fm.tags ?? []))].sort() };
	if (!current) return { ...base, current: null };
	const rendered = await renderTerm(current, terms);
	return {
		...base,
		current: {
			term: summary(current),
			body: splitTitle(current.body, current.fm.term).rest,
			rendered: { body: rendered.body, termHtml: rendered.termHtml, aliasesHtml: rendered.aliasesHtml },
			issues: lintTerm(current, { terms, assets }).filter((i) => i.level !== 'info'),
			cards: { fwd: null, rev: null },
			file: `${vaultPath()}/Terms/${current.slug}.md`,
			linkTargets: linkTargets(terms.filter((t) => t.slug !== current.slug)),
			position: todo.length - ordered.length + 1 + ordered.indexOf(current)
		}
	};
};
