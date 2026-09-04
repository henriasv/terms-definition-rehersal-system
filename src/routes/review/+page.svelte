<script lang="ts">
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
	const card = $derived(queue[idx]);

	async function start() {
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
		}
	}
	function show() {
		revealed = false;
		shownAt = Date.now();
	}
	async function rate(r: 1 | 2 | 3 | 4) {
		if (!card || !revealed || busy) return;
		busy = true;
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
		if (e.key === 'u' && last && (phase === 'running' || phase === 'done')) {
			e.preventDefault();
			undo();
			return;
		}
		if (phase !== 'running') return;
		const t = e.target as HTMLElement;
		if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			if (!revealed) revealed = true;
			else rate(3);
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

<svelte:head><title>Review</title></svelte:head>
<svelte:window onkeydown={onKey} />
<main class="review">
	{#if phase === 'setup'}
		<h2 style="margin:0">Review</h2>
		<div class="field" style="max-width:360px">
			<span class="label">Limit to tag</span>
			<select bind:value={tag}>
				<option value="">All terms</option>
				{#each data.tags as [t, n] (t)}<option value={t}>{t} ({n})</option>{/each}
			</select>
		</div>
		<p class="small muted" style="margin:0">Space reveals the answer, 1–4 rates it (Again, Hard, Good, Easy); Space again means Good; U takes back the last rating.</p>
		{#if err}<div class="banner err">{err}</div>{/if}
		<div><button class="btn primary" onclick={start}>Start review <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></button></div>
	{:else if phase === 'running' && card}
		<div class="review-status">
			<span>{remaining} left · {counts.due} due · {counts.new} new{#if counts.newTotal > counts.new} (of {counts.newTotal} unseen){/if}{#if tag} · tag {tag}{/if}</span>
			{#if last}<button class="linkish" onclick={undo} disabled={busy}>undo last rating <kbd>u</kbd></button>{/if}
		</div>
		<article class="card">
			<div class="row">{#if card.isNew}<span class="tag tag-outline">New</span>{/if}{#each card.term.tags as g, i (`${i}:${g}`)}<span class="tag tag-neutral">{g}</span>{/each}</div>
			{#if card.dir === 'fwd'}
				<h1 class="term"><Rendered html={card.term.termHtml} inline /></h1>
				{#if card.term.aliasesHtml.length}<div class="aliases">{#each card.term.aliasesHtml as a, i (i)}{#if i}<span class="sep">·</span>{/if}<Rendered html={a} inline />{/each}</div>{/if}
			{:else}
				<span class="kicker">Which term is this?</span>
				<div class="prompt"><Rendered html={card.definitionHtml} /></div>
			{/if}
			<div class="hr" style="margin:var(--space-2) 0"></div>
			{#if revealed}
				{#if card.dir === 'fwd'}
					<div class="prompt"><Rendered html={card.definitionHtml} /></div>
				{:else}
					<h1 class="term"><Rendered html={card.term.termHtml} inline /></h1>
					{#if card.term.aliasesHtml.length}<div class="aliases">{#each card.term.aliasesHtml as a, i (i)}{#if i}<span class="sep">·</span>{/if}<Rendered html={a} inline />{/each}</div>{/if}
				{/if}
				<div class="links">
					{#if card.notesHtml.trim()}
						<details class="note"><summary>Notes</summary><div style="margin-top:var(--space-2)"><Rendered html={card.notesHtml} /></div></details>
						<span style="color:var(--color-neutral-400)">·</span>
					{/if}
					<a href="/terms/{encodeURIComponent(card.slug)}">open term</a>
				</div>
			{:else}
				<div><button class="btn secondary" onclick={() => (revealed = true)}>Show {card.dir === 'fwd' ? 'definition' : 'term'} <kbd>space</kbd></button></div>
			{/if}
		</article>
		{#if revealed}
			<div class="rate">
				<button class="btn secondary" onclick={() => rate(1)} disabled={busy}><span>Again <kbd>1</kbd></span><span class="when">{when(card.intervals[1])}</span></button>
				<button class="btn secondary" onclick={() => rate(2)} disabled={busy}><span>Hard <kbd>2</kbd></span><span class="when">{when(card.intervals[2])}</span></button>
				<button class="btn secondary" onclick={() => rate(3)} disabled={busy}><span>Good <kbd>3</kbd></span><span class="when">{when(card.intervals[3])}</span></button>
				<button class="btn secondary" onclick={() => rate(4)} disabled={busy}><span>Easy <kbd>4</kbd></span><span class="when">{when(card.intervals[4])}</span></button>
			</div>
		{/if}
		{#if err}<div class="banner err">{err}</div>{/if}
	{:else}
		<h2 style="margin:0">Done</h2>
		{#if done.total === 0}
			<p class="muted" style="margin:0">Nothing due{#if tag} for tag {tag}{/if}. Define more terms to bring them into rotation.</p>
		{:else}
			<p style="margin:0">{done.total} reviews, {done.again} marked Again.</p>
		{/if}
		<div class="row">
			{#if last}<button class="btn secondary" onclick={undo} disabled={busy}>Undo last rating <kbd>u</kbd></button>{/if}
			<button class="btn secondary" onclick={() => (phase = 'setup')}>Back</button><a class="btn primary" href="/">Home</a>
		</div>
	{/if}
</main>
