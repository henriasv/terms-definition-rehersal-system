<script lang="ts">
	import { untrack } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { api } from '$lib/client/api';
	import type { Paper, PaperSuggestion, PaperCardKind } from '$lib/papers';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import Rendered from '$lib/components/Rendered.svelte';
	type Preview = {questionHtml: string; answerHtml: string};
	type PaperView = {paper: Paper; running: boolean; previews: Record<string, Preview>};
	let { data } = $props();
	let paper: Paper = $state(untrack(()=>structuredClone(data.paper)));
	let running = $state(untrack(()=>data.running));
	let previews: Record<string, Preview> = $state(untrack(()=>data.previews));
	let editing: string | null = $state(null);
	let busy = $state(false); let previewing = $state(false); let error = $state(''); let saved = $state('');
	let search = $state(''); let kind = $state('all');
	const kinds: PaperCardKind[] = ['term','concept','method','result','limitation'];
	const signature = (p: Paper) => JSON.stringify(p.suggestions.filter(c => !c.slug).map(c => [c.id,c.kind,c.question,c.answer]));
	let baseline = $state(untrack(()=>signature(data.paper)));
	const dirty = $derived(signature(paper) !== baseline);
	const selected = $derived(paper.suggestions.filter(c => c.selected && !c.slug));
	const added = $derived(paper.suggestions.filter(c => c.slug).length);
	const visible = $derived(paper.suggestions.filter(c => (kind === 'all' || c.kind === kind) && `${c.question} ${c.answer}`.toLowerCase().includes(search.toLowerCase())));
	beforeNavigate(({cancel}) => { if (dirty && !confirm('Leave without adding your edited suggestions?')) cancel(); });
	function beforeUnload(event: BeforeUnloadEvent) { if (dirty) { event.preventDefault(); event.returnValue = ''; } }
	$effect(() => {
		paper=structuredClone(data.paper);running=data.running;previews=data.previews;baseline=signature(data.paper);editing=null;error='';saved='';
		let stopped = false; let timer: ReturnType<typeof setTimeout>;
		async function poll() {
			if (paper.status !== 'processing' || stopped) return;
			try { const result = await api<PaperView>(`/api/papers/${paper.id}`); if (!stopped) { paper = result.paper; running = result.running; previews = result.previews; baseline = signature(result.paper); } } catch (e) { error = (e as Error).message; }
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
	async function finishEditing() {
		const card = paper.suggestions.find(c => c.id === editing);
		if (!card) return;
		previewing = true; error = '';
		try {
			card.question = card.question.replace(/[\r\n]+/g, ' ').trim();
			const result = await api<{html: string; termHtml: string}>('/api/render', {method:'POST', json:{body:card.answer,term:card.question,math:'latex'}});
			previews[card.id] = {questionHtml:result.termHtml,answerHtml:result.html}; editing = null;
		} finally { previewing = false; }
	}
	async function preview() { try { await finishEditing(); } catch(e) {error=(e as Error).message;} }
	async function edit(id: string) { try { await finishEditing(); editing=id; } catch(e) {error=(e as Error).message;} }
	async function save() {
		busy = true; error = ''; saved = '';
		try {
			await finishEditing(); const n = selected.length;
			const drafts = new Map(paper.suggestions.map(c => [c.id, {...c}]));
			const updated = await api<Paper>(`/api/papers/${paper.id}`, { method:'POST', json:{cards:selected} });
			baseline=signature(updated);
			for (const c of updated.suggestions) if (!c.slug && drafts.has(c.id)) Object.assign(c, drafts.get(c.id));
			paper=updated;saved=`${n} ${n === 1 ? 'card' : 'cards'} added. You can now study this paper.`;
		} catch(e){error=(e as Error).message;} finally{busy=false;}
	}
	function choose(include: boolean) { visible.forEach(c => { if (!c.slug) c.selected=include; }); }
</script>
<svelte:head><title>{paper.title} · Papers</title></svelte:head>
<svelte:window onbeforeunload={beforeUnload} />
<main class="fill wide">
	<div class="row"><a href="/papers">← Papers</a><a class="right" href="/assets/{paper.asset}" target="_blank" rel="noreferrer">Open source PDF ↗</a></div>
	<header class="page-title"><div><h2>{paper.title}</h2><p class="small muted">{added} saved cards · {paper.suggestions.length} suggestions</p></div>{#if added}<a class="btn primary right" href="/review?tag={encodeURIComponent(`paper/${paper.id}`)}&start=1">Study this paper</a>{/if}</header>
	{#if error}<div class="banner err" role="alert">{error}</div>{/if}
	{#if saved}<div class="banner" role="status">{saved}</div>{/if}
	{#if paper.status === 'processing'}
		<p role="status">{running ? 'NotebookLM is reading the paper and preparing questions. This can take a few minutes.' : 'Extraction was interrupted. Retry to continue with the existing notebook.'}</p>
		{#if !running}<div><button class="btn primary" onclick={retry} disabled={busy}>Retry extraction</button></div>{/if}
	{:else if paper.status === 'error'}
		<div class="banner err">{paper.error}</div><div><button class="btn primary" onclick={retry} disabled={busy}>Retry extraction</button></div>
	{:else}
		<div class="filters">
			<input type="search" aria-label="Find a card" placeholder="Find a question or answer…" bind:value={search} />
			<select aria-label="Card type" bind:value={kind}><option value="all">All card types</option>{#each kinds as type}<option value={type}>{type[0].toUpperCase()+type.slice(1)}</option>{/each}</select>
			<span class="small muted">{visible.length} shown</span>
		</div>
		<div class="grow scrollable suggestions">
			{#if !visible.length}<p class="muted">No cards match. Try another search or card type.</p>{/if}
			{#each visible as card: PaperSuggestion (card.id)}
				<article class="suggestion" class:excluded={!card.selected && !card.slug}>
					<div class="row"><label class="include"><input type="checkbox" bind:checked={card.selected} disabled={!!card.slug||busy} /> {card.slug?'Saved':'Include'}</label><span class="tag tag-neutral">{card.kind}</span><span class="small muted right">#{card.id}</span></div>
					{#if editing === card.id && !card.slug}
						<label class="field"><span class="label">Card type</span><select bind:value={card.kind} disabled={busy}>{#each kinds as type}<option value={type}>{type}</option>{/each}</select></label>
						<label class="field"><span class="label">{card.kind==='term'?'Term':'Question'}</span><textarea rows="3" maxlength="600" bind:value={card.question} disabled={busy}></textarea></label>
						<div class="field"><span class="label">Answer · Markdown and LaTeX</span><div class="answer-editor" inert={busy||previewing}><CodeEditor bind:value={card.answer}/></div></div>
						<button class="btn primary" onclick={preview} disabled={busy||previewing}>{previewing?'Rendering…':'Done editing · preview'}</button>
					{:else}
						<h3>{#if previews[card.id]}<Rendered html={previews[card.id].questionHtml} inline />{:else}{card.question}{/if}</h3>
						<div class="answer">{#if previews[card.id]}<Rendered html={previews[card.id].answerHtml} />{:else}<p>{card.answer}</p>{/if}</div>
						{#if card.slug}<a class="edit-link" href="/terms/{encodeURIComponent(card.slug)}" target="_blank" rel="noopener">Edit saved card ↗</a>{:else}<button class="btn secondary small edit-link" onclick={() => edit(card.id)} disabled={busy||previewing}>Edit suggestion</button>{/if}
					{/if}
					<details><summary>Supporting evidence{card.location?` · ${card.location}`:''}</summary><blockquote>{card.evidence||'No quote supplied. Verify this answer in the PDF.'}</blockquote></details>
				</article>
			{/each}
		</div>
		<footer class="selection-bar">
			{#if added === paper.suggestions.length}
				<span class="small muted">All suggestions are saved in your collection.</span>
				<a class="btn primary" href="/review?tag={encodeURIComponent(`paper/${paper.id}`)}&start=1">Study this paper</a>
			{:else}
			<div class="row">{#if paper.suggestions.some(c => !c.slug)}<button class="btn secondary small" onclick={()=>choose(true)} disabled={busy}>Select shown</button><button class="btn secondary small" onclick={()=>choose(false)} disabled={busy}>Clear shown</button>{/if}<span class="small muted">{selected.length ? `${selected.length} selected to add` : 'Choose suggestions to add'}</span></div>
			<button class="btn primary" onclick={save} disabled={busy||previewing||!selected.length}>{busy?'Adding cards…':selected.length ? `Add ${selected.length} selected ${selected.length === 1 ? 'card' : 'cards'}` : 'Select cards to add'}</button>
			{/if}
		</footer>
	{/if}
</main>
<style>
	main{gap:16px;overflow:hidden}
	.page-title{align-items:flex-start;min-width:0}.page-title>div{min-width:0}.page-title h2{font-size:28px;overflow-wrap:anywhere}.page-title p{margin:6px 0 0}
	.filters{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.filters input{flex:1;min-width:180px}.filters select{width:auto;max-width:200px}
	.suggestions{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:16px;align-content:start;overscroll-behavior:contain;padding:2px;scrollbar-gutter:stable}
	.suggestion{border:1px solid var(--line);border-radius:var(--radius-md);padding:20px;display:flex;flex-direction:column;gap:14px;min-width:0}.suggestion.excluded{opacity:.6}.suggestion h3{font-size:21px;line-height:1.4;letter-spacing:0;overflow-wrap:anywhere;margin:0}
	.include{display:inline-flex;align-items:center;gap:8px;cursor:pointer;min-height:32px;font-size:13px}.include input{width:16px;height:16px;accent-color:var(--accent)}
	.answer{font-size:15px;line-height:1.65}.answer :global(.rendered p){text-align:left;hyphens:none}
	.answer-editor{height:180px;min-width:0}.edit-link{align-self:flex-start;font-size:13px;margin-top:auto}
	textarea{resize:vertical;min-height:90px;line-height:1.5}details{font-size:13px}summary{cursor:pointer;color:var(--accent)}blockquote{white-space:pre-wrap;margin:12px 0 0;padding-left:14px;border-left:2px solid var(--line)}
	.selection-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:14px}.selection-bar>.btn{min-height:44px}
	@media(max-width:600px){main.wide{padding:16px}.page-title h2{font-size:23px}.page-title>.btn{max-width:120px;flex-shrink:0}.selection-bar{gap:8px}.selection-bar>.btn{width:100%}.suggestion{padding:16px}}
</style>
