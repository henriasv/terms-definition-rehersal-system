/** Portable paper suggestions. Model output is untrusted input. */
import { normaliseMathDelimiters } from './math.ts';
export type PaperCardKind = 'term' | 'method' | 'result' | 'limitation' | 'concept';
export interface PaperSuggestion {
	id: string;
	kind: PaperCardKind;
	question: string;
	answer: string;
	evidence: string;
	location: string;
	selected: boolean;
	slug?: string;
}
export interface Paper {
	id: string;
	title: string;
	asset: string;
	created: string;
	status: 'processing' | 'ready' | 'error';
	notebookId?: string;
	error?: string;
	suggestions: PaperSuggestion[];
}
const kinds = new Set(['term', 'method', 'result', 'limitation', 'concept']);
export function parseSuggestions(value: unknown): PaperSuggestion[] {
	const rows = Array.isArray(value) ? value : (value as { cards?: unknown })?.cards;
	if (!Array.isArray(rows) || !rows.length || rows.length > 100) throw new Error('Expected 1–100 study cards. Try extracting again.');
	return rows.map((row, index) => {
		if (!row || typeof row !== 'object') throw new Error('Invalid study card.');
		const read = (key: string, max: number, required = false) => {
			const v = row[key];
			if (v !== undefined && typeof v !== 'string') throw new Error(`Invalid ${key} in card ${index + 1}.`);
			const s = (v ?? '').trim();
			if ((required && !s) || s.length > max) throw new Error(`Check ${key} in card ${index + 1}.`);
			return s;
		};
		const question=read('question',600,true);
		if(/[\r\n]/.test(question))throw new Error(`Keep the question on one line in card ${index+1}.`);
		return { id: String(index + 1), kind: kinds.has(row.kind) ? row.kind : 'concept', question: normaliseMathDelimiters(question), answer: normaliseMathDelimiters(read('answer', 12000, true)), evidence: read('evidence', 3000), location: read('location', 300), selected: true };
	});
}
