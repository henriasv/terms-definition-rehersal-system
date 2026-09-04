<script lang="ts">
	import { page } from '$app/state';
	import Rendered from '$lib/components/Rendered.svelte';
	import Tags from '$lib/components/Tags.svelte';
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
	<div class="row" style="margin-bottom:1rem">
		<h1 style="margin:0">Terms <span class="muted small">{shown.length}/{data.terms.length}</span></h1>
		<input class="right" type="search" placeholder="Search name or alias" bind:value={q} style="min-width:16rem" />
		<a class="btn primary" href="/terms/new">New term</a>
	</div>
	<div class="row" style="margin-bottom:1rem">
		<a class="tag" href="/terms" aria-current={!tag ? 'page' : undefined} style={!tag ? 'border-color:var(--fg);color:var(--fg)' : ''}>all</a>
		{#each data.tags as [t, n] (t)}
			<a class="tag" href="/terms?tag={encodeURIComponent(t)}" style={tag === t ? 'border-color:var(--fg);color:var(--fg)' : ''}>{t} <b>{n}</b></a>
		{/each}
	</div>
	<ul class="plain list-terms panel grow scrollable">
		{#each shown as t (t.slug)}
			<li>
				<a class="name" href="/terms/{encodeURIComponent(t.slug)}"><Rendered html={t.termHtml} inline /></a>
				{#if t.aliasesHtml.length}<span class="muted small aliases-line">{#each t.aliasesHtml as a, i (i)}<Rendered html={a} inline />{/each}</span>{/if}
				{#if !t.defined}<span class="badge todo">to define</span>{/if}
				{#if t.math === 'typst'}<span class="badge typst">typst</span>{/if}
				<span class="right row small"><Tags tags={t.tags} /></span>
			</li>
		{:else}
			<li class="muted">No terms match.</li>
		{/each}
	</ul>
</main>
