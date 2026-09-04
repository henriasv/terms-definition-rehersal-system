<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { api } from '$lib/client/api';
	import Rendered from '$lib/components/Rendered.svelte';
	import TermWorkbench from '$lib/components/TermWorkbench.svelte';

	let { data } = $props();
	let bench: TermWorkbench | undefined = $state();
	let dirty = $state(false);
	let defined = $state(untrack(() => data.term.defined));
	let termHtml = $state(untrack(() => data.rendered.termHtml));
	let toast = $state('');
	function say(msg: string) {
		toast = msg;
		setTimeout(() => (toast = ''), 2500);
	}
	async function onsaved(r: { slug: string; renamed: boolean }) {
		if (r.renamed) {
			await goto(`/terms/${encodeURIComponent(r.slug)}`, { invalidateAll: true });
			say('Saved; file renamed');
		} else {
			await invalidateAll();
			say('Saved');
		}
	}
	async function remove() {
		if (!confirm(`Delete "${data.term.plain}"? The file is removed; review history stays in the log.`)) return;
		await api(`/api/terms/${encodeURIComponent(data.term.slug)}`, { method: 'DELETE' });
		bench?.release();
		await goto('/terms', { invalidateAll: true });
	}
</script>

<svelte:head><title>{data.term.plain}</title></svelte:head>
<main class="wide fill">
	<div class="page-title">
		<h2><Rendered html={termHtml} inline /></h2>
		{#if !defined}<span class="tag tag-outline">To define</span>{/if}
		{#if dirty}<span class="tag tag-neutral">Unsaved</span>{/if}
		<div class="right row">
			<button class="btn primary" onclick={() => bench?.save()} disabled={!dirty}>Save <kbd>⌘S</kbd></button>
			<button class="btn danger" onclick={remove}>Delete</button>
		</div>
	</div>
	<TermWorkbench
		bind:this={bench}
		term={data.term}
		body={data.body}
		rendered={data.rendered}
		issues={data.issues}
		cards={data.cards}
		file={data.file}
		allTags={data.allTags}
		linkTargets={data.linkTargets}
		mode="edit"
		{onsaved}
		onstate={(s) => { dirty = s.dirty; defined = s.defined; termHtml = s.termHtml; }}
	/>
	{#if toast}<div class="toast">{toast}</div>{/if}
</main>
