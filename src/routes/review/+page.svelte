<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api } from '$lib/client/api';
	import Rendered from '$lib/components/Rendered.svelte';
	import type { TermDecorated } from '$lib/server/http';

	interface Card {
		key: string;
		slug: string;
		dir: 'fwd' | 'rev';
		isNew: boolean;
		term: TermDecorated;
		definitionHtml: string;
		notesHtml: string;
		intervals: Record<1 | 2 | 3 | 4, string>;
	}
	let { data } = $props();
	let tag = $state(page.url.searchParams.get('tag') ?? '');
	let phase = $state<'setup' | 'running' | 'done'>('setup');
	let queue: Card[] = $state([]);
	let idx = $state(0);
	let revealed = $state(false);
	let counts = $state({ due: 0, new: 0, newTotal: 0 });
	let lookahead = $state(20);
	let done = $state({ total: 0, again: 0 });
	let last: { idx: number; rating: number; requeued: boolean } | null = $state(null);
	let shownAt = 0;
	let err = $state('');
	let busy = $state(false);
	let cardContent: HTMLElement | undefined = $state();
	const card = $derived(queue[idx]);
	const paper = $derived(data.papers.find(p => `paper/${p.id}` === tag));
	const collection = $derived(paper?.title ?? (tag ? tagLabel(tag) : 'All terms'));
	const kind = $derived(card?.term.tags.find(t => t.startsWith('study/'))?.slice(6) ?? 'term');
	const question = $derived(kind !== 'term' || (card?.term.plain.length ?? 0) > 80);
	function tagLabel(value: string) {
		if (value === 'paper') return 'All papers';
		if (value === 'study') return 'All study cards';
		if (value.startsWith('study/') && value.length > 6) return `${value[6].toUpperCase()}${value.slice(7)} cards`;
		return data.papers.find(p => `paper/${p.id}` === value)?.title ?? value;
	}
	onMount(() => { if (page.url.searchParams.get('start') === '1') void start(); });

	async function start() {
		if (busy) return;
		busy = true;
		err = '';
		try {
			const r = await api<{ cards: Card[]; counts: typeof counts; lookaheadMinutes: number }>(`/api/review/queue?tag=${encodeURIComponent(tag)}`);
			queue = r.cards;
			counts = r.counts;
			lookahead = r.lookaheadMinutes;
			idx = 0;
			done = { total: 0, again: 0 };
			last = null;
			phase = queue.length ? 'running' : 'done';
			show();
		} catch (e) {
			err = (e as Error).message;
		} finally { busy = false; }
	}
	function show() {
		revealed = false;
		shownAt = Date.now();
		cardContent?.scrollTo({ top: 0 });
	}
	async function rate(r: 1 | 2 | 3 | 4) {
		if (!card || !revealed || busy) return;
		busy = true;
		err = '';
		try {
			const res = await api<{ due: string; intervals: Card['intervals'] }>('/api/review', { method: 'POST', json: { card: card.key, rating: r, ms: Date.now() - shownAt } });
			done.total++;
			if (r === 1) done.again++;
			// Cards that come back within the session window go to the end of the queue.
			const requeued = new Date(res.due).getTime() - Date.now() < lookahead * 60_000;
			if (requeued) queue.push({ ...card, isNew: false, intervals: res.intervals });
			last = { idx, rating: r, requeued };
			idx++;
			if (idx >= queue.length) phase = 'done';
			else show();
		} catch (e) {
			err = (e as Error).message;
		} finally {
			busy = false;
		}
	}
	/** Take back the previous rating: the log gets an undo event and the card comes back up. */
	async function undo() {
		if (!last || busy) return;
		busy = true;
		err = '';
		try {
			const prev = queue[last.idx];
			const res = await api<{ intervals: Card['intervals'] }>('/api/review/undo', { method: 'POST', json: { card: prev.key } });
			if (last.requeued) queue.splice(queue.length - 1, 1);
			queue[last.idx] = { ...prev, intervals: res.intervals };
			done.total--;
			if (last.rating === 1) done.again--;
			idx = last.idx;
			last = null;
			phase = 'running';
			show();
		} catch (e) {
			err = (e as Error).message;
		} finally {
			busy = false;
		}
	}
	function onKey(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || target?.closest('input, textarea, select, button, a, summary, [contenteditable="true"]')) return;
		if (e.key.toLowerCase() === 'u' && last && (phase === 'running' || phase === 'done')) {
			e.preventDefault();
			undo();
			return;
		}
		if (phase !== 'running') return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			if (!revealed) revealed = true;
		} else if (['1', '2', '3', '4'].includes(e.key)) {
			e.preventDefault();
			rate(Number(e.key) as 1 | 2 | 3 | 4);
		}
	}
	function when(iso: string): string {
		const ms = new Date(iso).getTime() - Date.now();
		const min = Math.round(ms / 60_000);
		if (min < 60) return `${Math.max(1, min)} min`;
		const h = Math.round(min / 60);
		if (h < 36) return `${h} h`;
		const d = Math.round(h / 24);
		if (d < 30) return `${d} d`;
		const mo = Math.round(d / 30);
		return mo < 12 ? `${mo} mo` : `${(d / 365).toFixed(1)} y`;
	}
	const remaining = $derived(queue.length - idx);
