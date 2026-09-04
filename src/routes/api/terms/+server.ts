import { json, type RequestHandler } from '@sveltejs/kit';
import { decorate, fail } from '$lib/server/http';
import { createTerm, listTerms } from '$lib/server/vault';
import type { MathDialect } from '$lib/term';

export const GET: RequestHandler = async () => {
	try {
		return json({ terms: await Promise.all((await listTerms()).map(decorate)) });
	} catch (e) {
		return fail(e);
	}
};

/**
 * Create one or more terms.
 * Body: { term, tags?, aliases?, math?, definition?, source? }
 *    or { names: string[], tags? }  for bulk quick-add (one per line in the UI).
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const tags = parseTags(body.tags);
		const names: string[] = Array.isArray(body.names) ? body.names : [body.term];
		const results = [];
		for (const raw of names) {
			const name = String(raw ?? '').trim();
			if (!name) continue;
			const { term, created } = await createTerm({
				term: name,
				tags,
				aliases: parseList(body.aliases),
				math: (body.math as MathDialect) ?? 'latex',
				definition: body.definition,
				source: body.source
			});
			results.push({ ...(await decorate(term)), created });
		}
		if (!results.length) return json({ error: 'No term name given' }, { status: 400 });
		return json({ terms: results }, { status: 201 });
	} catch (e) {
		return fail(e);
	}
};

function parseList(v: unknown): string[] {
	if (Array.isArray(v)) return v.map(String);
	if (typeof v === 'string') return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
	return [];
}
function parseTags(v: unknown): string[] {
	if (Array.isArray(v)) return v.map(String);
	if (typeof v === 'string') return v.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
	return [];
}
