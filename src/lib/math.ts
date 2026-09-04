/**
 * Scanner for `$...$` and `$$...$$` math segments in Markdown, skipping code.
 * Shared by the renderer (to swap in rendered output) and the linter.
 */
export interface MathSegment {
	kind: 'inline' | 'display';
	src: string;
	start: number; // offset of opening delimiter
	end: number; // offset just past closing delimiter
	line: number; // 1-based line of the opening delimiter
}

export function scanMath(text: string): MathSegment[] {
	const out: MathSegment[] = [];
	let i = 0;
	let line = 1;
	let inFence = false;
	let fenceMark = '';
	let prevBlank = true; // start of text counts as a blank line before
	let inIndented = false;
	const n = text.length;
	while (i < n) {
		const ch = text[i];
		const atLineStart = i === 0 || text[i - 1] === '\n';
		if (atLineStart && !inFence) {
			const eol0 = text.indexOf('\n', i);
			const lineText = text.slice(i, eol0 === -1 ? n : eol0);
			const blank = lineText.trim() === '';
			const indented = /^(?: {4}|\t)/.test(lineText);
			// CommonMark indented code: 4+ spaces after a blank line (or continuing such a block).
			if (indented && (prevBlank || inIndented)) {
				inIndented = true;
				if (eol0 === -1) break;
				i = eol0 + 1;
				line++;
				prevBlank = false;
				continue;
			}
			if (!blank) inIndented = false;
			prevBlank = blank;
		}
		// Fenced code blocks: a line starting with ``` or ~~~
		if ((i === 0 || text[i - 1] === '\n') && /^[ \t]{0,3}(```|~~~)/.test(text.slice(i, i + 8))) {
			const m = /^[ \t]{0,3}(```|~~~)/.exec(text.slice(i, i + 8))!;
			if (!inFence) {
				inFence = true;
				fenceMark = m[1];
			} else if (m[1] === fenceMark) {
				inFence = false;
			}
			const eol = text.indexOf('\n', i);
			if (eol === -1) break;
			i = eol + 1;
			line++;
			continue;
		}
		if (inFence) {
			if (ch === '\n') line++;
			i++;
			continue;
		}
		if (ch === '\\') {
			i += 2;
			continue;
		}
		if (ch === '`') {
			// inline code span: match run of backticks
			let run = 0;
			while (text[i + run] === '`') run++;
			const close = text.indexOf('`'.repeat(run), i + run);
			if (close === -1) {
				i += run;
				continue;
			}
			for (let k = i; k < close + run; k++) if (text[k] === '\n') line++;
			i = close + run;
			continue;
		}
		if (ch === '$') {
			if (text[i + 1] === '$') {
				const close = text.indexOf('$$', i + 2);
				if (close !== -1) {
					const src = text.slice(i + 2, close);
					out.push({ kind: 'display', src, start: i, end: close + 2, line });
					for (const c of src) if (c === '\n') line++;
					i = close + 2;
					continue;
				}
				i += 2;
				continue;
			}
			// inline: closing $ must be on the same line and not be `$` followed by digit... keep it simple:
			const eol = text.indexOf('\n', i + 1);
			const limit = eol === -1 ? n : eol;
			let j = i + 1;
			let close = -1;
			while (j < limit) {
				if (text[j] === '\\') {
					j += 2;
					continue;
				}
				if (text[j] === '$') {
					close = j;
					break;
				}
				j++;
			}
			if (close !== -1 && close > i + 1) {
				const src = text.slice(i + 1, close);
				// Ignore money: "$5 and $10" (starts with a digit and ends in whitespace or is followed by a digit).
				const money = /^\d/.test(src) && (/\s$/.test(src) || /\d/.test(text[close + 1] ?? ''));
				if (!money) {
					out.push({ kind: 'inline', src, start: i, end: close + 1, line });
					i = close + 1;
					continue;
				}
			}
			i++;
			continue;
		}
		if (ch === '\n') line++;
		i++;
	}
	return out;
}

/**
 * Heuristic dialect detection for a math snippet.
 * Returns which dialect the snippet looks like, with the evidence.
 */
export function sniffDialect(src: string): { latex: string[]; typst: string[] } {
	const latex: string[] = [];
	const typst: string[] = [];
	for (const m of src.matchAll(/\\[a-zA-Z]+/g)) latex.push(m[0]);
	if (/[\^_]\{/.test(src)) latex.push('^{ or _{');
	if (/\\[{}]/.test(src)) latex.push('\\{');
	for (const m of src.matchAll(/\b(frac|sqrt|root|vec|mat|cases|upright|bold|italic|cal|bb|serif|sans|mono|op|lim|sum|integral|arrow|dot|hat|tilde|overline|underline|abs|norm|floor|ceil|attach|display|inline)\(/g))
		typst.push(m[0]);
	if (/[\^_]\(/.test(src)) typst.push('^( or _(');
	for (const m of src.matchAll(/\b(arrow|lt|gt|eq|dot|plus|minus|times|div|colon|angle|bracket|paren|brace)\.[a-z.]+/g))
		typst.push(m[0]);
	if (/"[^"]*"/.test(src)) typst.push('"quoted text"');
	if (/\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|chi|psi|omega|Delta|Gamma|Omega|infinity|partial|nabla)\b/.test(src) && !/\\(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|chi|psi|omega|Delta|Gamma|Omega|infty|partial|nabla)/.test(src))
		typst.push('bare Greek/symbol name');
	return { latex, typst };
}
