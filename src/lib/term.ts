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
	return [...new Set(tags.map((t) => String(t).trim().replace(/^#/, '').toLowerCase()).filter(Boolean))];
}

export function normaliseAliases(aliases: unknown): string[] {
	if (!Array.isArray(aliases)) return [];
	const seen = new Set<string>();
	return aliases
		.map((a) => String(a).trim())
		.filter((a) => a && !seen.has(a.toLowerCase()) && seen.add(a.toLowerCase()));
}

/** Frontmatter scalars as strings; YAML may have typed them (dates, numbers). */
function scalarString(v: unknown): string | undefined {
	if (v === null || v === undefined) return undefined;
	if (v instanceof Date) return v.toISOString().slice(0, 10);
	const s = String(v).trim();
	return s || undefined;
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
	let fence: { mark: string; len: number } | null = null;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
		if (f) {
			if (!fence) fence = { mark: f[1][0], len: f[1].length };
			else if (f[1][0] === fence.mark && f[1].length >= fence.len) fence = null;
		}
		const m = !fence && /^##\s+(.+?)\s*$/.exec(line);
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
	const aliases = normaliseAliases(data.aliases);
	// Files from before SMILES moved into names: surface the field as an alias so the structure still shows.
	const legacySmiles = scalarString(data.smiles);
	if (legacySmiles && !aliases.some((a) => a.toLowerCase() === `smiles:${legacySmiles.toLowerCase()}`)) aliases.push(`smiles:${legacySmiles}`);
	const fm: TermFrontmatter = {
		...data,
		term: scalarString(data.term) ?? slug,
		aliases,
		tags: normaliseTags(data.tags),
		math: data.math === 'typst' ? 'typst' : 'latex'
	};
	if (typeof data.reverse === 'boolean') fm.reverse = data.reverse;
	else if (typeof data.reverse === 'string') fm.reverse = !/^(false|no|0)$/i.test(data.reverse.trim());
	const added = scalarString(data.added);
	if (added) fm.added = added;
	const source = scalarString(data.source);
	if (source) fm.source = source;
	else delete fm.source;

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
	const data: Record<string, unknown> = { term: name };
	const aliases = normaliseAliases(input.aliases ?? []);
	const tags = normaliseTags(input.tags ?? []);
	if (aliases.length) data.aliases = aliases;
	if (tags.length) data.tags = tags;
	data.math = input.math ?? 'latex';
	data.added = input.added ?? todayISO(now);
	if (input.source) data.source = input.source.trim();
	let body = `\n# ${name}\n\n## Definition\n\n## Notes\n`;
	if (input.definition?.trim()) body = setSection(body, 'Definition', input.definition);
	const raw = matter.stringify(body, data);
	return { slug, raw };
}

/** Rewrite the `term:` field (and a matching H1) when a term is renamed. */
export function renameInRaw(raw: string, newName: string): string {
	return patchTermRaw(raw, { term: newName }).raw;
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

/** True when two names are the same term title (plain text, case-insensitive). */
export function sameTitle(a: string, b: string): boolean {
	return plainName(a).toLowerCase() === plainName(b).toLowerCase();
}

/**
 * Split a body into the canonical `# Title` line and the rest. Only an H1 at the very
 * top that matches the term name is treated as the canonical title; any other H1 is
 * content and stays in the body.
 */
export function splitTitle(body: string, term?: string): { title: string | null; rest: string } {
	const text = body.replace(/\r\n/g, '\n');
	const m = /^\s*# ([^\n]*)\n?/.exec(text);
	if (!m) return { title: null, rest: text.replace(/^\n+/, '') };
	const title = m[1].trim();
	if (term !== undefined && !sameTitle(title, term)) return { title: null, rest: text.replace(/^\n+/, '') };
	return { title, rest: text.slice(m[0].length).replace(/^\n+/, '') };
}

/** Compose the canonical body. The H1 is added only when the content has none of its own. */
export function joinTitle(title: string, rest: string): string {
	const content = rest.replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '');
	const hasH1 = /(^|\n)# \S/.test(content);
	if (hasH1) return `\n${content}\n`;
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
	// Normalised view of the existing frontmatter (dates as ISO days, no nulls) so a body-only
	// edit compares equal and the original bytes are kept.
	const before: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
		if (v === null || v === undefined) continue;
		before[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
	}
	const data: Record<string, unknown> = { ...before };
	const oldName = scalarString(before.term) ?? '';
	if (patch.term !== undefined) {
		const name = patch.term.trim();
		if (!name) throw new Error('Term name cannot be empty');
		data.term = name;
	}
	if (patch.aliases !== undefined) {
		const a = normaliseAliases(patch.aliases);
		if (a.length) data.aliases = a;
		else delete data.aliases;
		delete data.smiles; // legacy field; its value now lives in the aliases
	}
	if (patch.tags !== undefined) {
		const t = normaliseTags(patch.tags);
		if (t.length) data.tags = t;
		else delete data.tags;
	}
	if (patch.math !== undefined) data.math = patch.math === 'typst' ? 'typst' : 'latex';
	if (patch.reverse !== undefined) {
		if (patch.reverse === false) data.reverse = false;
		else delete data.reverse;
	}
	if (patch.source !== undefined) {
		const src = scalarString(patch.source);
		if (src) data.source = src;
		else delete data.source;
	}
	for (const k of Object.keys(data)) if (data[k] === null || data[k] === undefined) delete data[k];

	const title = String(data.term ?? '');
	const rest = patch.body !== undefined ? patch.body : splitTitle(parsed.content, oldName).rest;
	const body = joinTitle(title, rest);
	const slug = slugify(title);
	if (!slug) throw new Error(noSlugMessage(title));

	// Keep the frontmatter bytes untouched when nothing in it changed (YAML re-dumps reorder and requote).
	const same = JSON.stringify(data) === JSON.stringify(before);
	const fmBlock = raw.slice(0, raw.length - parsed.content.length);
	const out = same && fmBlock.trim().startsWith('---') ? fmBlock + body : matter.stringify(body, data);
	return { raw: out, slug };
}
