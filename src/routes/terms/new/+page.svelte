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
			await goto(`/terms/${encodeURIComponent(r.terms[0].slug)}`);
		} catch (x) {
			err = (x as Error).message;
		}
	}
</script>

<svelte:head><title>New term</title></svelte:head>
<main class="narrow">
	<h2 style="margin:0">New term</h2>
	<form style="display:flex;flex-direction:column;gap:var(--space-4);max-width:560px" onsubmit={submit}>
		<div class="field"><span class="label">Term</span><input type="text" bind:value={term} required placeholder="name; $math$ and smiles:… allowed" /></div>
		<div class="field"><span class="label">Aliases</span><ChipsInput bind:values={aliases} placeholder="other names, smiles:…" /></div>
		<div class="field"><span class="label">Tags</span><ChipsInput bind:values={tags} suggestions={data.allTags} placeholder="chemistry/surface" /></div>
		<div class="field">
			<span class="label">Math dialect for $…$</span>
			<div class="seg">
				<label class="seg-opt"><input type="radio" name="math" value="latex" bind:group={math} />LaTeX (KaTeX)</label>
				<label class="seg-opt"><input type="radio" name="math" value="typst" bind:group={math} />Typst</label>
			</div>
		</div>
		<div class="field"><span class="label">Definition (optional, Markdown)</span><textarea rows="5" bind:value={definition}></textarea></div>
		{#if err}<div class="banner err">{err}</div>{/if}
		<div class="row"><button class="btn primary" type="submit">Create</button><a class="btn secondary" href="/terms">Cancel</a></div>
	</form>
</main>
