import { json, type RequestHandler } from '@sveltejs/kit';
import { fail, summary } from '$lib/server/http';
import { renderTerm } from '$lib/server/render';
import { deleteTerm, listTerms, readTerm, renameTerm, writeTermRaw } from '$lib/server/vault';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const terms = await listTerms();
		const term = terms.find((t) => t.slug === params.slug) ?? (await readTerm(params.slug!));
		return json({ term: { ...summary(term), raw: term.raw }, rendered: await renderTerm(term, terms) });
	} catch (e) {
		return fail(e);
	}
};

/** Body: { raw } — the whole file. */
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { raw } = await request.json();
		if (typeof raw !== 'string') return json({ error: 'raw must be a string' }, { status: 400 });
		const term = await writeTermRaw(params.slug!, raw);
		const terms = await listTerms();
		return json({ term: { ...summary(term), raw: term.raw }, rendered: await renderTerm(term, terms) });
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
