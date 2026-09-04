<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { api } from '$lib/client/api';
	import ChipsInput from '$lib/components/ChipsInput.svelte';
	import Rendered from '$lib/components/Rendered.svelte';
	import Tags from '$lib/components/Tags.svelte';
	let { data } = $props();
	let names = $state('');
	let tags = $state<string[]>([]);
	let busy = $state(false);
	let msg = $state('');

	async function add(e: SubmitEvent) {
		e.preventDefault();
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
<main>
	<div class="grid cols-2">
		<section class="panel">
			<h2>Capture</h2>
			<p class="muted small">One term per line. Definitions can wait; tags apply to all lines.</p>
			<form onsubmit={add} class="grid" style="gap:0.6rem">
				<label class="field">Terms
					<textarea bind:value={names} rows="4" placeholder="surface deprotonation constant&#10;zeta potential" onkeydown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add(e as unknown as SubmitEvent); }}></textarea>
				</label>
				<label class="field">Tags (Enter adds one; nest with /)
					<ChipsInput bind:values={tags} suggestions={data.allTags} placeholder="chemistry/surface" />
				</label>
				<div class="row">
					<button class="btn primary" type="submit" disabled={busy}>Add <kbd>⌘↵</kbd></button>
					{#if msg}<span class="small muted">{msg}</span>{/if}
				</div>
			</form>
		</section>
		<section class="panel">
			<h2>Rehearsal</h2>
			<div class="grid cols-3" style="margin:0.8rem 0 1rem">
				<div class="stat"><span class="n">{data.stats.due}</span><span class="l">due now</span></div>
				<div class="stat"><span class="n">{data.stats.new}</span><span class="l">new cards</span></div>
				<div class="stat"><span class="n">{data.stats.reviewed}</span><span class="l">cards in rotation</span></div>
			</div>
			<div class="row">
				<a class="btn primary" href="/review">Start review</a>
				<span class="small muted">{data.total} terms, {data.todo.length} still to define</span>
			</div>
		</section>
	</div>

	<div class="grid cols-2" style="margin-top:1.2rem">
		<section class="panel">
			<h2>To define <span class="muted small">({data.todo.length})</span></h2>
			{#if data.todo.length === 0}
				<p class="muted">Everything has a definition.</p>
			{:else}
				<ul class="plain list-terms">
					{#each data.todo as t (t.slug)}
						<li><a class="name" href="/terms/{t.slug}"><Rendered html={t.termHtml} inline /></a><span class="row small"><Tags tags={t.tags} /></span></li>
					{/each}
				</ul>
			{/if}
		</section>
		<section class="panel">
			<h2>Recently added</h2>
			<ul class="plain list-terms">
				{#each data.recent as t (t.slug)}
					<li><a class="name" href="/terms/{t.slug}"><Rendered html={t.termHtml} inline /></a>{#if !t.defined}<span class="badge todo">to define</span>{/if}<span class="right small muted">{t.added ?? ''}</span></li>
				{/each}
			</ul>
			<h3 style="margin-top:1.2rem">Tags</h3>
			<div class="tagcloud">
				{#each data.tags as [tag, n] (tag)}
					<a class="tag" href="/terms?tag={encodeURIComponent(tag)}">{tag}<b>{n}</b></a>
				{/each}
			</div>
		</section>
	</div>
</main>
