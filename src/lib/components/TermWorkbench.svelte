<script lang="ts">
	/**
	 * Rail | editor | preview for one term. Used by the term page (mode "edit") and the
	 * Define queue (mode "define"). Owns the draft state, live preview and lint, image
	 * paste, and the unsaved-changes guard; the page owns the header and navigation.
	 */
	import { beforeNavigate } from '$app/navigation';
	import { untrack } from 'svelte';
	import { api } from '$lib/client/api';
	import ChipsInput from '$lib/components/ChipsInput.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import Rendered from '$lib/components/Rendered.svelte';
	import type { LintIssue } from '$lib/lint';

	interface TermData {
		slug: string;
		term: string;
		plain: string;
		aliases: string[];
		tags: string[];
		math: 'latex' | 'typst';
		reverse: boolean;
		source: string | null;
		added: string | null;
		defined: boolean;
	}
	interface Props {
		term: TermData;
		body: string;
		rendered: { body: string; termHtml: string; aliasesHtml: string[] };
		issues: LintIssue[];
		cards: { fwd: string | null; rev: string | null };
		file: string;
		allTags: string[];
		linkTargets: string[];
		mode: 'edit' | 'define';
		queue?: { items: { slug: string; termHtml: string; added: string | null }[]; current: string };
		onsaved?: (r: { slug: string; renamed: boolean }) => void;
		onskip?: () => void;
		onstate?: (s: { dirty: boolean; defined: boolean; termHtml: string }) => void;
	}
	let { term, body: initialBody, rendered, issues: initialIssues, cards, file, allTags, linkTargets, mode, queue, onsaved, onskip, onstate }: Props = $props();

	interface Meta {
		term: string;
		aliases: string[];
		tags: string[];
		math: 'latex' | 'typst';
		reverse: boolean;
		source: string;
	}
	const fromProps = (): Meta => ({ term: term.term, aliases: [...term.aliases], tags: [...term.tags], math: term.math, reverse: term.reverse, source: term.source ?? '' });
	const snapshot = (m: Meta, b: string) => JSON.stringify({ m, b });

	let meta = $state<Meta>(untrack(fromProps));
	let body = $state(untrack(() => initialBody));
	let savedKey = $state(untrack(() => snapshot(fromProps(), initialBody)));
	let html = $state(untrack(() => rendered.body));
	let termHtml = $state(untrack(() => rendered.termHtml));
	let aliasesHtml = $state<string[]>(untrack(() => rendered.aliasesHtml));
	let defined = $state(untrack(() => term.defined));
	let issues: LintIssue[] = $state(untrack(() => initialIssues));
	let previewErrors: { kind: string; message: string; line?: number }[] = $state([]);
	let addedTargets = $state<string[]>([]);
	let busy = $state(false);
	let leaving = false;
	let status = $state('Drop or paste an image to embed it. Files are saved to Assets/ and linked from the text.');
	let editor: CodeEditor | undefined = $state();
	let loadedSlug = untrack(() => term.slug);
	const dirty = $derived(snapshot(meta, body) !== savedKey);
	const completionTargets = $derived([...linkTargets, ...addedTargets]);

	// Fresh server data (navigation, or reload after save) replaces the draft.
	$effect(() => {
		void term.slug;
		void initialBody;
		untrack(() => {
			meta = fromProps();
			body = initialBody;
			savedKey = snapshot(fromProps(), initialBody);
			html = rendered.body;
			termHtml = rendered.termHtml;
			aliasesHtml = rendered.aliasesHtml;
			defined = term.defined;
			issues = initialIssues;
			previewErrors = [];
			loadedSlug = term.slug;
		});
	});
	$effect(() => {
		onstate?.({ dirty, defined, termHtml });
	});

	beforeNavigate(({ cancel, willUnload }) => {
		if (!dirty || leaving) return;
		if (willUnload) {
			cancel();
			return;
		}
		if (!confirm('Discard unsaved changes?')) cancel();
	});

	// Live preview and checks, debounced; stale responses are dropped.
	let timer: ReturnType<typeof setTimeout> | undefined;
	let mounted = false;
	let previewSeq = 0;
	const LIVE = ['math-looks-typst', 'math-looks-latex', 'math-mixed', 'broken-link', 'missing-asset'];
	$effect(() => {
		const req = { body, math: meta.math, term: meta.term, aliases: [...meta.aliases], tags: [...meta.tags], slug: loadedSlug };
		if (!mounted) {
			mounted = true;
			return;
		}
		clearTimeout(timer);
		timer = setTimeout(() => preview(req), 350);
	});
	async function preview(req: { body: string; math: 'latex' | 'typst'; term: string; aliases: string[]; tags: string[]; slug: string }) {
		const seq = ++previewSeq;
		try {
			const r = await api<{ html: string; errors: typeof previewErrors; defined: boolean; termHtml: string; aliasesHtml: string[]; issues: LintIssue[] }>('/api/render', { method: 'POST', json: req });
			if (seq !== previewSeq) return;
			issues = [...issues.filter((i) => !LIVE.includes(i.code) && !i.code.endsWith('-error')), ...r.issues];
			html = r.html;
			termHtml = r.termHtml;
			aliasesHtml = r.aliasesHtml;
			previewErrors = r.errors;
			defined = r.defined;
		} catch (e) {
			previewErrors = [{ kind: 'render', message: (e as Error).message }];
		}
	}

	/** Write the draft. Returns the server's answer or null on failure. */
	export async function save(): Promise<{ slug: string; renamed: boolean } | null> {
		if (busy) return null;
		busy = true;
		try {
			const r = await api<{ term: { slug: string }; renamed: boolean }>(`/api/terms/${encodeURIComponent(loadedSlug)}`, { method: 'PUT', json: { ...meta, body } });
			savedKey = snapshot(meta, body);
			const result = { slug: r.term.slug, renamed: r.renamed };
			leaving = true;
			onsaved?.(result);
			leaving = false;
			return result;
		} catch (e) {
			status = `Save failed: ${(e as Error).message}`;
			return null;
		} finally {
			busy = false;
		}
	}
	export function isDirty() {
		return dirty;
	}
	/** Let the page navigate away (after a delete) without the guard asking. */
	export function release() {
		leaving = true;
	}

	async function upload(files: File[]) {
		for (const f of files) {
			const fd = new FormData();
			fd.append('file', f, f.name || 'pasted.png');
			fd.append('slug', loadedSlug);
			try {
				const r = await api<{ name: string; markdown: string; reused: boolean }>('/api/assets', { method: 'POST', body: fd });
				editor?.insert(r.markdown);
				status = r.reused ? `Assets/${r.name} already existed; linked it at the cursor.` : `Saved Assets/${r.name} (${Math.max(1, Math.round(f.size / 1024))} KB) and linked it at the cursor.`;
			} catch (e) {
				status = `Upload failed: ${(e as Error).message}`;
			}
		}
	}

	/** Create the term a broken [[link]] points at, with this term's tags, and re-check. */
	async function addLinked(target: string) {
		try {
			const r = await api<{ terms: { term: string; created: boolean }[] }>('/api/terms', { method: 'POST', json: { term: target, tags: meta.tags } });
			const t = r.terms[0];
			addedTargets = [...addedTargets, t.term];
			status = t.created ? `Added “${t.term}” with this term's tags; it is waiting under Define.` : `“${t.term}” already exists.`;
			preview({ body, math: meta.math, term: meta.term, aliases: [...meta.aliases], tags: [...meta.tags], slug: loadedSlug });
		} catch (e) {
			status = `Could not add: ${(e as Error).message}`;
		}
	}

	function onKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			if (dirty) save();
		} else if (mode === 'define' && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			save();
		}
	}
	const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'never reviewed');

	/** In the Define queue, start with the cursor under `## Definition` so typing lands in the right section. */
	$effect(() => {
		// Depends only on the term (and the editor mounting), never on the draft text:
		// re-running on keystrokes would drag the cursor back after every character.
		void term.slug;
		const ed = editor;
		if (mode !== 'define' || !ed) return;
		untrack(() => {
			const m = /^##\s+Definition[^\n]*\n?/im.exec(body);
			if (!m) return;
			const pos = m.index + m[0].length;
			setTimeout(() => ed.focusAt(pos), 50);
		});
	});
