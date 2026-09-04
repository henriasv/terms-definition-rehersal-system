import { describe, expect, it } from 'vitest';
import { getSection, newTermFile, parseTerm, renameInRaw, resolveTermLink, setSection, slugify, tagMatches } from '../src/lib/term.ts';

describe('slugify', () => {
	it('lowercases and dashes', () => {
		expect(slugify('Surface deprotonation constant')).toBe('surface-deprotonation-constant');
		expect(slugify('pKa (surface)')).toBe('pka-surface');
		expect(slugify('Ångström & Ørsted, ræv')).toBe('angstrom-orsted-raev');
	});
});

describe('newTermFile / parseTerm', () => {
	it('round-trips an undefined term', () => {
		const { slug, raw } = newTermFile({ term: 'Surface deprotonation constant', tags: ['#Chemistry/Surface'] }, new Date('2026-09-04T10:00:00Z'));
		expect(slug).toBe('surface-deprotonation-constant');
		const t = parseTerm(slug, raw);
		expect(t.fm.term).toBe('Surface deprotonation constant');
		expect(t.fm.tags).toEqual(['chemistry/surface']);
		expect(t.fm.added).toBe('2026-09-04');
		expect(t.math).toBe('latex');
		expect(t.defined).toBe(false);
		expect(t.body).toContain('## Definition');
	});
	it('reads definition and notes sections', () => {
		const raw = `---\nterm: Foo\nmath: typst\ntags: [a]\n---\n\n# Foo\n\n## Definition\n\nThe $x^2$ thing.\n\n## Notes\n\nnote 1\n`;
		const t = parseTerm('foo', raw);
		expect(t.definition).toBe('The $x^2$ thing.');
		expect(t.notes).toBe('note 1');
		expect(t.defined).toBe(true);
		expect(t.math).toBe('typst');
		expect(t.bodyLine).toBe(6);
	});
	it('setSection replaces and appends', () => {
		const body = `# Foo\n\n## Definition\n\nold\n\n## Notes\n\nkeep\n`;
		const out = setSection(body, 'Definition', 'new text');
		expect(getSection(out, 'Definition')).toBe('new text');
		expect(getSection(out, 'Notes')).toBe('keep');
		const appended = setSection('# Foo\n', 'Examples', 'x');
		expect(getSection(appended, 'Examples')).toBe('x');
	});
	it('ignores ## inside fences', () => {
		const body = '## Definition\n\n```\n## not a heading\n```\n\n## Notes\n';
		expect(getSection(body, 'Definition')).toContain('## not a heading');
	});
});

describe('renameInRaw', () => {
	it('updates term and H1', () => {
		const { raw } = newTermFile({ term: 'Old name' });
		const out = renameInRaw(raw, 'New name');
		const t = parseTerm('new-name', out);
		expect(t.fm.term).toBe('New name');
		expect(t.body).toContain('# New name');
		expect(t.body).not.toContain('# Old name');
	});
});

describe('links and tags', () => {
	const a = parseTerm('alpha-term', newTermFile({ term: 'Alpha term', aliases: ['α'] }).raw);
	const b = parseTerm('beta', newTermFile({ term: 'Beta' }).raw);
	it('resolves by slug, name, alias', () => {
		expect(resolveTermLink('alpha-term', [a, b])?.slug).toBe('alpha-term');
		expect(resolveTermLink('Alpha Term', [a, b])?.slug).toBe('alpha-term');
		expect(resolveTermLink('α', [a, b])?.slug).toBe('alpha-term');
		expect(resolveTermLink('gamma', [a, b])).toBeUndefined();
	});
	it('tag prefixes', () => {
		expect(tagMatches('chemistry/surface', 'chemistry')).toBe(true);
		expect(tagMatches('chemistry', 'chemistry/surface')).toBe(false);
		expect(tagMatches('chemistryx', 'chemistry')).toBe(false);
	});
});
