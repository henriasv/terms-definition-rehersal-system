<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { api } from '$lib/client/api';
	import ChipsInput from '$lib/components/ChipsInput.svelte';
	import Rendered from '$lib/components/Rendered.svelte';
	let { data } = $props();
	let names = $state('');
	let tags = $state<string[]>([]);
	let busy = $state(false);
	let msg = $state('');

	async function add(e?: Event) {
		e?.preventDefault();
		const list = names.split('\n').map((s) => s.trim()).filter(Boolean);
		if (!list.length) return;
		busy = true;
		try {
			const r = await api<{ terms: { term: string; created: boolean }[] }>('/api/terms', { method: 'POST', json: { names: list, tags } });
			const made = r.terms.filter((t) => t.created).length;
			msg = `${made} added${made < r.terms.length ? `, ${r.terms.length - made} already existed` : ''}.`;
			names = '';
			await invalidateAll();
		} catch (err) {
			msg = (err as Error).message;
		} finally {
			busy = false;
			setTimeout(() => (msg = ''), 4000);
		}
	}
</script>

<svelte:head><title>Terms</title></svelte:head>
<main class="narrow">
	<section style="display:flex;flex-direction:column;gap:var(--space-4)">
		<div class="due-line">
			<h1><span class="n">{data.stats.due}</span> <span class="l">due now</span></h1>
			<span class="summary">{data.stats.new} new · {data.stats.reviewed} in rotation · {data.total} terms, {#if data.todo}<a href="/define" style="color:var(--color-accent-700)">{data.todo} still to define</a>{:else}all defined{/if}</span>
			<a class="btn primary big right" href="/review">Start review <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></a>
		</div>
		<div class="hr" style="margin:0"></div>
	</section>
	<section class="home-grid">
		<form style="display:flex;flex-direction:column;gap:var(--space-3)" onsubmit={add}>
			<h2 style="margin:0">Capture</h2>
			<p class="text-muted" style="font-size:13px;margin:0">One term per line. Definitions can wait; tags apply to all lines.</p>
			<textarea class="capture" bind:value={names} placeholder={'surface deprotonation constant\nzeta potential'} onkeydown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add(e); }}></textarea>
			<div style="display:flex;gap:var(--space-2);align-items:center">
				<div style="flex:1"><ChipsInput bind:values={tags} suggestions={data.allTags} placeholder="tags for all lines" /></div>
				<button class="btn primary" type="submit" disabled={busy}>Add</button>
			</div>
			{#if msg}<span class="small muted">{msg}</span>{/if}
		</form>
		<div style="display:flex;flex-direction:column;gap:var(--space-3);padding-top:var(--space-2)">
			<h6 style="margin:0">Recently added</h6>
			<div>
				{#each data.recent as t (t.slug)}
					<div class="recent-row">
						<a href="/terms/{encodeURIComponent(t.slug)}"><Rendered html={t.termHtml} inline /></a>
						{#if !t.defined}<span class="tag tag-outline">To define</span>{/if}
						<span class="date">{t.added ?? ''}</span>
					</div>
				{:else}
					<p class="small muted" style="margin:0">Nothing yet. Capture a term on the left.</p>
				{/each}
			</div>
		</div>
	</section>
</main>
