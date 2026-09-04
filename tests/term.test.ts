import { describe, expect, it } from 'vitest';
import { getSection, joinTitle, newTermFile, parseTerm, patchTermRaw, plainName, renameInRaw, resolveTermLink, rewriteLinks, setSection, slugify, splitTitle, tagMatches, withoutSection } from '../src/lib/term.ts';

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

describe('plainName wrappers, withoutSection, rewriteLinks', () => {
	it('drops formatting commands, keeps symbols', () => {
		expect(plainName('$\\mathrm{p}K_a$ of a surface')).toBe('pK_a of a surface');
		expect(slugify('$\\mathrm{p}K_a$')).toBe('pk-a');
		expect(plainName('$\\ce{H2O}$')).toBe('H2O');
		expect(plainName('Point of zero charge (PZC)')).toBe('Point of zero charge (PZC)');
		expect(plainName('$upright(p) K_(a 1)$')).toBe('p K_a 1');
	});
	it('removes a section', () => {
		const body = '## Definition\n\nd\n\n## Notes\n\nn\n\n## Examples\n\ne\n';
		expect(withoutSection(body, 'Definition')).toBe('## Notes\n\nn\n\n## Examples\n\ne\n');
		expect(withoutSection(body, 'Notes')).toBe('## Definition\n\nd\n\n## Examples\n\ne\n');
		expect(withoutSection('## Definition\n\nd\n', 'Definition').trim()).toBe('');
	});
	it('rewrites links by old name or slug, not aliases or embeds', () => {
		const body = 'See [[Old name]], [[old-name|label]], [[Alias]] and ![[old-name.png]].';
		expect(rewriteLinks(body, { term: 'Old name', slug: 'old-name' }, 'New name')).toBe('See [[New name]], [[New name|label]], [[Alias]] and ![[old-name.png]].');
		expect(rewriteLinks('nothing', { term: 'Old name', slug: 'old-name' }, 'New name')).toBeNull();
	});
});

describe('review findings', () => {
	it('renameInRaw is safe with $ patterns and keeps the blank line', () => {
		const raw = `---\nterm: Foo\n---\n\n# Foo\n\n## Definition\n\nx\n`;
		const out = renameInRaw(raw, "$\\Delta$'s rule");
		expect(out).toContain("\n# $\\Delta$'s rule\n\n## Definition\n\nx\n");
		expect(out.split('## Definition').length).toBe(2);
	});
	it('dedupes tags and aliases', () => {
		const t = parseTerm('t', `---\nterm: T\ntags: [Chemistry, chemistry]\naliases: [ZP, zp, ZP]\n---\n`);
		expect(t.fm.tags).toEqual(['chemistry']);
		expect(t.fm.aliases).toEqual(['ZP']);
	});
	it('keeps a custom H1 and does not duplicate it', () => {
		const raw = `---\nterm: PZC\n---\n\n# Point of zero charge (PZC)\n\n## Definition\n\nx\n`;
		const t = parseTerm('pzc', raw);
		expect(splitTitle(t.body, 'PZC').title).toBeNull();
		const out = patchTermRaw(raw, { math: 'typst' }).raw;
		expect(out).toContain('# Point of zero charge (PZC)');
		expect(out.match(/^# /gm)?.length).toBe(1);
		const intro = `---\nterm: Foo\n---\n\nIntro\n\n# Foo\n\n## Definition\n\nx\n`;
		expect(patchTermRaw(intro, { tags: ['a'] }).raw.match(/^# /gm)?.length).toBe(1);
	});
	it('keeps frontmatter bytes when only the body changes, and normalises typed values otherwise', () => {
		const raw = `---\nterm: Foo\ntags: [a, b]\nadded: 2024-01-05\nsource: 2019\n---\n\n# Foo\n\n## Definition\n\nx\n`;
		const bodyOnly = patchTermRaw(raw, { body: '## Definition\n\ny\n' }).raw;
		expect(bodyOnly.startsWith('---\nterm: Foo\ntags: [a, b]\nadded: 2024-01-05\nsource: 2019\n---')).toBe(true);
		const t = parseTerm('foo', raw);
		expect(t.fm.source).toBe('2019');
		expect(t.fm.added).toBe('2024-01-05');
		const changed = parseTerm('foo', patchTermRaw(raw, { tags: ['c'], source: t.fm.source }).raw);
		expect(changed.fm.added).toBe('2024-01-05');
		expect(changed.fm.source).toBe('2019');
		expect(changed.raw).not.toContain('T00:00:00');
	});
	it('legacy smiles field becomes an alias and is dropped on save', () => {
		const raw = `---\nterm: Aspirin\nsmiles: CC(=O)O\n---\n\n# Aspirin\n\n## Definition\n\nx\n`;
		const t = parseTerm('aspirin', raw);
		expect(t.fm.aliases).toEqual(['smiles:CC(=O)O']);
		const saved = patchTermRaw(raw, { aliases: t.fm.aliases }).raw;
		expect(saved).not.toContain('smiles: CC');
		expect(saved).toContain('smiles:CC(=O)O');
	});
	it('string reverse and nested fences', () => {
		const t = parseTerm('t', '---\nterm: T\nreverse: "false"\n---\n\n## Definition\n\n````\n```\n## not a heading\n```\n````\n\n## Notes\n\nn\n');
		expect(t.fm.reverse).toBe(false);
		expect(t.notes).toBe('n');
	});
});
