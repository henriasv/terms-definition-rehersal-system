/**
 * Review log + FSRS scheduling. Pure: takes text/objects, returns objects.
 * The log is append-only JSONL; the current state of every card is derived from it.
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type FSRSParameters, type Grade } from 'ts-fsrs';
import type { Term } from './term.ts';

export type Direction = 'fwd' | 'rev';
export type CardKey = string; // `${slug}#${Direction}`

export interface SerializedCard {
	due: string;
	stability: number;
	difficulty: number;
	elapsed_days: number;
	scheduled_days: number;
	learning_steps: number;
	reps: number;
	lapses: number;
	state: number;
	last_review?: string;
}

export interface ReviewLine {
	t: string;
	card: CardKey;
	rating: 1 | 2 | 3 | 4;
	/** Seconds the user spent before rating, when the client reports it. */
	ms?: number;
	state: SerializedCard;
}
export interface RenameLine {
	t: string;
	event: 'rename';
	from: string;
	to: string;
}
export interface ResetLine {
	t: string;
	event: 'reset';
	card: CardKey;
}
export type LogLine = ReviewLine | RenameLine | ResetLine;

export interface SchedulerConfig {
	requestRetention: number;
	maximumInterval: number;
	newPerSession: number;
	/** Cards due within this many minutes count as due (keeps learning steps inside a session). */
	lookaheadMinutes: number;
}

export const DEFAULT_CONFIG: SchedulerConfig = {
	requestRetention: 0.9,
	maximumInterval: 365,
	newPerSession: 20,
	lookaheadMinutes: 20
};

export function cardKey(slug: string, dir: Direction): CardKey {
	return `${slug}#${dir}`;
}

export function splitKey(key: CardKey): { slug: string; dir: Direction } {
	const i = key.lastIndexOf('#');
	return { slug: key.slice(0, i), dir: key.slice(i + 1) as Direction };
}

export function serializeCard(c: Card): SerializedCard {
	return {
		due: c.due.toISOString(),
		stability: c.stability,
		difficulty: c.difficulty,
		elapsed_days: c.elapsed_days,
		scheduled_days: c.scheduled_days,
		learning_steps: c.learning_steps,
		reps: c.reps,
		lapses: c.lapses,
		state: c.state,
		last_review: c.last_review ? c.last_review.toISOString() : undefined
	};
}

export function reviveCard(s: SerializedCard): Card {
	return {
		due: new Date(s.due),
		stability: s.stability,
		difficulty: s.difficulty,
		elapsed_days: s.elapsed_days,
		scheduled_days: s.scheduled_days,
		learning_steps: s.learning_steps ?? 0,
		reps: s.reps,
		lapses: s.lapses,
		state: s.state as State,
		last_review: s.last_review ? new Date(s.last_review) : undefined
	};
}

/** Parse JSONL tolerant of blank/corrupt lines (they are skipped and reported). */
export function parseLog(text: string): { lines: LogLine[]; bad: number[] } {
	const lines: LogLine[] = [];
	const bad: number[] = [];
	text.split('\n').forEach((raw, i) => {
		const s = raw.trim();
		if (!s) return;
		try {
			const obj = JSON.parse(s);
			if (obj && typeof obj.t === 'string') lines.push(obj as LogLine);
			else bad.push(i + 1);
		} catch {
			bad.push(i + 1);
		}
	});
	return { lines, bad };
}

/** Current card state per key, following renames and resets. */
export function reduceLog(lines: LogLine[]): Map<CardKey, Card> {
	const states = new Map<CardKey, Card>();
	for (const l of lines) {
		if ('event' in l) {
			if (l.event === 'rename') {
				for (const dir of ['fwd', 'rev'] as Direction[]) {
					const from = cardKey(l.from, dir);
					const to = cardKey(l.to, dir);
					const s = states.get(from);
					if (s) {
						states.delete(from);
						states.set(to, s);
					}
				}
			} else if (l.event === 'reset') {
				states.delete(l.card);
			}
			continue;
		}
		states.set(l.card, reviveCard(l.state));
	}
	return states;
}

export function makeParams(cfg: Partial<SchedulerConfig> = {}): FSRSParameters {
	const c = { ...DEFAULT_CONFIG, ...cfg };
	return generatorParameters({ request_retention: c.requestRetention, maximum_interval: c.maximumInterval, enable_fuzz: true });
}

