/**
 * Filesystem access to the vault. Every write is tempfile + rename.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { newTermFile, parseTerm, patchTermRaw, renameInRaw, slugify, type NewTermInput, type Term, type TermPatch } from '../term.ts';
import { parseLog, reduceLog, type LogLine } from '../reviews.ts';
import { vaultPath } from './config.ts';

export const TERMS_DIR = 'Terms';
export const ASSETS_DIR = 'Assets';
export const LOG_FILE = 'reviews.jsonl';
export const CACHE_DIR = '.cache';

export class VaultError extends Error {
	constructor(
		message: string,
		public status = 400
	) {
		super(message);
	}
}

export function termsDir(vault = vaultPath()) {
	return path.join(vault, TERMS_DIR);
}
export function assetsDir(vault = vaultPath()) {
	return path.join(vault, ASSETS_DIR);
}
export function logPath(vault = vaultPath()) {
	return path.join(vault, LOG_FILE);
}
export function termPath(slug: string, vault = vaultPath()) {
	if (!/^[a-z0-9-]+$/.test(slug)) throw new VaultError(`Bad slug "${slug}"`);
	return path.join(termsDir(vault), `${slug}.md`);
}

export async function atomicWrite(file: string, data: string | Uint8Array) {
	await fs.mkdir(path.dirname(file), { recursive: true });
	const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
	await fs.writeFile(tmp, data);
	await fs.rename(tmp, file);
}

export async function vaultExists(vault = vaultPath()): Promise<boolean> {
	try {
		await fs.access(termsDir(vault));
		return true;
	} catch {
		return false;
	}
}

export async function listTerms(vault = vaultPath()): Promise<Term[]> {
	let names: string[];
	try {
		names = await fs.readdir(termsDir(vault));
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw e;
	}
	const terms = await Promise.all(
		names
			.filter((n) => n.endsWith('.md') && !n.startsWith('.'))
			.map(async (n) => parseTerm(n.slice(0, -3), await fs.readFile(path.join(termsDir(vault), n), 'utf8')))
	);
	return terms.sort((a, b) => a.fm.term.localeCompare(b.fm.term, undefined, { sensitivity: 'base' }));
}

export async function readTerm(slug: string, vault = vaultPath()): Promise<Term> {
	try {
		return parseTerm(slug, await fs.readFile(termPath(slug, vault), 'utf8'));
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new VaultError(`No term "${slug}"`, 404);
		throw e;
	}
}

export async function writeTermRaw(slug: string, raw: string, vault = vaultPath()): Promise<Term> {
	const term = parseTerm(slug, raw);
	await atomicWrite(termPath(slug, vault), raw.endsWith('\n') ? raw : raw + '\n');
	return term;
}

export async function createTerm(input: NewTermInput, vault = vaultPath()): Promise<{ term: Term; created: boolean }> {
	const { slug, raw } = newTermFile(input);
	const file = termPath(slug, vault);
	try {
		await fs.access(file);
		return { term: await readTerm(slug, vault), created: false };
	} catch {
		/* does not exist: create */
	}
	await atomicWrite(file, raw);
	return { term: parseTerm(slug, raw), created: true };
}

export async function renameTerm(slug: string, newName: string, vault = vaultPath()): Promise<Term> {
	const newSlug = slugify(newName);
	if (!newSlug) throw new VaultError(`Cannot derive a slug from "${newName}"`);
	const old = await readTerm(slug, vault);
	const raw = renameInRaw(old.raw, newName);
	if (newSlug === slug) return writeTermRaw(slug, raw, vault);
	const target = termPath(newSlug, vault);
	try {
		await fs.access(target);
		throw new VaultError(`A term with slug "${newSlug}" already exists`, 409);
	} catch (e) {
		if (e instanceof VaultError) throw e;
	}
	await atomicWrite(target, raw);
	await fs.unlink(termPath(slug, vault));
	await appendLog({ t: new Date().toISOString(), event: 'rename', from: slug, to: newSlug }, vault);
	return parseTerm(newSlug, raw);
}

/**
 * Apply UI edits. If the name changed, the file moves to the new slug and a
 * rename event is logged so review history follows.
 */
export async function saveTerm(slug: string, patch: TermPatch, vault = vaultPath()): Promise<{ term: Term; renamed: boolean }> {
	const old = await readTerm(slug, vault);
	let out: { raw: string; slug: string };
	try {
		out = patchTermRaw(old.raw, patch);
	} catch (e) {
		throw new VaultError((e as Error).message, 400);
	}
	if (out.slug === slug) {
		await atomicWrite(termPath(slug, vault), out.raw);
		return { term: parseTerm(slug, out.raw), renamed: false };
	}
	const target = termPath(out.slug, vault);
	try {
		await fs.access(target);
		throw new VaultError(`A term with slug "${out.slug}" already exists`, 409);
	} catch (e) {
		if (e instanceof VaultError) throw e;
	}
	await atomicWrite(target, out.raw);
	await fs.unlink(termPath(slug, vault));
	await appendLog({ t: new Date().toISOString(), event: 'rename', from: slug, to: out.slug }, vault);
	return { term: parseTerm(out.slug, out.raw), renamed: true };
}

export async function deleteTerm(slug: string, vault = vaultPath()): Promise<void> {
	try {
		await fs.unlink(termPath(slug, vault));
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new VaultError(`No term "${slug}"`, 404);
		throw e;
	}
}

export async function readLog(vault = vaultPath()): Promise<{ lines: LogLine[]; bad: number[] }> {
	try {
		return parseLog(await fs.readFile(logPath(vault), 'utf8'));
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { lines: [], bad: [] };
		throw e;
	}
}

export async function cardStates(vault = vaultPath()) {
	return reduceLog((await readLog(vault)).lines);
}

/** Single-line appends are atomic on POSIX for small writes; that is all we need. */
export async function appendLog(line: LogLine, vault = vaultPath()) {
	await fs.mkdir(vault, { recursive: true });
	await fs.appendFile(logPath(vault), JSON.stringify(line) + '\n');
}

export async function listAssets(vault = vaultPath()): Promise<Set<string>> {
	try {
		return new Set((await fs.readdir(assetsDir(vault))).filter((n) => !n.startsWith('.')));
	} catch {
		return new Set();
	}
}
