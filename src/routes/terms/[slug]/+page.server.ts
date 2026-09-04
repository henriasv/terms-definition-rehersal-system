import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { summary } from '$lib/server/http';
import { renderTerm } from '$lib/server/render';
import { cardStates, listAssets, listTerms } from '$lib/server/vault';
import { lintTerm, type LintIssue } from '$lib/lint';
import { cardKey } from '$lib/reviews';
import { vaultPath } from '$lib/server/config';
import { linkTargets, splitTitle } from '$lib/term';

export const load: PageServerLoad = async ({ params }) => {
	const [terms, assets, states] = await Promise.all([listTerms(), listAssets(), cardStates()]);
	const term = terms.find((t) => t.slug === params.slug);
	if (!term) throw error(404, `No term "${params.slug}"`);
	const rendered = await renderTerm(term, terms);
	const issues: LintIssue[] = [
		...lintTerm(term, { terms, assets }),
		...rendered.errors.map((e) => ({ slug: term.slug, level: 'error' as const, code: `${e.kind}-error`, line: e.line, message: `${e.kind === 'latex' ? 'KaTeX' : 'typst'}: ${e.message.split('\n')[0]}` }))
	];
	const due = (dir: 'fwd' | 'rev') => states.get(cardKey(term.slug, dir))?.due.toISOString() ?? null;
	const allTags = [...new Set(terms.flatMap((t) => t.fm.tags ?? []))].sort();
	return {
		term: summary(term),
		body: splitTitle(term.body, term.fm.term).rest,
		rendered: { definition: rendered.definition, body: rendered.body, termHtml: rendered.termHtml, aliasesHtml: rendered.aliasesHtml },
		issues,
		cards: { fwd: due('fwd'), rev: due('rev') },
		file: `${vaultPath()}/Terms/${term.slug}.md`,
		linkTargets: linkTargets(terms.filter((t) => t.slug !== term.slug)),
		allTags
	};
};
