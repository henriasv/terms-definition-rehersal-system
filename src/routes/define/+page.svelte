<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import TermWorkbench from '$lib/components/TermWorkbench.svelte';
	let { data } = $props();
	async function next() {
		// The saved term is defined now and leaves the queue by itself; keep the skip order.
		await goto(`/define${data.skip.length ? `?skip=${encodeURIComponent(data.skip.join(','))}` : ''}`, { invalidateAll: true });
	}
	async function skip() {
		if (!data.current) return;
		const skips = [...data.skip.filter((s) => s !== data.current!.term.slug), data.current.term.slug];
		// Once everything has been skipped, start the round again.
		const all = skips.length >= data.total ? [] : skips;
		await goto(`/define${all.length ? `?skip=${encodeURIComponent(all.join(','))}` : ''}`, { invalidateAll: true });
	}
</script>

<svelte:head><title>Define terms</title></svelte:head>
<main class="wide fill">
	<div class="page-title" style="align-items:baseline">
		<h2>Define terms {#if data.current}<span class="count">{data.skip.length + 1 > data.total ? data.total : data.skip.length + 1} of {data.total}</span>{/if}</h2>
		<span class="small muted">Captured terms without a definition. Write one, save, and the card joins rotation.</span>
	</div>
	{#if data.current}
		{#key data.current.term.slug}
			<TermWorkbench
				term={data.current.term}
				body={data.current.body}
				rendered={data.current.rendered}
				issues={data.current.issues}
				cards={data.current.cards}
				file={data.current.file}
				allTags={data.allTags}
				linkTargets={data.current.linkTargets}
				mode="define"
				queue={{ position: data.current.position, total: data.total }}
				onsaved={next}
				onskip={skip}
			/>
		{/key}
	{:else}
		<div class="banner">
			<p style="margin:0">Nothing left to define. Capture terms on the <a href="/">Home</a> page and they queue up here.</p>
		</div>
	{/if}
</main>
