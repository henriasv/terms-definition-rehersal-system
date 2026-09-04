import { describe, expect, it } from 'vitest';
import { scanMath, sniffDialect } from '../src/lib/math.ts';
import { lintAll } from '../src/lib/lint.ts';
import { newTermFile, parseTerm } from '../src/lib/term.ts';

describe('scanMath', () => {
	it('finds inline and display', () => {
		const segs = scanMath('a $x$ b\n$$\ny\n$$\nc');
		expect(segs.map((s) => [s.kind, s.src.trim(), s.line])).toEqual([
			['inline', 'x', 1],
			['display', 'y', 2]
		]);
	});
	it('skips code and escapes', () => {
		const segs = scanMath('`$x$` and \\$5 and ```\n$y$\n```\n$z$');
		expect(segs.map((s) => s.src)).toEqual(['z']);
	});
	it('ignores money', () => {
		expect(scanMath('costs $5 and $10 each')).toEqual([]);
	});
});

describe('sniffDialect', () => {
	it('detects latex', () => {
		const s = sniffDialect('\\frac{a}{b} + x^{2}');
		expect(s.latex.length).toBeGreaterThan(0);
		expect(s.typst.length).toBe(0);
	});
	it('detects typst', () => {
		const s = sniffDialect('frac(a, b) + x^(2) + alpha');
		expect(s.typst.length).toBeGreaterThan(0);
		expect(s.latex.length).toBe(0);
	});
	it('is quiet on neutral math', () => {
		const s = sniffDialect('x^2 + y_1 = 3');
		expect(s.latex).toEqual([]);
		expect(s.typst).toEqual([]);
	});
});

describe('lint', () => {
	it('flags dialect mismatch and broken links', () => {
		const t = parseTerm('foo', newTermFile({ term: 'Foo', definition: 'Uses $frac(a, b)$ and [[Missing]] and ![[nope.png]]' }).raw);
		const issues = lintAll({ terms: [t], assets: new Set() });
		const codes = issues.map((i) => i.code);
		expect(codes).toContain('math-looks-typst');
		expect(codes).toContain('broken-link');
		expect(codes).toContain('missing-asset');
		const m = issues.find((i) => i.code === 'math-looks-typst')!;
		expect(m.line).toBeGreaterThan(5);
		expect(m.fix).toContain('math: typst');
	});
	it('accepts matching dialect', () => {
		const t = parseTerm('foo', newTermFile({ term: 'Foo', math: 'typst', definition: 'Uses $frac(a, b)$', tags: ['x'] }).raw);
		expect(lintAll({ terms: [t], assets: new Set() })).toEqual([]);
	});
});

describe('scanMath fences', () => {
	it('survives a blank line before a fence', () => {
		const t = 'a $x$ b\n\n```smiles\nCC\n```\n\nc $y$ d';
		expect(scanMath(t).map((s) => s.src)).toEqual(['x', 'y']);
	});
});

describe('orphan assets', () => {
	it('lists unreferenced assets', () => {
		const t = parseTerm('foo', newTermFile({ term: 'Foo', definition: 'see ![[used.png]]' }).raw);
		const issues = lintAll({ terms: [t], assets: new Set(['used.png', 'lost.png']) });
		expect(issues.filter((i) => i.code === 'orphan-asset').map((i) => i.asset)).toEqual(['lost.png']);
	});
});

describe('indented code blocks', () => {
	it('skips $ inside 4-space indented code after a blank line', () => {
		const t = 'text $x$\n\n    echo $HOME and $PATH\n    more $y$\n\nafter $z$';
		expect(scanMath(t).map((s) => s.src)).toEqual(['x', 'z']);
	});
	it('does not treat an indented continuation line as code', () => {
		const t = 'para line\n    still para $a$\n';
		expect(scanMath(t).map((s) => s.src)).toEqual(['a']);
	});
});
