<script lang="ts">
	import { goto } from '$app/navigation';
	import TermWorkbench from '$lib/components/TermWorkbench.svelte';
	let { data } = $props();
	const index = $derived(data.queue.findIndex((q) => q.slug === data.term.slug));
	/** The next queued term after this one, wrapping around; null when this is the only one. */
	function nextSlug(excludeCurrent: boolean): string | null {
		const others = data.queue.filter((q) => q.slug !== data.term.slug);
		if (!others.length) return null;
		const after = data.queue.slice(index + 1).find((q) => q.slug !== data.term.slug);
		return (after ?? others[0]).slug;
	}
	async function next() {
		const n = nextSlug(true);
		await goto(n ? `/define/${encodeURIComponent(n)}` : '/define', { invalidateAll: true });
	}
	async function skip() {
		const n = nextSlug(true);
		await goto(n ? `/define/${encodeURIComponent(n)}` : '/define', { invalidateAll: true });
	}
</script>

<svelte:head><title>Define · {data.term.plain}</title></svelte:head>
<main class="wide fill">
	<div class="page-title" style="align-items:baseline">
		<h2><a href="/define" style="color:inherit">Define terms</a> <span class="count">{index + 1} of {data.queue.length}</span></h2>
		<span class="small muted">Write the definition, then Save and next. Skip keeps the term in the queue.</span>
	</div>
	{#key data.term.slug}
		<TermWorkbench
			term={data.term}
			body={data.body}
			rendered={data.rendered}
			issues={data.issues}
			cards={data.cards}
			file={data.file}
			allTags={data.allTags}
			linkTargets={data.linkTargets}
			mode="define"
			queue={{ items: data.queue, current: data.term.slug }}
			onsaved={next}
			onskip={skip}
		/>
	{/key}
</main>
