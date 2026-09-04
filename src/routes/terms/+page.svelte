<script lang="ts">
	import { page } from '$app/state';
	import Rendered from '$lib/components/Rendered.svelte';
	let { data } = $props();
	let q = $state('');
	const tag = $derived(page.url.searchParams.get('tag') ?? '');
	const matchesTag = (tags: string[]) => !tag || tags.some((t) => t === tag || t.startsWith(tag + '/'));
	const shown = $derived(
		data.terms.filter((t) => {
			if (!matchesTag(t.tags)) return false;
			if (!q.trim()) return true;
			const s = q.toLowerCase();
			return t.plain.toLowerCase().includes(s) || t.aliases.some((a) => a.toLowerCase().includes(s)) || t.slug.includes(s);
		})
	);
</script>

<svelte:head><title>Terms · all</title></svelte:head>
<main class="fill">
	<div class="page-title">
		<h2>Terms <span class="count">{shown.length}/{data.terms.length}</span></h2>
		<div class="search">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
			<input type="search" placeholder="Search name or alias" bind:value={q} />
		</div>
		<a class="btn primary right" href="/terms/new">New term</a>
	</div>
	<div class="tagrow">
		<a class="tag" class:tag-outline={!tag} class:tag-neutral={!!tag} href="/terms">all</a>
		{#each data.tags as [t, n] (t)}
			<a class="tag" class:tag-outline={tag === t} class:tag-neutral={tag !== t} href="/terms?tag={encodeURIComponent(t)}">{t} <span class="n">{n}</span></a>
		{/each}
	</div>
	<div class="rows grow scrollable">
		{#each shown as t (t.slug)}
			<a class="term-row" href="/terms/{encodeURIComponent(t.slug)}">
				<span class="name"><Rendered html={t.termHtml} inline /></span>
				<span class="meta">
					{#if t.aliasesHtml.length}<span class="aliases-line">{#each t.aliasesHtml as a, i (i)}<Rendered html={a} inline />{/each}</span>{/if}
					{#if !t.defined}<span class="tag tag-outline">To define</span>{/if}
					{#if t.math === 'typst'}<span class="tag tag-accent">Typst</span>{/if}
				</span>
				<span class="tags">{#each t.tags as g, i (`${i}:${g}`)}<span class="tag tag-neutral">{g}</span>{/each}</span>
			</a>
		{:else}
			<p class="small muted" style="padding:var(--space-3) var(--space-2)">No terms match.</p>
		{/each}
	</div>
</main>
