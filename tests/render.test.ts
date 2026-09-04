import { describe, expect, it } from 'vitest';
import { renderInline } from '../src/lib/server/render.ts';

describe('renderInline', () => {
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