</script>

<svelte:window onkeydown={onKey} onbeforeunload={(e) => { if (dirty && !leaving) e.preventDefault(); }} />

{#if issues.length || previewErrors.length}
	<div class="banner">
		<ul class="issues">
			{#each issues as i (i.code + (i.line ?? '') + i.message)}
				<li>
					<span class="tag tag-level" style="color: var(--{i.level === 'error' ? 'err' : i.level === 'warn' ? 'warn' : 'info'})">{i.level}</span>
					{#if i.line}<span class="mono small muted">line {i.line}</span>{/if}
					<span>{i.message}</span>
					{#if i.code === 'broken-link' && i.target}
						<button class="btn small primary" onclick={() => addLinked(i.target!)}>Add term “{i.target}”</button>
					{:else if i.fix}<span class="fix">{i.fix}</span>{/if}
				</li>
			{/each}
			{#each previewErrors as e (e.message)}
				<li><span class="tag tag-level" style="color: var(--err)">preview</span> {e.kind}: {e.message.split('\n')[0]}</li>
			{/each}
		</ul>
	</div>
{/if}

<div class="workbench grow">
	<aside class="rail">
		{#if mode === 'define' && queue}
			<div>
				<h6>Queue</h6>
				<div class="queue-list">
					{#each queue.items as q (q.slug)}
						{#if q.slug === queue.current}
							<div class="queue-row current"><span class="name"><Rendered html={termHtml} inline /></span><span class="date">{term.added ?? ''}</span></div>
						{:else}
							<a class="queue-row" href="/define/{encodeURIComponent(q.slug)}"><span class="name other"><Rendered html={q.termHtml} inline /></span><span class="date">{q.added ?? ''}</span></a>
						{/if}
					{/each}
				</div>
				<p class="text-muted" style="font-size:12px;margin:var(--space-2) 0 0">Add more from Capture on the Home page; they appear here until defined.</p>
			</div>
		{:else}
			<div class="field"><span class="label">Term</span><input type="text" bind:value={meta.term} /></div>
		{/if}
		<div class="field"><span class="label">Aliases</span><ChipsInput bind:values={meta.aliases} placeholder="other names, smiles:…" /></div>
		<div class="field"><span class="label">Tags</span><ChipsInput bind:values={meta.tags} suggestions={allTags} placeholder="chemistry/surface" /></div>
		<div class="field">
			<span class="label">Math dialect for $…$</span>
			<div class="seg">
				<label class="seg-opt"><input type="radio" name="math-{term.slug}" value="latex" bind:group={meta.math} />LaTeX (KaTeX)</label>
				<label class="seg-opt"><input type="radio" name="math-{term.slug}" value="typst" bind:group={meta.math} />Typst</label>
			</div>
		</div>
		<div class="field"><span class="label">Source</span><input type="text" bind:value={meta.source} placeholder="citekey, DOI or URL" /></div>
		<label class="radio"><input type="checkbox" bind:checked={meta.reverse} /><span class="dot"></span>Also ask definition → term</label>
		{#if mode === 'define'}
			<div style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:auto">
				<button class="btn primary block" onclick={save} disabled={busy || !defined}>Save and next <kbd>⌘↵</kbd></button>
				<button class="btn secondary block" onclick={() => { leaving = true; onskip?.(); leaving = false; }} disabled={busy}>Skip for now</button>
				{#if !defined}<span class="small muted">Write something under <code>## Definition</code> to enable saving.</span>{/if}
			</div>
		{:else}
			<div class="foot">
				Added {term.added ?? '?'}<br />
				Cards: term → definition {fmt(cards.fwd)};<br />{#if meta.reverse}definition → term {fmt(cards.rev)}.{:else}reverse card off.{/if}<br />
				<span class="path">{file}</span>
			</div>
		{/if}
	</aside>

	<div class="editor-col">
		<CodeEditor bind:this={editor} bind:value={body} onsave={() => { if (dirty) save(); }} onfiles={upload} linkTargets={completionTargets} placeholder={'## Definition\n…'} />
		<div class="status-line">
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path></svg>
			<span>{status}</span>
		</div>
	</div>

	<article class="preview">
		{#if mode === 'define'}
			<h3 style="margin:0;font-weight:400"><Rendered html={termHtml} inline /></h3>
		{/if}
		{#if aliasesHtml.length}
			<p class="aliases-line">{#each aliasesHtml as a, i (i)}<Rendered html={a} inline />{/each}</p>
		{/if}
		<Rendered {html} />
		<div class="foot">
			{#if meta.tags.length}<div class="tags">{#each meta.tags as t, i (`${i}:${t}`)}<span class="tag tag-neutral">{t}</span>{/each}</div>{/if}
			<div class="cards">
				{#if mode === 'define'}Cards are created on save: term → definition{#if meta.reverse}, definition → term{/if}.
				{:else if !defined}Write under <code>## Definition</code> to start reviewing this term.
				{:else}Cards: term → definition {fmt(cards.fwd)}{#if meta.reverse}; definition → term {fmt(cards.rev)}{/if}.{/if}
			</div>
		</div>
	</article>
</div>
