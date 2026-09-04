import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { summary } from '$lib/server/http';
import { renderTerm } from '$lib/server/render';
import { cardStates, listAssets, listTerms } from '$lib/server/vault';
import { lintTerm, type LintIssue } from '$lib/lint';
import { cardKey } from '$lib/reviews';
import { vaultPath } from '$lib/server/config';

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
	return {
		term: { ...summary(term), raw: term.raw },
		rendered: { definition: rendered.definition, body: rendered.body },
		issues,
		cards: { fwd: due('fwd'), rev: due('rev') },
		file: `${vaultPath()}/Terms/${term.slug}.md`
	};
};
