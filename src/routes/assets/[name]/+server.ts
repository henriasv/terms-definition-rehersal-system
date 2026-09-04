import { error, type RequestHandler } from '@sveltejs/kit';
import { promises as fs } from 'node:fs';
import { assetPath, mimeFor } from '$lib/server/assets';

export const GET: RequestHandler = async ({ params }) => {
	const file = assetPath(params.name!);
	try {
		const data = await fs.readFile(file);
		return new Response(data, { headers: { 'content-type': mimeFor(file), 'cache-control': 'private, max-age=86400' } });
	} catch {
		throw error(404, `No asset ${params.name}`);
	}
};
