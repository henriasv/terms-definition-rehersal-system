<script lang="ts">
	import Rendered from '$lib/components/Rendered.svelte';
	let { data } = $props();
</script>

<svelte:head><title>Define terms</title></svelte:head>
<main class="fill">
	<div class="page-title" style="align-items:baseline">
		<h2>Define terms <span class="count">{data.queue.length}</span></h2>
		<span class="small muted">Captured terms without a definition, oldest first. Pick one; Save and next walks the rest.</span>
		{#if data.queue.length}<a class="btn primary right" href="/define/{encodeURIComponent(data.queue[0].slug)}">Start from the top <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></a>{/if}
	</div>
	{#if data.queue.length === 0}
		<div class="banner"><p style="margin:0">Nothing left to define. Capture terms on the <a href="/">Home</a> page and they queue up here.</p></div>
	{:else}
		<div class="rows grow scrollable">
			{#each data.queue as t (t.slug)}
				<a class="term-row" href="/define/{encodeURIComponent(t.slug)}">
					<span class="name"><Rendered html={t.termHtml} inline /></span>
					<span class="meta">
						{#if t.aliasesHtml.length}<span class="aliases-line">{#each t.aliasesHtml as a, i (i)}<Rendered html={a} inline />{/each}</span>{/if}
						<span class="tnum">{t.added ?? ''}</span>
					</span>
					<span class="tags">{#each t.tags as g, i (`${i}:${g}`)}<span class="tag tag-neutral">{g}</span>{/each}</span>
				</a>
			{/each}
		</div>
	{/if}
</main>
