/** JSON interchange between the Markdown vault and the private phone app. */
import { createEmptyCard, fsrs, generatorParameters, type Card, type Grade } from 'ts-fsrs';
export interface StudyState {
	due: string; stability: number; difficulty: number; elapsed_days: number;
	scheduled_days: number; learning_steps: number; reps: number; lapses: number; state: number; last_review?: string;
}
export interface StudyCard {
	key: string; slug: string; direction: 'fwd' | 'rev'; title: string;
	promptHtml: string; answerHtml: string; tags: string[]; source: string;
	state: StudyState | null;
}
export interface StudyPack {
	format: 'terms-study-pack'; version: 1; vaultId: string; title: string; exported: string;
	cards: StudyCard[]; papers: { id: string; title: string }[];
	config: { requestRetention: number; maximumInterval: number; w?: number[] };
	reviewIds: string[];
}
export interface PhoneReview {
	id: string; card: string; rating: 1 | 2 | 3 | 4; t: string;
	previous: StudyState | null; state: StudyState;
}
export interface PhoneProgress { format: 'terms-phone-progress'; version: 1; vaultId: string; reviews: PhoneReview[]; }
export function serializeStudyState(c: Card): StudyState {
	return { due:c.due.toISOString(), stability:c.stability, difficulty:c.difficulty, elapsed_days:c.elapsed_days,
		scheduled_days:c.scheduled_days, learning_steps:c.learning_steps, reps:c.reps, lapses:c.lapses, state:c.state,
		...(c.last_review ? {last_review:c.last_review.toISOString()} : {}) };
}
export function validateStudyState(value: unknown): StudyState | null {
	if (value === null) return null;
	if (!value || typeof value !== 'object') throw new Error('Invalid card progress.');
	const v = value as Record<string, unknown>;
	if (typeof v.due !== 'string' || !Number.isFinite(Date.parse(v.due)) ||
		(v.last_review !== undefined && (typeof v.last_review !== 'string' || !Number.isFinite(Date.parse(v.last_review))))) throw new Error('Invalid review date.');
	const keys = ['stability','difficulty','elapsed_days','scheduled_days','learning_steps','reps','lapses','state'] as const;
	for (const key of keys) if (typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key] < 0) throw new Error('Invalid card progress.');
	if (![0,1,2,3].includes(v.state as number) || (v.difficulty as number)>10) throw new Error('Invalid scheduling state.');
	return { due:new Date(v.due as string).toISOString(), ...Object.fromEntries(keys.map(k=>[k,v[k]])), ...(v.last_review ? {last_review:new Date(v.last_review as string).toISOString()}: {}) } as StudyState;
}
export function stateEqual(a: StudyState | null, b: StudyState | null) { return JSON.stringify(a && validateStudyState(a)) === JSON.stringify(b && validateStudyState(b)); }
export function nextStudyState(state: StudyState | null, rating: 1|2|3|4, now: Date, config: StudyPack['config']): StudyState {
	const base = state ? { ...state, due:new Date(state.due), last_review:state.last_review?new Date(state.last_review):undefined } as Card : createEmptyCard(now);
	return serializeStudyState(fsrs(generatorParameters({request_retention:config.requestRetention,maximum_interval:config.maximumInterval,w:config.w})).next(base, now, rating as Grade).card);
}
export function validatePack(value: unknown): StudyPack {
	const p = value as StudyPack;
	if (!p || p.format !== 'terms-study-pack' || p.version !== 1 || typeof p.vaultId !== 'string' || !/^[a-f0-9-]{36}$/.test(p.vaultId) || !Array.isArray(p.cards) || p.cards.length > 5000 || !Array.isArray(p.papers)) throw new Error('Choose a study pack exported from the desktop app.');
	if (typeof p.title !== 'string' || p.title.length>300 || !p.config || !Number.isFinite(p.config.requestRetention) || p.config.requestRetention<=0 || p.config.requestRetention>=1 || !Number.isFinite(p.config.maximumInterval) || p.config.maximumInterval<1 || p.config.maximumInterval>36500) throw new Error('Invalid study settings.');
	if (p.config.w !== undefined && (!Array.isArray(p.config.w) || p.config.w.length!==21 || p.config.w.some(w=>!Number.isFinite(w)))) throw new Error('Invalid scheduler weights.');
	const seen = new Set<string>();
	for (const c of p.cards) {
		if (!c || typeof c.key !== 'string' || !/^[^#/\\]+#(fwd|rev)$/.test(c.key) || seen.has(c.key) || typeof c.title !== 'string' || c.title.length>1000 || typeof c.promptHtml!=='string' || typeof c.answerHtml!=='string' || c.promptHtml.length+c.answerHtml.length>2_000_000 || !Array.isArray(c.tags) || c.tags.some(t=>typeof t!=='string'||t.length>300) || typeof c.source!=='string') throw new Error('Invalid study card.');
		seen.add(c.key); c.state=validateStudyState(c.state);
	}
	if (p.papers.length>1000 || p.papers.some(r=>!r || typeof r.id!=='string' || typeof r.title!=='string' || r.title.length>300)) throw new Error('Invalid paper collection.');
	if (!Array.isArray(p.reviewIds) || p.reviewIds.length>100000 || p.reviewIds.some(id=>typeof id!=='string'||id.length>100)) throw new Error('Invalid progress identifiers.');
	return p;
}
export function validateProgress(value: unknown): PhoneProgress {
	const p = value as PhoneProgress;
	if (!p || p.format!=='terms-phone-progress' || p.version!==1 || typeof p.vaultId!=='string' || !Array.isArray(p.reviews) || p.reviews.length>10000) throw new Error('Choose a progress file exported from the phone app.');
	const seen = new Set<string>();
	for (const r of p.reviews) {
		if (!r || typeof r.id!=='string' || !/^[a-f0-9-]{36}$/.test(r.id) || seen.has(r.id) || typeof r.card!=='string' || !/^[^#/\\]+#(fwd|rev)$/.test(r.card) || ![1,2,3,4].includes(r.rating) || typeof r.t!=='string' || !Number.isFinite(Date.parse(r.t)) || Date.parse(r.t)>Date.now()+60_000) throw new Error('Invalid phone review.');
		seen.add(r.id); r.previous=validateStudyState(r.previous); r.state=validateStudyState(r.state)!;
		if (!r.state) throw new Error('Missing phone review state.');
	}
	return p;
}
