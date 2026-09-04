<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { api } from '$lib/client/api';
	import Rendered from '$lib/components/Rendered.svelte';
	import Smiles from '$lib/components/Smiles.svelte';
	import Tags from '$lib/components/Tags.svelte';
	import type { LintIssue } from '$lib/lint';

	let { data } = $props();
	let raw = $state(untrack(() => data.term.raw));
	let saved = $state(untrack(() => data.term.raw));
	let html = $state(untrack(() => data.rendered.body));
	let issues: LintIssue[] = $state(untrack(() => data.issues));
	let previewErrors: { kind: string; message: string; line?: number }[] = $state([]);
	let smiles = $state(untrack(() => data.term.smiles));
	let busy = $state(false);
	let toast = $state('');
	let ta: HTMLTextAreaElement | undefined = $state();
	const dirty = $derived(raw !== saved);

	// Reset local state when navigating between terms.
	$effect(() => {
		raw = data.term.raw;
		saved = data.term.raw;
		html = data.rendered.body;
		issues = data.issues;
		smiles = data.term.smiles;
		previewErrors = [];
	});

	let timer: ReturnType<typeof setTimeout> | undefined;
	function schedulePreview() {
		clearTimeout(timer);
		timer = setTimeout(preview, 350);
	}
	async function preview() {
		try {
			const r = await api<{ rendered: { body: string; errors: typeof previewErrors } }>('/api/render', { method: 'POST', json: { raw, slug: data.term.slug } });
			html = r.rendered.body;
			previewErrors = r.rendered.errors;
			const m = /^smiles:\s*(.+)$/m.exec(raw.split(/^---$/m)[1] ?? '');
			smiles = m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
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
			await api(`/api/terms/${data.term.slug}`, { method: 'PUT', json: { raw } });
			saved = raw;
			await invalidateAll();
			say('Saved');
		} catch (e) {
			say(`Save failed: ${(e as Error).message}`);
		} finally {
			busy = false;
		}
	}

	async function upload(file: File) {
		const fd = new FormData();
		fd.append('file', file, file.name || 'pasted.png');
		fd.append('slug', data.term.slug);
		try {
			const r = await api<{ markdown: string; reused: boolean }>('/api/assets', { method: 'POST', body: fd });
			insertAtCursor(r.markdown);
			say(r.reused ? 'Asset already existed, link inserted' : 'Image saved to Assets/');
		} catch (e) {
			say(`Upload failed: ${(e as Error).message}`);
		}
	}
	function insertAtCursor(text: string) {
		if (!ta) return;
		const s = ta.selectionStart ?? raw.length;
		const e = ta.selectionEnd ?? s;
		const before = raw.slice(0, s);
		const pad = before.length && !before.endsWith('\n') ? '\n' : '';
		raw = before + pad + text + '\n' + raw.slice(e);
		schedulePreview();
		queueMicrotask(() => {
			ta?.focus();
			const pos = s + pad.length + text.length + 1;
			ta?.setSelectionRange(pos, pos);
		});
	}
	function onPaste(e: ClipboardEvent) {
		const items = [...(e.clipboardData?.items ?? [])].filter((i) => i.kind === 'file');
		if (!items.length) return;
		e.preventDefault();
		for (const it of items) {
			const f = it.getAsFile();
			if (f) upload(f);
		}
	}
	function onDrop(e: DragEvent) {
		const files = [...(e.dataTransfer?.files ?? [])];
		if (!files.length) return;
		e.preventDefault();
		files.forEach(upload);
	}
	function onKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			save();
		}
	}

	async function rename() {
		const name = prompt('New term name', data.term.term);
		if (!name || name === data.term.term) return;
		try {
			const r = await api<{ term: { slug: string } }>(`/api/terms/${data.term.slug}`, { method: 'PATCH', json: { rename: name } });
			await goto(`/terms/${r.term.slug}`, { invalidateAll: true });
		} catch (e) {
			say(`Rename failed: ${(e as Error).message}`);
		}
	}
	async function remove() {
		if (!confirm(`Delete "${data.term.term}"? The file is removed; review history stays in the log.`)) return;
		await api(`/api/terms/${data.term.slug}`, { method: 'DELETE' });
		await goto('/terms', { invalidateAll: true });
	}
	const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'never reviewed');
</script>

<svelte:head><title>{data.term.term}</title></svelte:head>
<svelte:window onkeydown={onKey} />
<main class="wide">
	<div class="row" style="margin-bottom:0.8rem">
		<h1 style="margin:0">{data.term.term}</h1>
		{#if !data.term.defined}<span class="badge todo">to define</span>{/if}
		{#if data.term.math === 'typst'}<span class="badge typst">typst</span>{/if}
		<Tags tags={data.term.tags} />
		<span class="right"></span>
		<button class="btn primary" onclick={save} disabled={!dirty || busy}>Save <kbd>⌘S</kbd></button>
		<button class="btn" onclick={rename}>Rename</button>
		<button class="btn danger" onclick={remove}>Delete</button>
	</div>
	<p class="small muted mono" style="margin:0 0 1rem">{data.file}</p>

	{#if issues.length || previewErrors.length}
		<div class="banner">
			<ul class="plain issues">
				{#each issues as i (i.code + (i.line ?? '') + i.message)}
					<li><span class="badge {i.level}">{i.level}</span> {#if i.line}<span class="mono small">line {i.line}</span>{/if} {i.message} {#if i.fix}<span class="fix small">{i.fix}</span>{/if}</li>
				{/each}
				{#each previewErrors as e (e.message)}
					<li><span class="badge error">preview</span> {#if e.line}<span class="mono small">line {e.line}</span>{/if} {e.kind}: {e.message.split('\n')[0]}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="editor">
		<textarea class="raw" bind:this={ta} bind:value={raw} oninput={schedulePreview} onpaste={onPaste} ondrop={onDrop} spellcheck="false"></textarea>
		<div class="panel preview">
			{#if smiles}<Smiles {smiles} />{/if}
			<Rendered {html} />
			<hr />
			<p class="small muted">
				Cards: term → definition {fmt(data.cards.fwd)}{#if data.term.reverse}; definition → term {fmt(data.cards.rev)}{/if}.
				{#if !data.term.defined}Add a definition to start reviewing this term.{/if}
			</p>
		</div>
	</div>
	{#if toast}<div class="toast">{toast}</div>{/if}
</main>
