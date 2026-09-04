import { json, type RequestHandler } from '@sveltejs/kit';
import { fail } from '$lib/server/http';
import { deleteAsset } from '$lib/server/vault';

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteAsset(params.name!);
		return json({ ok: true });
	} catch (e) {
		return fail(e);
	}
};
