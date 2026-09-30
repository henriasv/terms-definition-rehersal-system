<script lang="ts">
	import { untrack } from 'svelte';
	import { api } from '$lib/client/api';
	import type { Paper, PaperSuggestion } from '$lib/papers';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	let { data } = $props();
	let paper: Paper = $state(untrack(()=>structuredClone(data.paper))); let running = $state(untrack(()=>data.running));
	let busy = $state(false); let error = $state(''); let saved = $state('');
	const selected = $derived(paper.suggestions.filter(c => c.selected && !c.slug));
	$effect(() => {
		paper=structuredClone(data.paper);running=data.running;error='';saved='';
		let stopped = false; let timer: ReturnType<typeof setTimeout>;
		async function poll() {
			if (paper.status !== 'processing' || stopped) return;
			try { const r = await api<{paper: Paper; running: boolean}>(`/api/papers/${paper.id}`); if (!stopped) { paper = r.paper; running = r.running; } } catch (e) { error = (e as Error).message; }
			if (!stopped) timer = setTimeout(poll, 2500);
		}
		timer = setTimeout(poll, 1000);
		return () => { stopped = true; clearTimeout(timer); };
	});
	async function retry() {
		busy = true; error = '';
		try { await api(`/api/papers/${paper.id}`, {method:'POST', json:{action:'retry'}}); paper.status='processing'; running=true; location.reload(); }
		catch(e){error=(e as Error).message;} finally{busy=false;}
	}
	async function save() {
		busy = true; error = ''; saved = '';
		try { const n = selected.length; paper = await api<Paper>(`/api/papers/${paper.id}`, { method:'POST', json:{cards:selected} }); saved = `${n} cards added to your collection.`; }
		catch(e){error=(e as Error).message;} finally{busy=false;}
	}
</script>
<svelte:head><title>{paper.title} · Papers</title></svelte:head>
<main class="fill wide">
	<div class="row"><a href="/papers">← Papers</a><a class="right" href="/assets/{paper.asset}" target="_blank" rel="noreferrer">Open PDF</a></div>
	<div class="page-title"><h2>{paper.title}</h2>{#if paper.suggestions.some(c=>c.slug)}<a class="btn primary right" href="/review?tag={encodeURIComponent(`paper/${paper.id}`)}">Study this paper</a>{/if}</div>
	{#if error}<div class="banner err" role="alert">{error}</div>{/if}
	{#if saved}<div class="banner" role="status">{saved}</div>{/if}
	{#if paper.status === 'processing'}
		<p role="status">{running ? 'NotebookLM is reading the paper and preparing questions. This can take a few minutes.' : 'Extraction was interrupted. Retry to continue with the existing notebook.'}</p>
		{#if !running}<div><button class="btn primary" onclick={retry} disabled={busy}>Retry extraction</button></div>{/if}
	{:else if paper.status === 'error'}
		<div class="banner err">{paper.error}</div><div><button class="btn primary" onclick={retry} disabled={busy}>Retry extraction</button></div>
	{:else}
		<div class="row"><span class="small muted">Check answers and evidence against the paper. Existing terms keep their definitions.</span><button class="btn secondary small" onclick={()=>paper.suggestions.forEach(c=>{if(!c.slug)c.selected=true;})}>Select all</button><button class="btn secondary small" onclick={()=>paper.suggestions.forEach(c=>{if(!c.slug)c.selected=false;})}>Clear</button><button class="btn primary right" onclick={save} disabled={busy||!selected.length}>{busy?'Saving…':`Add ${selected.length} selected`}</button></div>
		<div class="grow scrollable suggestions">
			{#each paper.suggestions as card: PaperSuggestion (card.id)}
				<article class="suggestion">
					<div class="row"><label><input type="checkbox" bind:checked={card.selected} disabled={!!card.slug||busy} /> {card.slug?'Saved':'Include'}</label><span class="tag">{card.kind}</span>{#if card.slug}<a class="right" href="/terms/{encodeURIComponent(card.slug)}">Open card</a>{/if}</div>
					<label class="field"><span class="label">{card.kind==='term'?'Term':'Question'}</span><input bind:value={card.question} disabled={!!card.slug||busy} /></label>
					<div class="field"><span class="label">Answer (Markdown and LaTeX)</span>{#if card.slug||busy}<pre>{card.answer}</pre>{:else}<div class="answer-editor"><CodeEditor bind:value={card.answer}/></div>{/if}</div>
					<details><summary>Supporting evidence{card.location?` · ${card.location}`:''}</summary><blockquote>{card.evidence||'No quote supplied. Verify this answer in the PDF.'}</blockquote></details>
				</article>
			{/each}
		</div>
	{/if}
</main>
<style>.suggestions{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:20px;align-content:start}.suggestion{border:1px solid var(--line);padding:18px;display:flex;flex-direction:column;gap:12px}.answer-editor{height:180px;border:1px solid var(--line);min-width:0}pre{white-space:pre-wrap;max-height:180px;overflow:auto}blockquote{white-space:pre-wrap;font-size:13px}h2{max-width:75%}</style>
