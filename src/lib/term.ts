/**
 * Pure term-file logic: parsing, serialising, slugs, sections.
 * No filesystem access here so the CLI, server and tests share it.
 */
import matter from 'gray-matter';
import { scanMath } from './math.ts';

export type MathDialect = 'latex' | 'typst';

export interface TermFrontmatter {
	term: string;
	aliases?: string[];
	tags?: string[];
	math?: MathDialect;
	reverse?: boolean;
	added?: string;
	source?: string;
	[key: string]: unknown;
}

export interface Term {
	slug: string;
	fm: TermFrontmatter;
	/** Markdown after the frontmatter block. */
	body: string;
	/** Whole file, byte-for-byte. */
	raw: string;
	definition: string;
	notes: string;
	defined: boolean;
	math: MathDialect;
	/** Line number (1-based) of the first body line in the raw file. */
	bodyLine: number;
}

export interface NewTermInput {
	term: string;
	tags?: string[];
	aliases?: string[];
	math?: MathDialect;
	source?: string;
	definition?: string;
	added?: string;
}

const CHAR_MAP: Record<string, string> = { æ: 'ae', ø: 'o', å: 'a', ß: 'ss', œ: 'oe', ð: 'd', þ: 'th' };

/** `smiles:<token>` inside a name or alias draws a structure; the token runs to the next space. */
export const SMILES_TOKEN = /smiles:(\S+)/gi;

