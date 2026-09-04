import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { summary } from '$lib/server/http';
import { renderTerm, renderNames } from '$lib/server/render';
import { listAssets, listTerms } from '$lib/server/vault';
import { lintTerm } from '$lib/lint';
import { vaultPath } from '$lib/server/config';
import { linkTargets, splitTitle } from '$lib/term';

/** One term in the Define workbench, with the whole queue for the rail and for "next". */
export const load: PageServerLoad = async ({ params }) => {
	const [terms, assets] = await Promise.all([listTerms(), listAssets()]);
	const current = terms.find((t) => t.slug === params.slug);
	if (!current) throw error(404, `No term "${params.slug}"`);
	const todo = terms.filter((t) => !t.defined || t.slug === current.slug).sort((a, b) => (a.fm.added ?? '').localeCompare(b.fm.added ?? '') || a.slug.localeCompare(b.slug));
	const [rendered, queue] = await Promise.all([
		renderTerm(current, terms),
		Promise.all(todo.map(async (t) => ({ slug: t.slug, termHtml: (await renderNames(t)).termHtml, added: t.fm.added ?? null })))
	]);
	return {
		term: summary(current),
		body: splitTitle(current.body, current.fm.term).rest,
		rendered: { body: rendered.body, termHtml: rendered.termHtml, aliasesHtml: rendered.aliasesHtml },
		issues: lintTerm(current, { terms, assets }).filter((i) => i.level !== 'info'),
		cards: { fwd: null, rev: null },
		file: `${vaultPath()}/Terms/${current.slug}.md`,
		linkTargets: linkTargets(terms.filter((t) => t.slug !== current.slug)),
		allTags: [...new Set(terms.flatMap((t) => t.fm.tags ?? []))].sort(),
		queue
	};
};
