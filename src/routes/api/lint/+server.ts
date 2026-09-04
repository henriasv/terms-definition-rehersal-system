import { json, type RequestHandler } from '@sveltejs/kit';
import { fail } from '$lib/server/http';
import { lintVault } from '$lib/server/lint';

export const GET: RequestHandler = async () => {
	try {
		return json({ issues: await lintVault() });
	} catch (e) {
		return fail(e);
	}
};
