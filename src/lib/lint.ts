/**
 * Pure lint checks over a set of terms. Render-time errors (KaTeX, typst CLI)
 * are added by the server-side linter, which has the renderers.
 */
import { scanMath, sniffDialect } from './math.ts';
import { resolveTermLink, slugify, type Term } from './term.ts';

export type LintLevel = 'error' | 'warn' | 'info';

export interface LintIssue {
	slug: string;
	level: LintLevel;
	code: string;
	message: string;
	/** 1-based line in the term file, when known. */
	line?: number;
	fix?: string;
	/** For asset issues: the file name under Assets/. */
	asset?: string;
}

export interface LintContext {
	terms: Term[];
	/** Basenames of files present in Assets/. */
	assets: Set<string>;
}

const WIKILINK = /(!?)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

export function lintTerm(term: Term, ctx: LintContext): LintIssue[] {
	const issues: LintIssue[] = [];
	const lineOf = (bodyLine: number) => term.bodyLine + bodyLine - 1;

	if (!term.defined) {
		issues.push({ slug: term.slug, level: 'info', code: 'undefined', message: 'No definition yet; excluded from review.' });
	}
	if (!term.fm.tags?.length) {
		issues.push({ slug: term.slug, level: 'info', code: 'untagged', message: 'No tags.' });
	}
	if (term.fm.term && slugify(term.fm.term) !== term.slug) {
		issues.push({
			slug: term.slug,
			level: 'warn',
			code: 'slug-mismatch',
			message: `File "${term.slug}.md" is not the slug of "${term.fm.term}" (expected "${slugify(term.fm.term)}.md"). Everything works, but links by slug and the log key use the filename.`,
			fix: `terms rename ${term.slug} "${term.fm.term}"`
		});
	}

	// Math dialect vs content.
	for (const seg of scanMath(term.body)) {
		const sniff = sniffDialect(seg.src);
		const preview = seg.src.trim().slice(0, 40);
		if (term.math === 'latex' && sniff.typst.length && !sniff.latex.length) {
			issues.push({
				slug: term.slug,
				level: 'error',
				code: 'math-looks-typst',
				line: lineOf(seg.line),
				message: `math is "latex" but $${preview}$ looks like typst (${sniff.typst.slice(0, 3).join(', ')}).`,
				fix: 'Set `math: typst` in the frontmatter, or rewrite the snippet in LaTeX.'
			});
		} else if (term.math === 'typst' && sniff.latex.length && !sniff.typst.length) {
			issues.push({
				slug: term.slug,
				level: 'error',
				code: 'math-looks-latex',
				line: lineOf(seg.line),
				message: `math is "typst" but $${preview}$ looks like LaTeX (${sniff.latex.slice(0, 3).join(', ')}).`,
				fix: 'Set `math: latex` in the frontmatter, or rewrite the snippet in typst.'
			});
		} else if (sniff.latex.length && sniff.typst.length) {
			issues.push({
				slug: term.slug,
				level: 'warn',
				code: 'math-mixed',
				line: lineOf(seg.line),
				message: `$${preview}$ mixes LaTeX (${sniff.latex[0]}) and typst (${sniff.typst[0]}) syntax.`
			});
		}
	}

	// Links and embeds.
	const lines = term.body.split('\n');
	lines.forEach((text, idx) => {
		for (const m of text.matchAll(WIKILINK)) {
			const [, bang, target] = m;
			if (bang) {
				const file = target.trim();
				if (!ctx.assets.has(file)) {
					issues.push({ slug: term.slug, level: 'warn', code: 'missing-asset', line: lineOf(idx + 1), message: `Embedded asset "${file}" not found in Assets/.` });
				}
			} else if (!resolveTermLink(target, ctx.terms)) {
				issues.push({ slug: term.slug, level: 'warn', code: 'broken-link', line: lineOf(idx + 1), message: `[[${target.trim()}]] does not match any term, name or alias.`, fix: `terms add "${target.trim()}"` });
			}
		}
	});

	return issues;
}

/** Files in Assets/ that no term embeds. */
export function orphanAssets(ctx: LintContext): string[] {
	const used = new Set<string>();
	for (const t of ctx.terms) for (const m of t.body.matchAll(WIKILINK)) if (m[1]) used.add(m[2].trim());
	return [...ctx.assets].filter((a) => !used.has(a) && !a.startsWith('.')).sort();
}

export function lintAll(ctx: LintContext): LintIssue[] {
	const issues: LintIssue[] = [];
	for (const a of orphanAssets(ctx)) {
		issues.push({ slug: '', level: 'info', code: 'orphan-asset', asset: a, message: `Assets/${a} is not embedded by any term.`, fix: 'terms assets --prune' });
	}
	const seenNames = new Map<string, string>();
	for (const t of ctx.terms) {
		issues.push(...lintTerm(t, ctx));
		const key = t.fm.term.toLowerCase();
		if (seenNames.has(key) && seenNames.get(key) !== t.slug) {
			issues.push({ slug: t.slug, level: 'warn', code: 'duplicate-name', message: `Term name "${t.fm.term}" also used by ${seenNames.get(key)}.` });
		}
		seenNames.set(key, t.slug);
		for (const a of t.fm.aliases ?? []) {
			const hit = ctx.terms.find((o) => o.slug !== t.slug && o.fm.term.toLowerCase() === a.toLowerCase());
			if (hit) issues.push({ slug: t.slug, level: 'warn', code: 'alias-collision', message: `Alias "${a}" is the name of ${hit.slug}.` });
		}
	}
	const order: Record<LintLevel, number> = { error: 0, warn: 1, info: 2 };
	return issues.sort((a, b) => order[a.level] - order[b.level] || a.slug.localeCompare(b.slug) || (a.line ?? 0) - (b.line ?? 0));
}
