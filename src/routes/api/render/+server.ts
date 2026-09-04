import { json, type RequestHandler } from '@sveltejs/kit';
import { fail } from '$lib/server/http';
import { renderMarkdown } from '$lib/server/render';
import { listTerms } from '$lib/server/vault';
import { getSection, type MathDialect } from '$lib/term';

/** Live preview. Body: { body, math } (Markdown after the H1) → { html, errors, defined }. Writes nothing. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const body = String(data.body ?? '');
		const math: MathDialect = data.math === 'typst' ? 'typst' : 'latex';
		const terms = await listTerms();
		const { html, errors } = await renderMarkdown(body, { math, terms });
		return json({ html, errors, defined: getSection(body, 'Definition').length > 0 });
	} catch (e) {
		return fail(e);
	}
};
