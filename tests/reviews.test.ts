import { describe, expect, it } from 'vitest';
import { buildQueue, parseLog, reduceLog, review, stats } from '../src/lib/reviews.ts';
import { newTermFile, parseTerm } from '../src/lib/term.ts';

const now = new Date('2026-09-04T10:00:00Z');
const defined = parseTerm('a', newTermFile({ term: 'A', definition: 'def', added: '2026-09-01' }).raw);
const undefinedTerm = parseTerm('b', newTermFile({ term: 'B', added: '2026-09-02' }).raw);
const noReverse = parseTerm('c', `---\nterm: C\nreverse: false\nadded: 2026-09-03\n---\n\n## Definition\n\nx\n`);

describe('queue', () => {
	it('only defined terms; reverse optional', () => {
		const q = buildQueue([defined, undefinedTerm, noReverse], new Map(), { now });
		expect(q.items.map((i) => i.key)).toEqual(['a#fwd', 'a#rev', 'c#fwd']);
		expect(q.counts).toEqual({ due: 0, new: 3, newTotal: 3 });
	});
	it('caps new cards', () => {
		const q = buildQueue([defined, noReverse], new Map(), { now, cfg: { newPerSession: 1 } });
		expect(q.items.length).toBe(1);
		expect(q.counts.newTotal).toBe(3);
	});
});

describe('review + log', () => {
	it('schedules, serialises, reduces', () => {
		const r1 = review(undefined, 3, 'a#fwd', now);
		expect(new Date(r1.line.state.due).getTime()).toBeGreaterThan(now.getTime());
		const text = JSON.stringify(r1.line) + '\n' + 'garbage\n' + JSON.stringify({ t: now.toISOString(), event: 'rename', from: 'a', to: 'z' }) + '\n';
		const { lines, bad } = parseLog(text);
		expect(bad).toEqual([2]);
		const states = reduceLog(lines);
		expect(states.has('a#fwd')).toBe(false);
		expect(states.get('z#fwd')?.reps).toBe(1);
		const later = new Date(now.getTime() + 30 * 86400_000);
		const q = buildQueue([parseTerm('z', newTermFile({ term: 'Z', definition: 'd' }).raw)], states, { now: later });
		expect(q.items.find((i) => i.key === 'z#fwd')?.isNew).toBe(false);
		expect(stats([defined], new Map(), now)).toEqual({ due: 0, learning: 0, reviewed: 0, new: 2 });
	});
	it('again keeps card inside the session lookahead', () => {
		const r = review(undefined, 1, 'a#fwd', now);
		const states = reduceLog([r.line]);
		const q = buildQueue([defined], states, { now });
		expect(q.items.some((i) => i.key === 'a#fwd' && !i.isNew)).toBe(true);
	});
});
