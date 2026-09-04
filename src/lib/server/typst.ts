/**
 * Render typst snippets to SVG with the local `typst` CLI, cached by content hash.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadConfig, vaultPath } from './config.ts';
import { CACHE_DIR, atomicWrite } from './vault.ts';

export type TypstMode = 'inline' | 'display' | 'block';

export interface TypstResult {
	svg?: string;
	error?: string;
}

/** Bump when the wrapping changes so cached SVGs are regenerated. */
const RENDER_VERSION = '2';
const PREAMBLE = `#set page(width: auto, height: auto, margin: 0pt, fill: none)\n#set text(size: 16pt)\n`;

/** Lines the wrapper puts before the snippet, per mode (for error line numbers). */
const PREAMBLE_LINES: Record<TypstMode, number> = { inline: 2, display: 2, block: 3 };

function wrap(src: string, mode: TypstMode): string {
	const s = mode === 'inline' ? src.trim() : src.replace(/^[ \t]*\n?/, '').replace(/\s+$/, '');
	// Inline: a zero-width strut 1.5em above and below the baseline makes the page 3em tall with the
	// baseline exactly in the middle (unless the snippet is taller, in which case only the top grows).
	if (mode === 'inline') return `${PREAMBLE}#box(width: 0pt, height: 3em, baseline: 1.5em)$${s}$\n`;
	if (mode === 'display') return `${PREAMBLE}$ ${s} $\n`;
	return `${PREAMBLE}#set page(margin: 4pt)\n${s}\n`;
}

let available: Promise<boolean> | undefined;
/** Memoised only on success, so installing typst later is picked up without a restart. */
export function typstAvailable(): Promise<boolean> {
	if (!available) {
		available = new Promise((resolve) => {
			execFile(loadConfig().typstBin, ['--version'], (err) => {
				if (err) available = undefined;
				resolve(!err);
			});
		});
	}
	return available;
}

function run(bin: string, input: string): Promise<TypstResult> {
	return new Promise((resolve) => {
		const child = execFile(bin, ['compile', '--format', 'svg', '-', '-'], { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
			if (err) {
				const msg = (stderr || err.message).replace(/<stdin>/g, 'snippet').trim();
				resolve({ error: msg });
			} else resolve({ svg: stdout });
		});
		child.stdin?.end(input);
	});
}

// Bounded concurrency so a page full of snippets does not fork 40 processes.
let active = 0;
const waiting: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
	if (active >= 4) await new Promise<void>((r) => waiting.push(r));
	active++;
	try {
		return await fn();
	} finally {
		active--;
		waiting.shift()?.();
	}
}

/** Shift the wrapper's preamble lines out of typst's error line numbers. */
function fixLines(msg: string, mode: TypstMode): string {
	return msg.replace(/snippet:(\d+):(\d+)/g, (_m, l, c) => `line ${Math.max(1, Number(l) - PREAMBLE_LINES[mode])}:${c}`);
}

export async function renderTypst(src: string, mode: TypstMode, vault = vaultPath()): Promise<TypstResult> {
	const key = createHash('sha256').update(RENDER_VERSION + '\0' + mode + '\0' + src).digest('hex').slice(0, 24);
	const cacheFile = path.join(vault, CACHE_DIR, 'typst', `${key}.svg`);
	try {
		return { svg: await fs.readFile(cacheFile, 'utf8') };
	} catch {
		/* miss */
	}
	if (!(await typstAvailable())) return { error: 'typst CLI not found. Install typst (https://typst.app) or set TYPST_BIN.' };
	const res = await withSlot(() => run(loadConfig(vault).typstBin, wrap(src, mode)));
	if (res.error) return { error: fixLines(res.error, mode) };
	const svg = tidySvg(res.svg!, mode);
	await atomicWrite(cacheFile, svg).catch(() => {});
	return { svg };
}

/** Size inline SVGs in em so they follow the surrounding font, and mark the mode. */
function tidySvg(svg: string, mode: TypstMode): string {
	const h = /height="([\d.]+)pt"/.exec(svg);
	const w = /width="([\d.]+)pt"/.exec(svg);
	let out = svg.replace(/<\?xml[^>]*>\s*/, '');
	if (h && w) {
		const em = Number(h[1]) / 16;
		const wem = Number(w[1]) / 16;
		out = out.replace(/width="[\d.]+pt" height="[\d.]+pt"/, `width="${wem.toFixed(3)}em" height="${em.toFixed(3)}em"`);
	}
	out = out.replace('<svg ', `<svg data-typst="${mode}" `);
	// Typst emits text in currentColor-unaware fills; let CSS take over for dark mode.
	return out.replace(/fill="#000000"/g, 'fill="currentColor"');
}
