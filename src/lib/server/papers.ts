import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { vaultPath } from './config.ts';
import { atomicWrite, assetsDir, createTerm, listTerms, saveTerm, VaultError } from './vault.ts';
import { parseSuggestions, type Paper, type PaperSuggestion } from '../papers.ts';
import { newTermFile, resolveTermLink, slugify, splitTitle } from '../term.ts';
import { parseTerm } from '../term.ts';
import { termPath } from './vault.ts';
import { createHash } from 'node:crypto';

const jobs = new Set<string>();
const root = process.cwd();
const python = process.env.NOTEBOOKLM_PYTHON || path.join(root, '.venv/bin/python');
const notebookEnv = () => ({ ...process.env, NOTEBOOKLM_HOME: path.join(root, 'setup/.notebooklm') });
let loginState: 'idle' | 'waiting' | 'done' | 'error' = 'idle';
export function notebookLoginState() { return loginState; }
export async function startNotebookLogin() {
	if (loginState === 'waiting') return { login: loginState };
	await fs.access(python).catch(() => { throw new VaultError('NotebookLM is not installed. Run setup/install-notebooklm.sh first.', 503); });
	let browser = 'chrome';
	try { await fs.access('/Applications/Google Chrome.app'); } catch { browser = 'chromium'; }
	const child = spawn(path.join(path.dirname(python), 'notebooklm'), ['login', '--browser', browser, '--browser-timeout', '300'], { env: notebookEnv(), stdio: 'ignore' });
	loginState = 'waiting';
	child.on('error', () => { loginState = 'error'; });
	child.on('close', code => { loginState = code === 0 ? 'done' : 'error'; });
	return { login: loginState };
}
function paperPath(id: string, vault = vaultPath()) {
	if (!/^[a-f0-9-]{36}$/.test(id)) throw new VaultError('Invalid paper identifier.');
	return path.join(vault, 'Papers', `${id}.json`);
}
export async function readPaper(id: string, vault = vaultPath()): Promise<Paper> {
	try { return JSON.parse(await fs.readFile(paperPath(id, vault), 'utf8')); }
	catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new VaultError('Paper not found.', 404); throw e; }
}
export async function listPapers(vault = vaultPath()): Promise<Paper[]> {
	let files: string[];
	try { files = await fs.readdir(path.join(vault, 'Papers')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; }
	return (await Promise.all(files.filter(f => /^[a-f0-9-]{36}\.json$/.test(f)).map(f => readPaper(f.slice(0, -5), vault)))).sort((a,b) => b.created.localeCompare(a.created));
}
async function writePaper(paper: Paper, vault = vaultPath()) { await atomicWrite(paperPath(paper.id, vault), JSON.stringify(paper, null, 2) + '\n'); }
function bridge(input: object, onData: (data: Record<string, unknown>) => Promise<void> = async () => {}): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const child = spawn(python, [path.join(root, 'scripts/notebooklm_bridge.py')], { env: notebookEnv(), stdio: ['pipe', 'pipe', 'ignore'] });
		let buffer = ''; let last: Record<string, unknown> = {}; let chain = Promise.resolve();
		const timeout = setTimeout(() => { child.kill(); reject(new VaultError('NotebookLM took too long. Check the connection and retry.', 504)); }, (input as {action?:string}).action==='status'?30_000:12 * 60_000);
		child.on('error', () => { clearTimeout(timeout); reject(new VaultError('NotebookLM is not installed. Follow the connection instructions.', 503)); });
		child.stdout.on('data', chunk => {
			buffer += chunk.toString();
			if (buffer.length > 2_000_000) { child.kill(); reject(new VaultError('NotebookLM response was too large.')); return; }
			let i: number;
			while ((i = buffer.indexOf('\n')) >= 0) {
				const line = buffer.slice(0, i); buffer = buffer.slice(i + 1);
				try { const event = JSON.parse(line); last = event; chain = chain.then(() => onData(event)); } catch { /* Ignore non-JSON library output. */ }
			}
		});
		child.on('close', code => { clearTimeout(timeout); void chain.then(() => code === 0 && !last.error ? resolve(last) : reject(new VaultError(String(last.error || 'NotebookLM is not connected. Complete the login first.'), 503))).catch(reject); });
		child.stdin.on('error', () => {});
		child.stdin.end(JSON.stringify(input));
	});
}
export async function notebookStatus() { await bridge({ action: 'status' }); return { connected: true, login: loginState }; }
export async function uploadPaper(file: File, title: string): Promise<Paper> {
	if (!file.size || file.size > 40 * 1024 * 1024) throw new VaultError('Choose a PDF under 40 MB.');
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-')) throw new VaultError('This file is not a PDF.');
	const id = randomUUID(); const asset = `paper-${id}.pdf`;
	await atomicWrite(path.join(assetsDir(), asset), bytes);
	const paper: Paper = { id, title: title.trim().slice(0, 300) || file.name.replace(/\.pdf$/i, ''), asset, created: new Date().toISOString(), status: 'processing', suggestions: [] };
	await writePaper(paper);
	void extractPaper(id);
	return paper;
}
export async function extractPaper(id: string) {
	if (jobs.has(id)) return;
	jobs.add(id);
	try {
		const paper = await readPaper(id);
		if (paper.suggestions.some(c => c.slug)) throw new VaultError('This paper already has saved cards. Upload another copy to extract a new set.');
		paper.status = 'processing'; delete paper.error; await writePaper(paper);
		try {
			const result = await bridge({ action: 'extract', title: paper.title, pdf: path.join(assetsDir(), paper.asset), notebookId: paper.notebookId }, async event => {
				if (typeof event.notebookId === 'string') { paper.notebookId = event.notebookId; await writePaper(paper); }
			});
			paper.suggestions = parseSuggestions(result.cards); paper.status = 'ready';
		} catch (e) { paper.status = 'error'; paper.error = (e as Error).message; }
		await writePaper(paper);
	} finally { jobs.delete(id); }
}
export function paperJobRunning(id: string) { return jobs.has(id); }
const saving = new Set<string>();
export async function acceptPaper(id: string, selected: PaperSuggestion[], vault = vaultPath()) {
	if (saving.has(id)) throw new VaultError('This paper is already being saved.', 409);
	saving.add(id);
	try {
		const paper = await readPaper(id, vault);
		if (paper.status !== 'ready') throw new VaultError('Wait for extraction to finish.');
		if (!Array.isArray(selected) || selected.length > 100) throw new VaultError('Invalid card selection.');
		const terms = await listTerms(vault);
		for (const input of selected) {
			const original = paper.suggestions.find(c => c.id === input.id);
			if (!original) throw new VaultError('Unknown suggestion.');
			if (original.slug) continue;
			const card = parseSuggestions([input])[0];
			const existing = card.kind === 'term' ? resolveTermLink(card.question, terms) : undefined;
			const tags = [`paper/${id}`, `study/${card.kind}`];
			let saved;
			if (existing) {
				// Linking a paper must never replace an existing definition or its source.
				saved = (await saveTerm(existing.slug, { tags: [...(existing.fm.tags ?? []), ...tags] }, vault)).term;
			} else {
				let name = card.question;
				if (terms.some(t => t.slug === slugify(name))) name += ` (${paper.title.slice(0, 80)} ${original.id})`;
				const input={ term: name, definition: card.answer, tags, source: paper.title, math: 'latex' as const };
				let created;
				if(slugify(name).length>200){
					const {slug,raw}=newTermFile(input);const short=slug.slice(0,180)+'-'+createHash('sha256').update(`${id}:${original.id}:${name}`).digest('hex').slice(0,12);
					try{await fs.access(termPath(short,vault));throw new VaultError('A card with that question already exists.',409);}catch(e){if(e instanceof VaultError)throw e;if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
					await atomicWrite(termPath(short,vault),raw);created={term:parseTerm(short,raw),created:true};
				}else created = await createTerm(input, vault);
				if (!created.created) throw new VaultError('A card with that name already exists. Edit the prompt and save again.', 409);
				const notes = `\n\n### Paper evidence\n\n${card.location ? `Location (AI suggested): ${card.location}\n\n` : ''}${card.evidence ? card.evidence.split('\n').map(l => `> ${l}`).join('\n') + '\n\n' : ''}![[${paper.asset}|Open paper]]\n\nGenerated by NotebookLM; selected for study. Check evidence against the paper.\n`;
				saved = (await saveTerm(created.term.slug, { reverse: card.kind === 'term', body: splitTitle(created.term.body, created.term.fm.term).rest + notes }, vault)).term;
				terms.push(saved);
			}
			Object.assign(original, card, { id: original.id, slug: saved.slug });
			await writePaper(paper, vault); // Every completed card remains recorded if a later write fails.
		}
		return paper;
	} finally { saving.delete(id); }
}
