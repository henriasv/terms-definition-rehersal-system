import { lintAll, type LintIssue } from '../lint.ts';
import { listAssets, listTerms } from './vault.ts';
import { renderMarkdown } from './render.ts';
import { listPapers } from './papers.ts';

/** Static checks plus real render errors from KaTeX and the typst CLI. */
export async function lintVault(): Promise<LintIssue[]> {
	const [terms, assets, papers] = await Promise.all([listTerms(), listAssets(), listPapers()]);
	const issues = lintAll({ terms, assets, referencedAssets: papers.map(p=>p.asset) });
	for (const t of terms) {
		const { errors } = await renderMarkdown(t.body, { math: t.math, terms, lineOffset: t.bodyLine - 1 });
		for (const e of errors) {
			issues.push({
				slug: t.slug,
				level: 'error',
				code: `${e.kind}-error`,
				line: e.line,
				message: `${e.kind === 'latex' ? 'KaTeX' : 'typst'}: ${e.message.split('\n')[0]}`,
				fix: t.math === 'latex' ? 'If this snippet is typst, set `math: typst`.' : 'If this snippet is LaTeX, set `math: latex`.'
			});
		}
	}
	const order = { error: 0, warn: 1, info: 2 } as const;
	return issues.sort((a, b) => order[a.level] - order[b.level] || a.slug.localeCompare(b.slug) || (a.line ?? 0) - (b.line ?? 0));
}
