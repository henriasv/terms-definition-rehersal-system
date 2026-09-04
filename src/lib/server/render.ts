/**
 * Markdown → HTML for term bodies: KaTeX or typst math (per file), typst and
 * SMILES fenced blocks, Obsidian-style [[links]] and ![[embeds]].
 */
import katex from 'katex';
import { Marked, type Tokens } from 'marked';
import { scanMath } from '../math.ts';
import { SMILES_TOKEN, resolveTermLink, sameTitle, type MathDialect, type Term } from '../term.ts';
import { renderTypst } from './typst.ts';

export interface RenderError {
	kind: 'latex' | 'typst';
	src: string;
	message: string;
	/** 1-based line within the markdown passed in (plus lineOffset). */
	line?: number;
}

export interface RenderOptions {
	math: MathDialect;
	/** Known terms, for resolving [[links]]. */
	terms: Term[];
	/** Drop a leading `# Title` line when it matches this term name (cards already show the title). */
	stripTitle?: string;
	/** Added to every reported line number (e.g. the frontmatter length). */
	lineOffset?: number;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;

function esc(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface WikiToken extends Tokens.Generic {
	type: 'wikilink';
	embed: boolean;
	target: string;
	label: string;
}

function makeMarked(terms: Term[], typstBlocks: string[]) {
	const marked = new Marked({ gfm: true, breaks: false });
	marked.use({
		extensions: [
			{
				name: 'wikilink',
				level: 'inline',
				start(src: string) {
					const i = src.search(/!?\[\[/);
					return i < 0 ? undefined : i;
				},
				tokenizer(src: string): WikiToken | undefined {
					const m = /^(!?)\[\[([^\]|#]+?)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/.exec(src);
					if (!m) return undefined;
					return { type: 'wikilink', raw: m[0], embed: m[1] === '!', target: m[2].trim(), label: (m[4] ?? m[2]).trim() };
				},
				renderer(tok) {
					const t = tok as WikiToken;
					if (t.embed) {
						const url = `/assets/${encodeURIComponent(t.target)}`;
						if (IMAGE_EXT.test(t.target)) return `<img class="asset" src="${url}" alt="${esc(t.label)}" loading="lazy">`;
						return `<a class="asset-link" href="${url}" target="_blank" rel="noopener">${esc(t.label)}</a>`;
					}
					const hit = resolveTermLink(t.target, terms);
					if (hit) return `<a class="wikilink" href="/terms/${encodeURIComponent(hit.slug)}">${esc(t.label)}</a>`;
					return `<a class="wikilink broken" href="/terms/new?name=${encodeURIComponent(t.target)}" title="No such term yet">${esc(t.label)}</a>`;
				}
			}
		],
		renderer: {
			code(token: Tokens.Code) {
				const lang = (token.lang ?? '').trim().toLowerCase();
				if (lang === 'smiles') {
					return token.text
						.split('\n')
						.map((l) => l.trim())
						.filter(Boolean)
						.map((s) => `<div class="smiles" data-smiles="${esc(s)}"></div>`)
						.join('\n');
				}
				if (lang === 'typst') {
					typstBlocks.push(token.text);
					return `<div class="typst-block" data-i="${typstBlocks.length - 1}">TYPSTBLOCK${typstBlocks.length - 1}X</div>`;
				}
				return false;
			}
		}
	});
	return marked;
}

export async function renderMarkdown(md: string, opts: RenderOptions): Promise<{ html: string; errors: RenderError[] }> {
	const errors: RenderError[] = [];
	let offset = opts.lineOffset ?? 0;
	let text = md;
	if (opts.stripTitle !== undefined) {
		const m = /^\s*# ([^\n]*)\n?/.exec(text);
		if (m && sameTitle(m[1], opts.stripTitle)) {
			text = text.slice(m[0].length);
			offset += (m[0].match(/\n/g) ?? []).length;
		}
	}

	// 1. Pull math out before Markdown sees it.
	const segs = scanMath(text);
	for (let i = segs.length - 1; i >= 0; i--) {
		const s = segs[i];
		text = text.slice(0, s.start) + `MATHTOKEN${i}X` + text.slice(s.end);
	}

	// 2. Markdown.
	const typstBlocks: string[] = [];
	let html = makeMarked(opts.terms, typstBlocks).parse(text) as string;

	// 3. Render math.
	const rendered = await Promise.all(
		segs.map(async (s) => {
			if (opts.math === 'latex') {
				try {
					return katex.renderToString(s.src, { displayMode: s.kind === 'display', throwOnError: true, output: 'html' });
				} catch (e) {
					errors.push({ kind: 'latex', src: s.src, message: (e as Error).message.replace(/^KaTeX parse error: /, ''), line: s.line + offset });
					return katex.renderToString(s.src, { displayMode: s.kind === 'display', throwOnError: false, output: 'html' });
				}
			}
			const r = await renderTypst(s.src, s.kind);
			if (r.error) {
				errors.push({ kind: 'typst', src: s.src, message: r.error, line: s.line + offset });
				return `<span class="math-error" title="${esc(r.error)}">$${esc(s.src)}$</span>`;
			}
			return s.kind === 'display' ? `<div class="typst-display">${r.svg}</div>` : `<span class="typst-inline">${r.svg}</span>`;
		})
	);
	rendered.forEach((out, i) => {
		html = html.replace(`<p>MATHTOKEN${i}X</p>`, () => out).replace(`MATHTOKEN${i}X`, () => out);
	});

	// 4. Typst fenced blocks (always typst, regardless of the math flag).
	const blocks = await Promise.all(typstBlocks.map((src) => renderTypst(src, 'block')));
	blocks.forEach((r, i) => {
		const out = r.error ? `<pre class="math-error" title="${esc(r.error)}">${esc(typstBlocks[i])}</pre>` : r.svg!;
		if (r.error) errors.push({ kind: 'typst', src: typstBlocks[i], message: r.error });
		html = html.replace(`TYPSTBLOCK${i}X`, () => out);
	});

	return { html, errors };
}

/**
 * Render a name or alias: HTML-escaped text with `$…$` math (in the given dialect)
 * and `smiles:<token>` structures. No Markdown, no links.
 */
export async function renderInline(text: string, math: MathDialect): Promise<{ html: string; errors: RenderError[] }> {
	const errors: RenderError[] = [];
	// 1. SMILES tokens → placeholders (before math, so `$` inside a SMILES is impossible anyway).
	const smiles: string[] = [];
	let src = text.replace(SMILES_TOKEN, (_m, tok: string) => {
		smiles.push(tok);
		return `SMILESTOKEN${smiles.length - 1}X`;
	});
	// 2. Math → placeholders.
	const segs = scanMath(src);
	for (let i = segs.length - 1; i >= 0; i--) src = src.slice(0, segs[i].start) + `MATHTOKEN${i}X` + src.slice(segs[i].end);
	let html = esc(src);
	const rendered = await Promise.all(
		segs.map(async (s) => {
			if (math === 'latex') {
				try {
					return katex.renderToString(s.src, { displayMode: false, throwOnError: true, output: 'html' });
				} catch (e) {
					errors.push({ kind: 'latex', src: s.src, message: (e as Error).message.replace(/^KaTeX parse error: /, '') });
					return katex.renderToString(s.src, { displayMode: false, throwOnError: false, output: 'html' });
				}
			}
			const r = await renderTypst(s.src, 'inline');
			if (r.error) {
				errors.push({ kind: 'typst', src: s.src, message: r.error });
				return `<span class="math-error">$${esc(s.src)}$</span>`;
			}
			return `<span class="typst-inline">${r.svg}</span>`;
		})
	);
	rendered.forEach((out, i) => (html = html.replace(`MATHTOKEN${i}X`, () => out)));
	smiles.forEach((tok, i) => (html = html.replace(`SMILESTOKEN${i}X`, () => `<span class="smiles smiles-inline" data-smiles="${esc(tok)}" title="${esc(tok)}"></span>`)));
	return { html, errors };
}

/** Name and aliases of a term as HTML. */
export async function renderNames(term: Term) {
	const [name, ...aliases] = await Promise.all([renderInline(term.fm.term, term.math), ...(term.fm.aliases ?? []).map((a) => renderInline(a, term.math))]);
	return { termHtml: name.html, aliasesHtml: aliases.map((a) => a.html), errors: [...name.errors, ...aliases.flatMap((a) => a.errors)] };
}

/** Rendered pieces of one term for the term page and the cards. */
export async function renderTerm(term: Term, terms: Term[]) {
	const [definition, body, names] = await Promise.all([
		renderMarkdown(term.definition, { math: term.math, terms }),
		renderMarkdown(term.body, { math: term.math, terms, stripTitle: term.fm.term, lineOffset: term.bodyLine - 1 }),
		renderNames(term)
	]);
	return { definition: definition.html, body: body.html, termHtml: names.termHtml, aliasesHtml: names.aliasesHtml, errors: [...names.errors, ...body.errors] };
}
