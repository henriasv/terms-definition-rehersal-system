import { json, type RequestHandler } from '@sveltejs/kit';
import { loadConfig } from '$lib/server/config';
import { fail } from '$lib/server/http';
import { appendLog, cardStates, readTerm, withReviewWrite } from '$lib/server/vault';
import { previewIntervals, review, splitKey, type ReviewLine } from '$lib/reviews';

/** Body: { card: "slug#fwd", rating: 1..4, ms? } → appends to reviews.jsonl. */
export const POST: RequestHandler = async ({ request }) => withReviewWrite(async () => {
	try {
		const body = await request.json();
		const key = String(body.card ?? '');
		const rating = Number(body.rating);
		if (!/^[^#/\\]+#(fwd|rev)$/.test(key)) return json({ error: 'bad card key' }, { status: 400 });
		if (![1, 2, 3, 4].includes(rating)) return json({ error: 'rating must be 1..4' }, { status: 400 });
		await readTerm(splitKey(key).slug); // 404 if the term vanished
		const cfg = loadConfig();
		const states = await cardStates();
		const now = new Date();
		const { card, line } = review(states.get(key), rating as ReviewLine['rating'], key, now, cfg, typeof body.ms === 'number' ? body.ms : undefined);
		await appendLog(line);
		return json({ due: card.due.toISOString(), state: card.state, intervals: previewIntervals(card, card.due, cfg), lookaheadMinutes: cfg.lookaheadMinutes });
	} catch (e) {
		return fail(e);
	}
});
