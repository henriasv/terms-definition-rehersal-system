import { describe, expect, it } from 'vitest';
import { getSection, joinTitle, newTermFile, parseTerm, patchTermRaw, plainName, renameInRaw, resolveTermLink, setSection, slugify, splitTitle, tagMatches } from '../src/lib/term.ts';

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

describe('patchTermRaw', () => {
	const base = newTermFile({ term: 'Old name', tags: ['a'], aliases: ['x'] }).raw + 'extra: keep me\n';
	it('updates fields, keeps unknown ones, follows the H1', () => {
		const raw = `---\nterm: Old name\ntags:\n  - a\nextra: keep me\n---\n\n# Old name\n\n## Definition\n\nd\n`;
		const out = patchTermRaw(raw, { term: 'New name', tags: ['#B/c'], reverse: false, body: '## Definition\n\nnew def' });
		expect(out.slug).toBe('new-name');
		const t = parseTerm(out.slug, out.raw);
		expect(t.fm.term).toBe('New name');
		expect(t.fm.tags).toEqual(['b/c']);
		expect(t.fm.reverse).toBe(false);
		expect((t.fm as Record<string, unknown>).extra).toBe('keep me');
		expect(t.body.startsWith('\n# New name\n\n## Definition')).toBe(true);
		expect(t.definition).toBe('new def');
	});
	it('clears optional fields when emptied', () => {
		const raw = `---\nterm: T\nsmiles: CC\nreverse: false\nsource: s\n---\n\n# T\n\n## Definition\n`;
		const t = parseTerm('t', patchTermRaw(raw, { reverse: true, source: null }).raw);
		expect(t.fm.reverse).toBeUndefined();
		expect(t.fm.source).toBeUndefined();
		void base;
	});
	it('splitTitle / joinTitle round-trip', () => {
		const { title, rest } = splitTitle('\n# Foo\n\n## Definition\n\nx\n');
		expect(title).toBe('Foo');
		expect(rest).toBe('## Definition\n\nx\n');
		expect(joinTitle('Foo', rest)).toBe('\n# Foo\n\n## Definition\n\nx\n');
		expect(splitTitle('no title').title).toBeNull();
	});
});

describe('plainName', () => {
	it('drops smiles tokens and math markup', () => {
		expect(plainName('Aspirin smiles:CC(=O)Oc1ccccc1C(=O)O')).toBe('Aspirin');
		expect(plainName('Debye length $\\lambda_D$')).toBe('Debye length lambda_D');
		expect(plainName('$\\zeta$-potential')).toBe('zeta-potential');
		expect(slugify('$\\zeta$-potential')).toBe('zeta-potential');
		expect(slugify('Aspirin smiles:CC(=O)O')).toBe('aspirin');
	});
});
