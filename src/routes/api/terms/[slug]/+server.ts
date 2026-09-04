import { json, type RequestHandler } from '@sveltejs/kit';
import { fail, summary } from '$lib/server/http';
import { renderTerm } from '$lib/server/render';
import { deleteTerm, listTerms, readTerm, renameTerm, saveTerm, writeTermRaw } from '$lib/server/vault';
import { splitTitle, type Term } from '$lib/term';

async function payload(term: Term) {
	const terms = await listTerms();
	const rendered = await renderTerm(term, terms);
	return { term: { ...summary(term), termHtml: rendered.termHtml, aliasesHtml: rendered.aliasesHtml, raw: term.raw, body: splitTitle(term.body).rest }, rendered };
}

export const GET: RequestHandler = async ({ params }) => {
	try {
		return json(await payload(await readTerm(params.slug!)));
	} catch (e) {
		return fail(e);
	}
};

/**
 * Body: { raw }  — replace the whole file, or
 *       { term?, aliases?, tags?, math?, reverse?, source?, body? } — patch fields
 *       (body is the Markdown after the H1). A changed name moves the file; `renamed` says so.
 */
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const data = await request.json();
		if (typeof data.raw === 'string') {
			return json({ ...(await payload(await writeTermRaw(params.slug!, data.raw))), renamed: false });
		}
		const { term, renamed } = await saveTerm(params.slug!, data);
		return json({ ...(await payload(term)), renamed });
	} catch (e) {
		return fail(e);
	}
};

/** Body: { rename: "New name" } */
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		if (typeof body.rename !== 'string' || !body.rename.trim()) return json({ error: 'rename required' }, { status: 400 });
		const term = await renameTerm(params.slug!, body.rename);
		return json({ term: summary(term) });
	} catch (e) {
		return fail(e);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteTerm(params.slug!);
		return json({ ok: true });
	} catch (e) {
		return fail(e);
	}
};
