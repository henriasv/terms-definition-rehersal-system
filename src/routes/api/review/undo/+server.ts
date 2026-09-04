import { json, type RequestHandler } from '@sveltejs/kit';
import { loadConfig } from '$lib/server/config';
import { fail } from '$lib/server/http';
import { appendLog, readLog } from '$lib/server/vault';
import { previewIntervals, reduceLogWithHistory } from '$lib/reviews';

/** Body: { card } → appends an undo event for the card's most recent review. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { card } = await request.json();
		if (!/^[^#/\\]+#(fwd|rev)$/.test(String(card))) return json({ error: 'bad card key' }, { status: 400 });
		const { history } = reduceLogWithHistory((await readLog()).lines);
		const h = history.get(card);
		if (!h?.length) return json({ error: 'Nothing to undo for this card' }, { status: 409 });
		await appendLog({ t: new Date().toISOString(), event: 'undo', card });
		const restored = h.length > 1 ? h[h.length - 2] : undefined;
		const cfg = loadConfig();
		return json({ restored: !!restored, due: restored?.due.toISOString() ?? null, intervals: previewIntervals(restored, new Date(), cfg) });
	} catch (e) {
		return fail(e);
	}
};
