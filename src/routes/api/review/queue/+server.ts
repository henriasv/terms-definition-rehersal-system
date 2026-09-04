import { json, type RequestHandler } from '@sveltejs/kit';
import { loadConfig } from '$lib/server/config';
import { decorate, fail } from '$lib/server/http';
import { renderMarkdown } from '$lib/server/render';
import { cardStates, listTerms } from '$lib/server/vault';
import { buildQueue, previewIntervals } from '$lib/reviews';
import { splitTitle, termHasTag, withoutSection } from '$lib/term';

/** ?tag=prefix  → cards to review now, with rendered content. */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const tag = url.searchParams.get('tag')?.trim() || undefined;
		const cfg = loadConfig();
		const [terms, states] = await Promise.all([listTerms(), cardStates()]);
		const now = new Date();
		const { items, counts } = buildQueue(terms, states, { now, cfg, filter: tag ? (t) => termHasTag(t, tag) : undefined });
		const bySlug = new Map(terms.map((t) => [t.slug, t]));
		const rendered = new Map<string, { definition: string; body: string; term: Awaited<ReturnType<typeof decorate>> }>();
		const cards = [];
		for (const it of items.slice(0, 300)) {
			const t = bySlug.get(it.slug)!;
			if (!rendered.has(it.slug)) {
				const [d, b, term] = await Promise.all([
					renderMarkdown(t.definition, { math: t.math, terms }),
					renderMarkdown(withoutSection(splitTitle(t.body, t.fm.term).rest, 'Definition'), { math: t.math, terms }),
					decorate(t)
				]);
				rendered.set(it.slug, { definition: d.html, body: b.html, term });
			}
			const r = rendered.get(it.slug)!;
			cards.push({ ...it, term: r.term, definitionHtml: r.definition, notesHtml: r.body, intervals: previewIntervals(states.get(it.key), now, cfg) });
		}
		return json({ cards, counts, lookaheadMinutes: cfg.lookaheadMinutes });
	} catch (e) {
		return fail(e);
	}
};
