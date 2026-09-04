#!/usr/bin/env tsx
/**
 * CLI for the terms vault. Run via `pnpm terms <command>`.
 *
 *   terms add "Name" [-t tag1,tag2] [-a alias1,alias2] [--typst] [--def "text"]
 *        aliases and names may contain $math$ and smiles:<SMILES> tokens
 *   terms list [--tag prefix] [--todo]
 *   terms todo                      terms without a definition
 *   terms due [--tag prefix]        what the review queue would show now
 *   terms lint                      static + render checks over the vault
 *   terms rename <slug> "New name"  also rewrites [[links]] in other terms
 *   terms assets [--prune]          list Assets/ files no term embeds; --prune deletes them
 *   terms optimize [--min N]        fit FSRS weights to reviews.jsonl, write them to config.json
 *   terms path                      print the vault path
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadConfig, vaultPath } from '../src/lib/server/config.ts';
import { lintVault } from '../src/lib/server/lint.ts';
import { cardStates, createTerm, deleteAsset, listAssets, listTerms, readLog, renameTerm } from '../src/lib/server/vault.ts';
import { orphanAssets } from '../src/lib/lint.ts';
import { buildQueue, trainingSet } from '../src/lib/reviews.ts';
import { termHasTag } from '../src/lib/term.ts';

const argv = process.argv.slice(2);
const cmd = argv.shift();

function opt(name: string, short?: string): string | undefined {
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === `--${name}` || (short && argv[i] === `-${short}`)) {
			const v = argv[i + 1];
			argv.splice(i, 2);
			return v;
		}
	}
	return undefined;
}
function flag(name: string): boolean {
	const i = argv.indexOf(`--${name}`);
	if (i === -1) return false;
	argv.splice(i, 1);
	return true;
}
const list = (s?: string) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);

async function main() {
	switch (cmd) {
		case 'add': {
			const tags = list(opt('tags', 't'));
			const aliases = list(opt('aliases', 'a'));
			const typst = flag('typst');
			const definition = opt('def');
			const names = argv.filter((a) => !a.startsWith('-'));
			if (!names.length) throw new Error('give at least one term name');
			for (const name of names) {
				const { term, created } = await createTerm({ term: name, tags, aliases, math: typst ? 'typst' : 'latex', definition });
				console.log(`${created ? 'added   ' : 'exists  '} ${term.slug}`);
			}
			return;
		}
		case 'list':
		case 'todo': {
			const tag = opt('tag');
			const todo = cmd === 'todo' || flag('todo');
			const terms = (await listTerms()).filter((t) => (!tag || termHasTag(t, tag)) && (!todo || !t.defined));
			for (const t of terms) console.log(`${t.defined ? ' ' : '?'} ${t.slug.padEnd(40)} ${(t.fm.tags ?? []).join(' ')}`);
			console.error(`${terms.length} term(s)`);
			return;
		}
		case 'due': {
			const tag = opt('tag');
			const [terms, states] = await Promise.all([listTerms(), cardStates()]);
			const q = buildQueue(terms, states, { cfg: loadConfig(), filter: tag ? (t) => termHasTag(t, tag) : undefined });
			for (const it of q.items) console.log(`${it.isNew ? 'new' : 'due'}  ${it.key}${it.due ? '  ' + it.due : ''}`);
			console.error(`${q.counts.due} due, ${q.counts.new} new (of ${q.counts.newTotal} unseen)`);
			return;
		}
		case 'lint': {
			const issues = await lintVault();
			for (const i of issues) {
				const loc = i.line ? `Terms/${i.slug}.md:${i.line}` : `Terms/${i.slug}.md`;
				console.log(`${i.level.padEnd(5)} ${loc}: ${i.message}${i.fix ? `\n      fix: ${i.fix}` : ''}`);
			}
			const errors = issues.filter((i) => i.level === 'error').length;
			console.error(`${issues.length} issue(s), ${errors} error(s)`);
			process.exitCode = errors ? 1 : 0;
			return;
		}
		case 'rename': {
			const [slug, name] = argv;
			if (!slug || !name) throw new Error('usage: terms rename <slug> "New name"');
			const t = await renameTerm(slug, name);
			console.log(`renamed ${slug} -> ${t.slug}`);
			return;
		}
		case 'assets': {
			const prune = flag('prune');
			const [terms, assets] = await Promise.all([listTerms(), listAssets()]);
			const orphans = orphanAssets({ terms, assets });
			for (const a of orphans) {
				if (prune) await deleteAsset(a);
				console.log(`${prune ? 'deleted ' : 'orphan  '} Assets/${a}`);
			}
			console.error(`${orphans.length} orphan asset(s)${prune ? ' deleted' : ''} of ${assets.size}`);
			return;
		}
		case 'optimize': {
			const min = Number(opt('min') ?? 200);
			const { lines } = await readLog();
			const items = trainingSet(lines);
			const reviews = items.length;
			if (reviews < min) throw new Error(`only ${reviews} repeat reviews in the log; need at least ${min} (override with --min). Keep reviewing.`);
			const { FSRS, FSRSItem, FSRSReview } = await import('fsrs-rs-nodejs');
			const trainSet = items.map((it) => new FSRSItem(it.map((r) => new FSRSReview(r.rating, r.deltaT))));
			console.error(`fitting FSRS weights to ${reviews} repeat reviews...`);
			let w: number[];
			try {
				w = await new FSRS().computeParameters(trainSet, { enableShortTerm: true });
			} catch (e) {
				const msg = String((e as Error).message ?? e);
				if (/NotEnoughData/.test(msg)) throw new Error('the optimiser needs more history than this (NotEnoughData). Keep reviewing and try again later.');
				throw e;
			}
			const file = path.join(vaultPath(), 'config.json');
			let cfg: Record<string, unknown> = {};
			try {
				cfg = JSON.parse(await fs.readFile(file, 'utf8'));
			} catch {
				/* no config yet */
			}
			cfg.w = w.map((x) => Number(x.toFixed(4)));
			cfg.optimizedAt = new Date().toISOString();
			await fs.writeFile(file, JSON.stringify(cfg, null, 2) + '\n');
			console.log(`wrote ${cfg.w.length} weights to ${file}`);
			return;
		}
		case 'path':
			console.log(vaultPath());
			return;
		default:
			console.log(`usage: terms <add|list|todo|due|lint|rename|assets|optimize|path> ...\nvault: ${vaultPath()}`);
			process.exitCode = cmd ? 1 : 0;
	}
}

main().catch((e) => {
	console.error(`error: ${(e as Error).message}`);
	process.exit(1);
});
