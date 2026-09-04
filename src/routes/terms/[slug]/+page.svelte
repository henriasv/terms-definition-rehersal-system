<script lang="ts">
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { api } from '$lib/client/api';
	import ChipsInput from '$lib/components/ChipsInput.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import Rendered from '$lib/components/Rendered.svelte';
	import Tags from '$lib/components/Tags.svelte';
	import type { LintIssue } from '$lib/lint';

	let { data } = $props();

	interface Meta {
		term: string;
		aliases: string[];
		tags: string[];
		math: 'latex' | 'typst';
		reverse: boolean;
		source: string;
	}
	const fromData = (): Meta => ({
		term: data.term.term,
		aliases: [...data.term.aliases],
		tags: [...data.term.tags],
		math: data.term.math,
		reverse: data.term.reverse,
		source: data.term.source ?? ''
	});
	const snapshot = (m: Meta, b: string) => JSON.stringify({ m, b });

	let meta = $state<Meta>(untrack(fromData));
	let body = $state(untrack(() => data.body));
	let savedKey = $state(untrack(() => snapshot(fromData(), data.body)));
	let html = $state(untrack(() => data.rendered.body));
	let termHtml = $state(untrack(() => data.rendered.termHtml));
	let aliasesHtml = $state<string[]>(untrack(() => data.rendered.aliasesHtml));
	let defined = $state(untrack(() => data.term.defined));
	let issues: LintIssue[] = $state(untrack(() => data.issues));
	let previewErrors: { kind: string; message: string; line?: number }[] = $state([]);
	let busy = $state(false);
	let toast = $state('');
	let editor: CodeEditor | undefined = $state();
	let loadedSlug = untrack(() => data.term.slug);
	const dirty = $derived(snapshot(meta, body) !== savedKey);

	// Fresh server data (navigation, or reload after save) replaces local state.
	$effect(() => {
		void data.term.slug;
		void data.body;
		untrack(() => {
			meta = fromData();
			body = data.body;
			savedKey = snapshot(fromData(), data.body);
			html = data.rendered.body;
			termHtml = data.rendered.termHtml;
			aliasesHtml = data.rendered.aliasesHtml;
			defined = data.term.defined;
			issues = data.issues;
			previewErrors = [];
			loadedSlug = data.term.slug;
		});
	});

	// Leaving with unsaved edits asks first (in-app navigation and tab close alike).
	beforeNavigate(({ cancel, willUnload }) => {
		if (!dirty) return;
		if (willUnload) {
			cancel();
			return;
		}
		if (!confirm('Discard unsaved changes?')) cancel();
	});

	// Live preview, debounced; responses that arrive out of order are dropped.
	let timer: ReturnType<typeof setTimeout> | undefined;
	let mounted = false;
	let previewSeq = 0;
	$effect(() => {
		const req = { body, math: meta.math, term: meta.term, aliases: [...meta.aliases] };
		if (!mounted) {
			mounted = true;
			return;
		}
		clearTimeout(timer);
		timer = setTimeout(() => preview(req), 350);
	});
	async function preview(req: { body: string; math: 'latex' | 'typst'; term: string; aliases: string[] }) {
		const seq = ++previewSeq;
		try {
			const r = await api<{ html: string; errors: typeof previewErrors; defined: boolean; termHtml: string; aliasesHtml: string[] }>('/api/render', { method: 'POST', json: req });
			if (seq !== previewSeq) return;
			html = r.html;
			termHtml = r.termHtml;
			aliasesHtml = r.aliasesHtml;
			previewErrors = r.errors;
			defined = r.defined;
		} catch (e) {
			previewErrors = [{ kind: 'render', message: (e as Error).message }];
		}
	}

	function say(msg: string) {
		toast = msg;
		setTimeout(() => (toast = ''), 2500);
	}

	async function save() {
		if (!dirty || busy) return;
		busy = true;
		try {
			const r = await api<{ term: { slug: string }; renamed: boolean }>(`/api/terms/${loadedSlug}`, { method: 'PUT', json: { ...meta, body } });
			savedKey = snapshot(meta, body);
			if (r.renamed) {
				await goto(`/terms/${r.term.slug}`, { invalidateAll: true });
				say('Saved; file renamed');
			} else {
				await invalidateAll();
				say('Saved');
			}
		} catch (e) {
			say(`Save failed: ${(e as Error).message}`);
		} finally {
			busy = false;
		}
	}

	async function upload(files: File[]) {
		for (const file of files) {
			const fd = new FormData();
			fd.append('file', file, file.name || 'pasted.png');
			fd.append('slug', loadedSlug);
			try {
				const r = await api<{ markdown: string; reused: boolean }>('/api/assets', { method: 'POST', body: fd });
				editor?.insert(r.markdown);
				say(r.reused ? 'Asset already existed, link inserted' : 'Image saved to Assets/');
			} catch (e) {
				say(`Upload failed: ${(e as Error).message}`);
			}
		}
	}

	function onKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			save();
		}
	}
	async function remove() {
		if (!confirm(`Delete "${data.term.plain}"? The file is removed; review history stays in the log.`)) return;
		await api(`/api/terms/${loadedSlug}`, { method: 'DELETE' });
		await goto('/terms', { invalidateAll: true });
	}
	const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'never reviewed');
