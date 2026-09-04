import { json, type RequestHandler } from '@sveltejs/kit';
import { fail } from '$lib/server/http';
import { renderInline, renderMarkdown } from '$lib/server/render';
import { listAssets, listTerms } from '$lib/server/vault';
import { LIVE_CODES, lintTerm } from '$lib/lint';
import { getSection, synthesizeTerm, type MathDialect } from '$lib/term';

/**
 * Live preview. Body: { body, math, term?, aliases?, tags?, slug? } (body = Markdown after the H1)
 * → { html, errors, defined, termHtml, aliasesHtml, issues }. Writes nothing.
 * `issues` are the lint checks worth showing while typing: dialect mismatches, broken links, missing assets.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const body = String(data.body ?? '');
		const math: MathDialect = data.math === 'typst' ? 'typst' : 'latex';
		const [terms, assets] = await Promise.all([listTerms(), listAssets()]);
		const slug = typeof data.slug === 'string' && data.slug ? data.slug : 'preview';
		const aliasList = (Array.isArray(data.aliases) ? data.aliases : []).map(String);
		const draft = synthesizeTerm(slug, { term: String(data.term ?? ''), aliases: aliasList, tags: Array.isArray(data.tags) ? data.tags.map(String) : [], math }, body);
		const issues = lintTerm(draft, { terms: terms.filter((t) => t.slug !== slug), assets }).filter((i) => LIVE_CODES.has(i.code));
		const [{ html, errors }, name, ...aliases] = await Promise.all([
			renderMarkdown(body, { math, terms }),
			renderInline(String(data.term ?? ''), math),
			...((Array.isArray(data.aliases) ? data.aliases : []) as string[]).map((a) => renderInline(String(a), math))
		]);
		return json({
			html,
			errors: [...name.errors, ...aliases.flatMap((a) => a.errors), ...errors],
			defined: getSection(body, 'Definition').length > 0,
			termHtml: name.html,
			aliasesHtml: aliases.map((a) => a.html),
			issues
		});
	} catch (e) {
		return fail(e);
	}
};