</script>

<svelte:head><title>{paper ? `${paper.title} · Review` : 'Review · Terms'}</title></svelte:head>
<svelte:window onkeydown={onKey} />
<main class="review fill">
	<header class="review-header">
		<div><span class="kicker">Study collection</span><h2>{collection}</h2></div>
		<div class="row">
			{#if paper}<a class="btn secondary small" href="/papers/{paper.id}">Back to paper</a>{/if}
			{#if phase === 'running'}<button class="btn secondary small" onclick={() => phase = 'done'} disabled={busy}>End session</button>{/if}
		</div>
	</header>
	{#if phase === 'setup'}
		<section class="setup grow scrollable">
			<label class="field"><span class="label">Choose a collection or tag</span>
				<select bind:value={tag}>
					<option value="">All terms</option>
					{#each data.tags as [t, n] (t)}<option value={t}>{tagLabel(t)} ({n})</option>{/each}
				</select>
			</label>
			<p class="muted">Recall the answer, reveal it, then choose how well you remembered it.</p>
			<p class="small muted"><kbd>Space</kbd> shows the answer · <kbd>1</kbd>–<kbd>4</kbd> rates it · <kbd>U</kbd> undoes the last rating.</p>
			<div><button class="btn primary" onclick={start} disabled={busy}>{busy ? 'Loading cards…' : 'Start review'}</button></div>
		</section>
	{:else if phase === 'running' && card}
		<div class="review-status" aria-live="polite">
			<span>{done.total} reviewed · {remaining} left</span>
			{#if last}<button class="linkish" onclick={undo} disabled={busy}>Undo last rating <kbd>U</kbd></button>{/if}
		</div>
		<article class="card grow scrollable" bind:this={cardContent} tabindex="-1" aria-label="Study card">
			{#key card.key}
				<div class="row card-meta">
					{#if card.isNew}<span class="tag tag-outline">New</span>{/if}
					<span class="tag tag-neutral">{kind}</span>
					{#if !paper && card.term.source}<span class="source small muted" title={card.term.source}>{card.term.source}</span>{/if}
					{#each card.term.tags.filter(t => !t.startsWith('paper/') && !t.startsWith('study/')) as g, i (`${i}:${g}`)}<span class="tag tag-neutral">{g}</span>{/each}
				</div>
				{#if card.dir === 'fwd'}
					<span class="kicker">{question ? 'Question' : 'What does this mean?'}</span>
					<h2 class="term" class:question><Rendered html={card.term.termHtml} inline /></h2>
					{#if card.term.aliasesHtml.length}<div class="aliases">{#each card.term.aliasesHtml as a, i (i)}{#if i}<span class="sep">·</span>{/if}<Rendered html={a} inline />{/each}</div>{/if}
				{:else}
					<span class="kicker">Which term is this?</span>
					<div class="prompt"><Rendered html={card.definitionHtml} /></div>
				{/if}
				{#if revealed}
					<div class="hr"></div><span class="kicker">Answer</span>
					{#if card.dir === 'fwd'}
						<div class="prompt"><Rendered html={card.definitionHtml} /></div>
					{:else}
						<h2 class="term" class:question><Rendered html={card.term.termHtml} inline /></h2>
						{#if card.term.aliasesHtml.length}<div class="aliases">{#each card.term.aliasesHtml as a, i (i)}{#if i}<span class="sep">·</span>{/if}<Rendered html={a} inline />{/each}</div>{/if}
					{/if}
					<div class="links">
						{#if card.notesHtml.trim()}<details class="note"><summary>Evidence and notes</summary><div class="note-body"><Rendered html={card.notesHtml} /></div></details>{/if}
						<a href="/terms/{encodeURIComponent(card.slug)}" target="_blank" rel="noopener">Edit card ↗</a>
					</div>
				{/if}
			{/key}
		</article>
		<footer class="review-controls">
			{#if revealed}
				<div class="rate" aria-label="Rate your recall">
					<button class="btn secondary" onclick={() => rate(1)} disabled={busy}><span>Again <kbd>1</kbd></span><span class="when">{when(card.intervals[1])}</span></button>
					<button class="btn secondary" onclick={() => rate(2)} disabled={busy}><span>Hard <kbd>2</kbd></span><span class="when">{when(card.intervals[2])}</span></button>
					<button class="btn primary" onclick={() => rate(3)} disabled={busy}><span>Good <kbd>3</kbd></span><span class="when">{when(card.intervals[3])}</span></button>
					<button class="btn secondary" onclick={() => rate(4)} disabled={busy}><span>Easy <kbd>4</kbd></span><span class="when">{when(card.intervals[4])}</span></button>
				</div>
			{:else}<button class="btn primary reveal" onclick={() => revealed = true} disabled={busy}>Show answer <kbd>Space</kbd></button>{/if}
			<p class="small muted" role="status">{busy ? 'Saving rating…' : revealed ? 'How well did you recall the answer? Choose 1–4.' : 'Think of your answer, then press Space to check it.'}</p>
		</footer>
	{:else}
		<section class="setup grow scrollable">
			<h3>{remaining && queue.length ? 'Session ended' : done.total ? 'Session complete' : 'You’re up to date'}</h3>
			<p>{done.total ? `${done.total} reviews, ${done.again} marked Again.` : remaining && queue.length ? 'Your remaining cards will be available next time.' : 'No cards are due in this collection right now.'}</p>
			<div class="row">
				{#if last}<button class="btn secondary" onclick={undo} disabled={busy}>Undo last rating <kbd>U</kbd></button>{/if}
				<button class="btn secondary" onclick={() => phase = 'setup'}>Choose another session</button>
				<a class="btn primary" href={paper ? `/papers/${paper.id}` : '/'}>{paper ? 'Back to paper' : 'Home'}</a>
			</div>
		</section>
	{/if}
	{#if err}<div class="banner err" role="alert">{err}</div>{/if}
</main>
<style>
	main.review{width:min(900px,100%);padding:24px;gap:14px;overflow:hidden}
	.review-header{display:flex;align-items:center;justify-content:space-between;gap:16px;min-width:0}
	.review-header>div:first-child{min-width:0}
	.review-header h2{font-size:24px;overflow-wrap:anywhere;margin:4px 0 0}
	.kicker{font-size:11px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase}
	.setup{display:flex;flex-direction:column;gap:18px;padding:24px 0}
	.setup .field{max-width:520px}
	.card{padding:24px;gap:14px;overscroll-behavior:contain;scrollbar-gutter:stable}
	.card .term{font-size:clamp(30px,4vw,42px);line-height:1.2;overflow-wrap:anywhere}
	.card .term.question{font-size:clamp(22px,2.8vw,29px);line-height:1.4;letter-spacing:0}
	.card .prompt{font-size:17px;text-align:left}
	.card :global(.rendered p){text-align:left;hyphens:none}
	.card .hr{margin:4px 0}
	.card-meta{gap:6px}
	.source{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
	.links{flex-wrap:wrap;align-items:baseline;margin-top:8px}
	.links .note{flex:1;min-width:180px}
	.note-body{margin-top:12px}
	.linkish{border:0;background:none;font:inherit;color:var(--accent);cursor:pointer}
	.review-controls{display:flex;flex-direction:column;gap:8px}
	.review-controls p{margin:0;text-align:center}
	.review-controls .btn{min-height:54px}
	.reveal{width:100%;min-height:62px!important}
	.rate{gap:10px}
	.rate .btn{padding:10px 6px}
	@media(max-width:600px){main.review{padding:16px;gap:10px}.review-header{align-items:flex-start}.review-header h2{font-size:20px}.review-header .row{justify-content:flex-end;flex-shrink:0;max-width:125px}.card{padding:18px}.rate{gap:6px}.rate .btn{font-size:14px}}
</style>