</script>

<svelte:head><title>{data.term.plain}</title></svelte:head>
<svelte:window onkeydown={onKey} onbeforeunload={(e) => { if (dirty) e.preventDefault(); }} />
<main class="wide fill">
	<div class="row" style="margin-bottom:0.8rem">
		<h1 style="margin:0"><Rendered html={termHtml} inline /></h1>
		{#if !defined}<span class="badge todo">to define</span>{/if}
		{#if meta.math === 'typst'}<span class="badge typst">typst</span>{/if}
		{#if dirty}<span class="badge warn">unsaved</span>{/if}
		<span class="right"></span>
		<button class="btn primary" onclick={save} disabled={!dirty || busy}>Save <kbd>⌘S</kbd></button>
		<button class="btn danger" onclick={remove}>Delete</button>
	</div>

	<section class="panel meta">
		<label class="field">Term
			<input type="text" bind:value={meta.term} />
		</label>
		<label class="field">Aliases
			<ChipsInput bind:values={meta.aliases} placeholder="other names; smiles:… draws a structure" />
		</label>
		<label class="field">Tags
			<ChipsInput bind:values={meta.tags} suggestions={data.allTags} placeholder="chemistry/surface" />
		</label>
		<label class="field">Math dialect for $…$
			<select bind:value={meta.math}><option value="latex">LaTeX (KaTeX)</option><option value="typst">typst</option></select>
		</label>
		<label class="field">Source
			<input type="text" bind:value={meta.source} placeholder="citekey, DOI or URL" />
		</label>
		<div class="foot small muted">
			<label class="check"><input type="checkbox" bind:checked={meta.reverse} /> Also ask definition → term</label>
			<span>Added {data.term.added ?? '?'}</span>
			<span class="mono" title="File on disk">{data.file}</span>
		</div>
	</section>

	{#if issues.length || previewErrors.length}
		<div class="banner issues">
			<ul class="plain issues">
				{#each issues as i (i.code + (i.line ?? '') + i.message)}
					<li><span class="badge {i.level}">{i.level}</span> {#if i.line}<span class="mono small">line {i.line}</span>{/if} {i.message} {#if i.fix}<span class="fix small">{i.fix}</span>{/if}</li>
				{/each}
				{#each previewErrors as e (e.message)}
					<li><span class="badge error">preview</span> {e.kind}: {e.message.split('\n')[0]}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="editor grow">
		<CodeEditor bind:this={editor} bind:value={body} onsave={save} onfiles={upload} linkTargets={data.linkTargets} />
		<div class="panel preview">
			{#if aliasesHtml.length}
				<p class="aliases-line small muted">{#each aliasesHtml as a, i (i)}<Rendered html={a} inline />{/each}</p>
			{/if}
			<Rendered {html} />
			<hr />
			<p class="small muted">
				<Tags tags={meta.tags} />
			</p>
			<p class="small muted">
				Cards: term → definition {fmt(data.cards.fwd)}{#if meta.reverse}; definition → term {fmt(data.cards.rev)}{/if}.
				{#if !defined}Write under <code>## Definition</code> to start reviewing this term.{/if}
			</p>
		</div>
	</div>
	{#if toast}<div class="toast">{toast}</div>{/if}
</main>