/** LaTeX commands that only format their argument; dropped from plain names. */
const LATEX_WRAPPERS = /\\(mathrm|mathbf|mathit|mathsf|mathtt|mathcal|mathbb|mathfrak|mathscr|boldsymbol|bm|text|textrm|textbf|textit|textsf|texttt|mbox|operatorname|ce|pu|underline|overline|widehat|widetilde|hat|vec|bar|tilde|dot|ddot|left|right|displaystyle|textstyle|scriptstyle|big|Big|bigl|bigr|Bigl|Bigr)\b\s*/g;
/** typst functions that only format their argument. */
const TYPST_WRAPPERS = /\b(upright|bold|italic|sans|serif|mono|cal|bb|frak|text|op|display|inline|script|sscript)\(/g;

function plainMath(src: string): string {
	return src
		.replace(LATEX_WRAPPERS, '')
		.replace(/\\([a-zA-Z]+)(?=\\[a-zA-Z])/g, '$1 ')
		.replace(/\\([a-zA-Z]+)/g, '$1')
		.replace(TYPST_WRAPPERS, '(')
		.replace(/[{}()]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * A name or alias without rendering markup: SMILES tokens dropped, math reduced to
 * its bare symbols (`$\\mathrm{p}K_a$` → `pK_a`, `$\\lambda_D$` → `lambda_D`).
 * Used for slugs, browser titles and search.
 */
export function plainName(text: string): string {
	let out = text.replace(SMILES_TOKEN, '');
	const segs = scanMath(out);
	for (let i = segs.length - 1; i >= 0; i--) out = out.slice(0, segs[i].start) + plainMath(segs[i].src) + out.slice(segs[i].end);
	return out.replace(/\s+/g, ' ').trim();
}

/** Deterministic, filename-safe identifier derived from the term name. */
export function slugify(name: string): string {
	return plainName(name)
		.toLowerCase()
		.replace(/[æøåßœðþ]/g, (c) => CHAR_MAP[c] ?? c)
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function normaliseTags(tags: unknown): string[] {
	if (!Array.isArray(tags)) return [];
	return tags
		.map((t) => String(t).trim().replace(/^#/, '').toLowerCase())
		.filter(Boolean);
}

export function normaliseAliases(aliases: unknown): string[] {
	if (!Array.isArray(aliases)) return [];
	return aliases.map((a) => String(a).trim()).filter(Boolean);
}

interface Section {
	heading: string;
	start: number; // index of first content char after the heading line
	end: number; // index where the section content ends (exclusive)
	line: number; // 1-based line of the heading within the body
}

/** Locate `## Heading` sections in a Markdown body. */
export function findSections(body: string): Section[] {
	const lines = body.split('\n');
	const sections: Section[] = [];
	let offset = 0;
	let inFence = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
		const m = !inFence && /^##\s+(.+?)\s*$/.exec(line);
		if (m) {
			if (sections.length) sections[sections.length - 1].end = offset;
			sections.push({ heading: m[1], start: offset + line.length + 1, end: body.length, line: i + 1 });
		}
		offset += line.length + 1;
	}
	return sections;
}

export function getSection(body: string, heading: string): string {
	const s = findSections(body).find((x) => x.heading.toLowerCase() === heading.toLowerCase());
	if (!s) return '';
	return body.slice(Math.min(s.start, body.length), s.end).trim();
}

/** Replace the content of a `## Heading` section, appending the section if missing. */
export function setSection(body: string, heading: string, content: string): string {
	const s = findSections(body).find((x) => x.heading.toLowerCase() === heading.toLowerCase());
	const block = content.trim() ? `\n${content.trim()}\n\n` : '\n\n';
	if (!s) return body.replace(/\s*$/, '') + `\n\n## ${heading}` + block;
	return body.slice(0, Math.min(s.start, body.length)) + block + body.slice(s.end);
}

export function parseTerm(slug: string, raw: string): Term {
	const parsed = matter(raw);
	const data = (parsed.data ?? {}) as Record<string, unknown>;
	const fm: TermFrontmatter = {
		...data,
		term: typeof data.term === 'string' && data.term.trim() ? data.term.trim() : slug,
		aliases: normaliseAliases(data.aliases),
		tags: normaliseTags(data.tags),
		math: data.math === 'typst' ? 'typst' : 'latex'
	};
	if (typeof data.reverse === 'boolean') fm.reverse = data.reverse;
	if (data.added instanceof Date) fm.added = data.added.toISOString().slice(0, 10);
	else if (typeof data.added === 'string') fm.added = data.added;

	const body = parsed.content;
	const definition = getSection(body, 'Definition');
	const notes = getSection(body, 'Notes');
	// gray-matter strips the frontmatter; count its lines so lint can report file lines.
	const bodyLine = raw.length - body.length > 0 ? raw.slice(0, raw.length - body.length).split('\n').length : 1;
	return {
		slug,
		fm,
		body,
		raw,
		definition,
		notes,
		defined: definition.length > 0,
		math: fm.math ?? 'latex',
		bodyLine
	};
}

export function todayISO(now = new Date()): string {
	return now.toISOString().slice(0, 10);
}

/** Build the file contents for a brand-new term. */
export function newTermFile(input: NewTermInput, now = new Date()): { slug: string; raw: string } {
	const name = input.term.trim();
	const slug = slugify(name);
	if (!slug) throw new Error(noSlugMessage(name));
	const data: Record<string, unknown> = {
		term: name,
		aliases: normaliseAliases(input.aliases ?? []),
		tags: normaliseTags(input.tags ?? []),
		math: input.math ?? 'latex',
		added: input.added ?? todayISO(now)
	};
	if (input.source) data.source = input.source.trim();
	let body = `\n# ${name}\n\n## Definition\n\n## Notes\n`;
	if (input.definition?.trim()) body = setSection(body, 'Definition', input.definition);
	const raw = matter.stringify(body, data);
	return { slug, raw };
}

/** Rewrite the `term:` field (and H1) when a term is renamed. */
export function renameInRaw(raw: string, newName: string): string {
	const parsed = matter(raw);
	const data = { ...(parsed.data as Record<string, unknown>), term: newName.trim() };
	const oldName = String(parsed.data?.term ?? '');
	let body = parsed.content;
	if (oldName) body = body.replace(new RegExp(`^# ${escapeRegExp(oldName)}\\s*$`, 'm'), `# ${newName.trim()}`);
	return matter.stringify(body, data);
}

export function noSlugMessage(name: string): string {
	return `"${name}" has no plain text to build a filename from. Give the term a text name; math and smiles: tokens alone are not enough.`;
}

/** Body with one `## Heading` section (heading and content) removed. */
export function withoutSection(body: string, heading: string): string {
	const sections = findSections(body);
	const s = sections.find((x) => x.heading.toLowerCase() === heading.toLowerCase());
	if (!s) return body;
	const headingStart = body.lastIndexOf('\n', s.start - 2) + 1;
	return (body.slice(0, headingStart) + body.slice(s.end)).replace(/\n{3,}/g, '\n\n');
}

/** Everything a `[[link]]` may point at: names, aliases and slugs. */
export function linkTargets(terms: Term[]): string[] {
	const out = new Set<string>();
	for (const t of terms) {
		out.add(t.fm.term);
		for (const a of t.fm.aliases ?? []) out.add(a);
	}
	return [...out].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

const WIKILINK_ALL = /(!?)\[\[([^\]|#]+)((?:#[^\]|]*)?(?:\|[^\]]*)?)\]\]/g;

/**
 * Rewrite `[[old]]` links (by old name or old slug, case-insensitive) to the new name.
 * Aliases keep working unchanged, so they are left alone. Returns the new body or null.
 */
export function rewriteLinks(body: string, oldTerm: { term: string; slug: string }, newName: string): string | null {
	const targets = new Set([oldTerm.term.toLowerCase(), oldTerm.slug]);
	let changed = false;
	const out = body.replace(WIKILINK_ALL, (m, bang: string, target: string, tail: string) => {
		if (bang) return m;
		if (!targets.has(target.trim().toLowerCase())) return m;
		changed = true;
		return `[[${newName}${tail}]]`;
	});
	return changed ? out : null;
}

export function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when `tag` equals or sits under `prefix` (e.g. chemistry/surface under chemistry). */
export function tagMatches(tag: string, prefix: string): boolean {
	const p = prefix.toLowerCase().replace(/^#/, '');
	return tag === p || tag.startsWith(p + '/');
}

export function termHasTag(term: Term, prefix: string): boolean {
	return (term.fm.tags ?? []).some((t) => tagMatches(t, prefix));
}

/** Resolve a wikilink target against known terms: slug, name or alias, case-insensitive. */
export function resolveTermLink(target: string, terms: Term[]): Term | undefined {
	const t = target.trim();
	const lower = t.toLowerCase();
	const asSlug = slugify(t);
	return (
		terms.find((x) => x.slug === t) ??
		terms.find((x) => x.fm.term.toLowerCase() === lower) ??
		terms.find((x) => (x.fm.aliases ?? []).some((a) => a.toLowerCase() === lower)) ??
		terms.find((x) => x.slug === asSlug)
	);
}

/** Split a body into its leading `# Title` line (if any) and the rest. */
export function splitTitle(body: string): { title: string | null; rest: string } {
	const m = /^\s*# ([^\n]*)\n?/.exec(body);
	if (!m) return { title: null, rest: body.replace(/^\n+/, '') };
	return { title: m[1].trim(), rest: body.slice(m[0].length).replace(/^\n+/, '') };
}

/** Compose the canonical body: blank line, H1, blank line, content. */
export function joinTitle(title: string, rest: string): string {
	const content = rest.replace(/^\n+/, '').replace(/\s+$/, '');
	return `\n# ${title.trim()}\n\n${content}${content ? '\n' : ''}`;
}

export interface TermPatch {
	term?: string;
	aliases?: string[];
	tags?: string[];
	math?: MathDialect;
	reverse?: boolean;
	source?: string | null;
	/** Body content without the H1 line. */
	body?: string;
}

/**
 * Apply UI edits to an existing file. Unknown frontmatter fields survive; the H1
 * follows the term name. Returns the new raw text and the slug the name implies.
 */
export function patchTermRaw(raw: string, patch: TermPatch): { raw: string; slug: string } {
	const parsed = matter(raw);
	const data: Record<string, unknown> = { ...(parsed.data as Record<string, unknown>) };
	if (patch.term !== undefined) {
		const name = patch.term.trim();
		if (!name) throw new Error('Term name cannot be empty');
		data.term = name;
	}
	if (patch.aliases !== undefined) data.aliases = normaliseAliases(patch.aliases);
	if (patch.tags !== undefined) data.tags = normaliseTags(patch.tags);
	if (patch.math !== undefined) data.math = patch.math === 'typst' ? 'typst' : 'latex';
	if (patch.reverse !== undefined) {
		if (patch.reverse === false) data.reverse = false;
		else delete data.reverse;
	}
	if (patch.source !== undefined) {
		if (patch.source && patch.source.trim()) data.source = patch.source.trim();
		else delete data.source;
	}
	const title = String(data.term ?? '');
	const rest = patch.body !== undefined ? patch.body : splitTitle(parsed.content).rest;
	const body = joinTitle(title, rest);
	const slug = slugify(title);
	if (!slug) throw new Error(noSlugMessage(title));
	return { raw: matter.stringify(body, data), slug };
}