export function gradeFromRating(r: number): Grade {
	const map: Record<number, Grade> = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy };
	const g = map[r];
	if (!g) throw new Error(`rating must be 1..4, got ${r}`);
	return g;
}

/** Apply one rating and return the log line to append plus the new state. */
export function review(current: Card | undefined, rating: 1 | 2 | 3 | 4, key: CardKey, now = new Date(), cfg?: Partial<SchedulerConfig>, ms?: number): { card: Card; line: ReviewLine } {
	const f = fsrs(makeParams(cfg));
	const base: Card = current ?? createEmptyCard<Card>(now);
	const { card } = f.next(base, now, gradeFromRating(rating));
	const line: ReviewLine = { t: now.toISOString(), card: key, rating, state: serializeCard(card) };
	if (ms !== undefined) line.ms = Math.round(ms);
	return { card, line };
}

/** Preview the due date each rating would produce. */
export function previewIntervals(current: Card | undefined, now = new Date(), cfg?: Partial<SchedulerConfig>): Record<1 | 2 | 3 | 4, string> {
	const f = fsrs(makeParams(cfg));
	const base: Card = current ?? createEmptyCard<Card>(now);
	const p = f.repeat(base, now);
	return {
		1: p[Rating.Again].card.due.toISOString(),
		2: p[Rating.Hard].card.due.toISOString(),
		3: p[Rating.Good].card.due.toISOString(),
		4: p[Rating.Easy].card.due.toISOString()
	};
}

export interface QueueItem {
	key: CardKey;
	slug: string;
	dir: Direction;
	isNew: boolean;
	due: string | null;
	state: number;
}

export function cardsForTerm(term: Term): Direction[] {
	if (!term.defined) return [];
	return term.fm.reverse === false ? ['fwd'] : ['fwd', 'rev'];
}

/** Everything reviewable now: overdue/learning cards first, then a capped batch of new cards. */
export function buildQueue(terms: Term[], states: Map<CardKey, Card>, opts: { now?: Date; tag?: string; cfg?: Partial<SchedulerConfig>; filter?: (t: Term) => boolean } = {}): { items: QueueItem[]; counts: { due: number; new: number; newTotal: number } } {
	const now = opts.now ?? new Date();
	const cfg = { ...DEFAULT_CONFIG, ...(opts.cfg ?? {}) };
	const horizon = new Date(now.getTime() + cfg.lookaheadMinutes * 60_000);
	const due: (QueueItem & { dueDate: Date })[] = [];
	const fresh: (QueueItem & { added: string })[] = [];
	for (const t of terms) {
		if (opts.filter && !opts.filter(t)) continue;
		for (const dir of cardsForTerm(t)) {
			const key = cardKey(t.slug, dir);
			const s = states.get(key);
			if (!s) {
				fresh.push({ key, slug: t.slug, dir, isNew: true, due: null, state: State.New, added: t.fm.added ?? '' });
				continue;
			}
			const learning = s.state === State.Learning || s.state === State.Relearning;
			if (s.due <= now || (learning && s.due <= horizon)) {
				due.push({ key, slug: t.slug, dir, isNew: false, due: s.due.toISOString(), state: s.state, dueDate: s.due });
			}
		}
	}
	due.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
	// Forward cards of a term before its reverse card; otherwise oldest additions first.
	fresh.sort((a, b) => a.added.localeCompare(b.added) || a.slug.localeCompare(b.slug) || (a.dir === 'fwd' ? -1 : 1));
	const newBatch = fresh.slice(0, cfg.newPerSession);
	const strip = ({ dueDate: _d, added: _a, ...rest }: QueueItem & { dueDate?: Date; added?: string }) => rest;
	return {
		items: [...due.map(strip), ...newBatch.map(strip)],
		counts: { due: due.length, new: newBatch.length, newTotal: fresh.length }
	};
}

/** Summary numbers for the dashboard. */
export function stats(terms: Term[], states: Map<CardKey, Card>, now = new Date()) {
	let due = 0,
		learning = 0,
		reviewed = 0,
		newCards = 0;
	for (const t of terms) {
		for (const dir of cardsForTerm(t)) {
			const s = states.get(cardKey(t.slug, dir));
			if (!s) {
				newCards++;
				continue;
			}
			reviewed++;
			if (s.due <= now) due++;
			if (s.state === State.Learning || s.state === State.Relearning) learning++;
		}
	}
	return { due, learning, reviewed, new: newCards };
}
