import { json, type RequestHandler } from '@sveltejs/kit';
import { acceptPaper, extractPaper, paperJobRunning, readPaper } from '$lib/server/papers';
import { fail } from '$lib/server/http';
export const GET: RequestHandler = async ({ params }) => {
	try { return json({ paper: await readPaper(params.id!), running: paperJobRunning(params.id!) }); } catch (e) { return fail(e); }
};
export const POST: RequestHandler = async ({ request, params }) => {
	try {
		const data = await request.json();
		if (data.action === 'retry') {
			const paper = await readPaper(params.id!);
			if (paper.suggestions.some(c => c.slug)) return json({ error: 'This paper already has saved cards.' }, { status: 409 });
			void extractPaper(params.id!).catch(console.error);
			return json({ started: true }, { status: 202 });
		}
		return json(await acceptPaper(params.id!, data.cards));
	} catch (e) { return fail(e); }
};
