import { json, type RequestHandler } from '@sveltejs/kit';
import { saveAsset } from '$lib/server/assets';
import { fail } from '$lib/server/http';

/** multipart/form-data with `file` and `slug`; returns the Markdown embed to insert. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const form = await request.formData();
		const file = form.get('file');
		if (!(file instanceof File)) return json({ error: 'file missing' }, { status: 400 });
		const slug = String(form.get('slug') ?? 'asset');
		const bytes = new Uint8Array(await file.arrayBuffer());
		const { name, reused } = await saveAsset(bytes, { slug, mime: file.type, filename: file.name });
		return json({ name, reused, url: `/assets/${encodeURIComponent(name)}`, markdown: `![[${name}]]` }, { status: 201 });
	} catch (e) {
		return fail(e);
	}
};
