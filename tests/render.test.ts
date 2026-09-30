import { describe, expect, it } from 'vitest';
import { renderInline, renderMarkdown } from '../src/lib/server/render.ts';

describe('renderInline', () => {
	it('renders equations already saved with NotebookLM LaTeX delimiters', async () => {
		const { html, errors } = await renderMarkdown('Requires \\(\\text{Na}^+\\) and \\[x^2\\]. `\\(literal\\)`', { math: 'latex', terms: [] });
		expect(errors).toEqual([]);
		expect(html.match(/class="katex"/g)).toHaveLength(2);
		expect(html).toContain('katex-display');
		expect(html).toContain('<code>\\(literal\\)</code>');
	});
	it('renders latex math and smiles tokens, escapes the rest', async () => {
		const { html, errors } = await renderInline('Debye <length> $\\lambda_D$ smiles:CC(=O)O', 'latex');
		expect(errors).toEqual([]);
		expect(html).toContain('&lt;length&gt;');
		expect(html).toContain('class="katex"');
		expect(html).toContain('data-smiles="CC(=O)O"');
		expect(html).not.toContain('smiles:CC');
	});
	it('reports bad latex', async () => {
		const { errors } = await renderInline('$\\frac{a$', 'latex');
		expect(errors[0]?.kind).toBe('latex');
	});
});
