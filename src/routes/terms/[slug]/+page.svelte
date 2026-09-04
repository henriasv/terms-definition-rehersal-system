<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { api } from '$lib/client/api';
	import ChipsInput from '$lib/components/ChipsInput.svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import Rendered from '$lib/components/Rendered.svelte';
	import Smiles from '$lib/components/Smiles.svelte';
	import Tags from '$lib/components/Tags.svelte';
	import type { LintIssue } from '$lib/lint';

	let { data } = $props();

	interface Meta {
		term: string;
		aliases: string[];
		tags: string[];
		math: 'latex' | 'typst';
		smiles: string;
		reverse: boolean;
		source: string;
	}
	const fromData = (): Meta => ({
		term: data.term.term,
		aliases: [...data.term.aliases],
		tags: [...data.term.tags],
		math: data.term.math,
		smiles: data.term.smiles ?? '',
		reverse: data.term.reverse,
		source: data.term.source ?? ''
	});
	const snapshot = (m: Meta, b: string) => JSON.stringify({ m, b });

	let meta = $state<Meta>(untrack(fromData));
	let body = $state(untrack(() => data.body));
	let savedKey = $state(untrack(() => snapshot(fromData(), data.body)));
	let html = $state(untrack(() => data.rendered.body));
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
			defined = data.term.defined;
			issues = data.issues;
			previewErrors = [];
			loadedSlug = data.term.slug;
		});
	});

	// Live preview, debounced.
	let timer: ReturnType<typeof setTimeout> | undefined;
	let mounted = false;
	$effect(() => {
		const b = body;
		const m = meta.math;
		if (!mounted) {
			mounted = true;
			return;
		}
		clearTimeout(timer);
		timer = setTimeout(() => preview(b, m), 350);
	});
	async function preview(b: string, m: 'latex' | 'typst') {
		try {
			const r = await api<{ html: string; errors: typeof previewErrors; defined: boolean }>('/api/render', { method: 'POST', json: { body: b, math: m } });
			html = r.html;
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
		if (!confirm(`Delete "${meta.term}"? The file is removed; review history stays in the log.`)) return;
		await api(`/api/terms/${loadedSlug}`, { method: 'DELETE' });
		await goto('/terms', { invalidateAll: true });
	}
	const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'never reviewed');
</script>

<svelte:head><title>{meta.term}</title></svelte:head>
<svelte:window onkeydown={onKey} />
<main class="wide">
	<div class="row" style="margin-bottom:0.8rem">
		<h1 style="margin:0">{meta.term}</h1>
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
			<ChipsInput bind:values={meta.aliases} placeholder="other names, Enter to add" />
		</label>
		<label class="field">Tags
			<ChipsInput bind:values={meta.tags} suggestions={data.allTags} placeholder="chemistry/surface" />
		</label>
		<label class="field">Math dialect for $…$
			<select bind:value={meta.math}><option value="latex">LaTeX (KaTeX)</option><option value="typst">typst</option></select>
		</label>
		<label class="field">SMILES
			<input type="text" class="mono" bind:value={meta.smiles} placeholder="OC(=O)c1ccccc1" spellcheck="false" />
		</label>
		<label class="field">Source
			<input type="text" bind:value={meta.source} placeholder="citekey, DOI or URL" />
		</label>
		<label class="check"><input type="checkbox" bind:checked={meta.reverse} /> Also ask definition → term</label>
		<div class="small muted">Added {data.term.added ?? '?'} · <span class="mono">{data.file}</span></div>
	</section>

	{#if issues.length || previewErrors.length}
		<div class="banner">
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

	<div class="editor">
		<CodeEditor bind:this={editor} bind:value={body} onsave={save} onfiles={upload} />
		<div class="panel preview">
			{#if meta.smiles.trim()}<Smiles smiles={meta.smiles.trim()} />{/if}
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
