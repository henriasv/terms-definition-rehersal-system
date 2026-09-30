import type { Paper } from '../papers.ts';
import { renderInline, renderMarkdown } from './render.ts';
import { listTerms } from './vault.ts';

export async function paperPreviews(paper: Paper, vault?: string) {
	const terms = await listTerms(vault);
	const bySlug = new Map(terms.map(t => [t.slug, t]));
	const entries = await Promise.all(paper.suggestions.map(async card => {
		// Saved previews show the actual card, including preserved definitions of
		// existing terms and later edits made in the normal term editor.
		const saved = card.slug ? bySlug.get(card.slug) : undefined;
		const math = saved?.math ?? 'latex';
		const [question, answer] = await Promise.all([
			renderInline(saved?.fm.term ?? card.question, math),
			renderMarkdown(saved?.definition ?? card.answer, { math, terms })
		]);
		return [card.id, { questionHtml: question.html, answerHtml: answer.html }] as const;
	}));
	return Object.fromEntries(entries);
}
