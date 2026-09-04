<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$lib/client/api';
	import ChipsInput from '$lib/components/ChipsInput.svelte';
	let { data } = $props();
	let term = $state(page.url.searchParams.get('name') ?? '');
	let tags = $state<string[]>([]);
	let aliases = $state<string[]>([]);
	let math = $state<'latex' | 'typst'>('latex');
	let definition = $state('');
	let err = $state('');
	async function submit(e: SubmitEvent) {
		e.preventDefault();
		try {
			const r = await api<{ terms: { slug: string }[] }>('/api/terms', { method: 'POST', json: { term, tags, aliases, math, definition } });
			await goto(`/terms/${r.terms[0].slug}`);
		} catch (x) {
			err = (x as Error).message;
		}
	}
</script>

<svelte:head><title>New term</title></svelte:head>
<main style="max-width:720px">
	<h1>New term</h1>
	<form class="panel grid" style="gap:0.8rem" onsubmit={submit}>
		<label class="field">Term <input type="text" bind:value={term} required placeholder="name; $math$ and smiles:… allowed" /></label>
		<label class="field">Aliases <ChipsInput bind:values={aliases} placeholder="other names; smiles:… draws a structure" /></label>
		<label class="field">Tags <ChipsInput bind:values={tags} suggestions={data.allTags} placeholder="chemistry/surface" /></label>
		<label class="field">Math dialect for $…$
			<select bind:value={math}><option value="latex">LaTeX (KaTeX)</option><option value="typst">typst</option></select>
		</label>
		<label class="field">Definition (optional, Markdown) <textarea rows="5" bind:value={definition}></textarea></label>
		{#if err}<div class="banner err">{err}</div>{/if}
		<div class="row"><button class="btn primary" type="submit">Create</button><a class="btn" href="/terms">Cancel</a></div>
	</form>
</main>
