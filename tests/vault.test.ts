import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { saveTerm, listTerms, readLog } from '../src/lib/server/vault.ts';

function vault(files: Record<string, string>) {
	const dir = mkdtempSync(path.join(tmpdir(), 'terms-'));
	mkdirSync(path.join(dir, 'Terms'));
	for (const [name, raw] of Object.entries(files)) writeFileSync(path.join(dir, 'Terms', name), raw);
	return dir;
}

describe('saveTerm', () => {
	it('does not move a hand-named file unless the name changed', async () => {
		const dir = vault({ 'Zeta Potential.md': '---\nterm: Zeta potential\n---\n\n# Zeta potential\n\n## Definition\n\nx\n' });
		const r = await saveTerm('Zeta Potential', { term: 'Zeta potential', tags: ['a'] }, dir);
		expect(r.renamed).toBe(false);
		expect(existsSync(path.join(dir, 'Terms', 'Zeta Potential.md'))).toBe(true);
	});
	it('renames on a real name change and repoints links without touching other frontmatter', async () => {
		const dir = vault({
			'foo.md': '---\nterm: Foo\n---\n\n# Foo\n\n## Definition\n\nx\n',
			'bar.md': '---\nterm: Bar\ntags: [k, K]\n---\n\n# Bar\n\n## Definition\n\nsee [[Foo]] and [[foo|it]]\n'
		});
		const r = await saveTerm('foo', { term: 'Foo two' }, dir);
		expect(r.renamed).toBe(true);
		expect(r.term.slug).toBe('foo-two');
		const bar = readFileSync(path.join(dir, 'Terms', 'bar.md'), 'utf8');
		expect(bar.startsWith('---\nterm: Bar\ntags: [k, K]\n---')).toBe(true);
		expect(bar).toContain('[[Foo two]] and [[Foo two|it]]');
		expect((await readLog(dir)).lines.at(-1)).toMatchObject({ event: 'rename', from: 'foo', to: 'foo-two' });
		expect((await listTerms(dir)).map((t) => t.slug).sort()).toEqual(['bar', 'foo-two']);
	});
});
