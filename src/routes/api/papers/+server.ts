import { json, type RequestHandler } from '@sveltejs/kit';
import { listPapers, uploadPaper } from '$lib/server/papers';
import { fail } from '$lib/server/http';
export const GET: RequestHandler = async () => {
	try { return json({ papers: await listPapers() }); } catch (e) { return fail(e); }
};
export const POST: RequestHandler = async ({ request }) => {
	try {
		if (Number(request.headers.get('content-length') ?? 0) > 42 * 1024 * 1024) return json({ error: 'Choose a PDF under 40 MB.' }, { status: 413 });
		const data = await request.formData();
		const file = data.get('pdf');
		if (!(file instanceof File)) return json({ error: 'Choose a PDF.' }, { status: 400 });
		return json(await uploadPaper(file, String(data.get('title') ?? '')), { status: 202 });
	} catch (e) { return fail(e); }
};
