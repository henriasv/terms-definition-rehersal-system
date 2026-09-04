import { json, type RequestHandler } from '@sveltejs/kit';
import { fail } from '$lib/server/http';
import { renderTerm } from '$lib/server/render';
import { listTerms } from '$lib/server/vault';
import { parseTerm } from '$lib/term';

/** Live preview: body { raw, slug? } → rendered pieces + errors, nothing written. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { raw, slug } = await request.json();
		const term = parseTerm(slug ?? 'preview', String(raw ?? ''));
		const terms = await listTerms();
		return json({ rendered: await renderTerm(term, terms), defined: term.defined, math: term.math });
	} catch (e) {
		return fail(e);
	}
};
