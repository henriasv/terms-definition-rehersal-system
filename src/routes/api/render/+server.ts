import { json, type RequestHandler } from '@sveltejs/kit';
import { fail } from '$lib/server/http';
import { renderInline, renderMarkdown } from '$lib/server/render';
import { listTerms } from '$lib/server/vault';
import { getSection, type MathDialect } from '$lib/term';

/**
 * Live preview. Body: { body, math, term?, aliases? } (body = Markdown after the H1)
 * → { html, errors, defined, termHtml, aliasesHtml }. Writes nothing.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const body = String(data.body ?? '');
		const math: MathDialect = data.math === 'typst' ? 'typst' : 'latex';
		const terms = await listTerms();
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
			aliasesHtml: aliases.map((a) => a.html)
		});
	} catch (e) {
		return fail(e);
	}
};
