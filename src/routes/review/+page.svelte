<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$lib/client/api';
	import Rendered from '$lib/components/Rendered.svelte';
	import Tags from '$lib/components/Tags.svelte';
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
<main>
	{#if phase === 'setup'}
		<div class="panel" style="max-width:560px;margin:2rem auto">
			<h1>Review</h1>
			<label class="field">Limit to tag
				<select bind:value={tag}>
					<option value="">All terms</option>
					{#each data.tags as [t, n] (t)}<option value={t}>{t} ({n})</option>{/each}
				</select>
			</label>
			<p class="small muted">Space reveals the answer, 1–4 rates it (Again, Hard, Good, Easy); Space again means Good; U takes back the last rating.</p>
			{#if err}<div class="banner err">{err}</div>{/if}
			<button class="btn primary" onclick={start}>Start</button>
		</div>
	{:else if phase === 'running' && card}
		<div class="progress"><div style="width:{(idx / queue.length) * 100}%"></div></div>
		<p class="small muted" style="text-align:center;margin:0 0 1rem">
			{remaining} left · {counts.due} due · {counts.new} new{#if counts.newTotal > counts.new} (of {counts.newTotal} unseen){/if}
			{#if tag}· tag {tag}{/if}
			{#if last}· <button class="linkish" onclick={undo} disabled={busy}>undo last rating <kbd>u</kbd></button>{/if}
		</p>
		<div class="card">
			{#if card.dir === 'fwd'}
				<div class="front"><Rendered html={card.term.termHtml} inline /></div>
				{#if card.term.aliasesHtml.length}<p class="aliases">{#each card.term.aliasesHtml as a, i (i)}{#if i}<span class="sep">·</span>{/if}<Rendered html={a} inline />{/each}</p>{/if}
				<div class="row" style="justify-content:center;margin-top:0.5rem">{#if card.isNew}<span class="badge new">new</span>{/if}<Tags tags={card.term.tags} /></div>
			{:else}
				<p class="small muted" style="text-align:center;margin:0 0 0.5rem">Which term is this? {#if card.isNew}<span class="badge new">new</span>{/if}</p>
				<div class="front def"><Rendered html={card.definitionHtml} /></div>
			{/if}

			{#if revealed}
				<div class="back">
					{#if card.dir === 'fwd'}
						<Rendered html={card.definitionHtml} />
					{:else}
						<div class="answer-term"><Rendered html={card.term.termHtml} inline /></div>
						{#if card.term.aliasesHtml.length}<p class="aliases">{#each card.term.aliasesHtml as a, i (i)}{#if i}<span class="sep">·</span>{/if}<Rendered html={a} inline />{/each}</p>{/if}
						<div class="row" style="justify-content:center"><Tags tags={card.term.tags} /></div>
					{/if}
					{#if card.notesHtml.trim()}
						<details class="note" style="margin-top:1rem">
							<summary>Notes · <a href="/terms/{card.slug}">open term</a></summary>
							<div style="margin-top:0.6rem"><Rendered html={card.notesHtml} /></div>
						</details>
					{:else}
						<p class="small muted" style="margin-top:1rem"><a href="/terms/{card.slug}">Open term</a></p>
					{/if}
				</div>
				<div class="rate">
					<button class="btn r1" onclick={() => rate(1)} disabled={busy}><span>Again <kbd>1</kbd></span><span class="when">{when(card.intervals[1])}</span></button>
					<button class="btn r2" onclick={() => rate(2)} disabled={busy}><span>Hard <kbd>2</kbd></span><span class="when">{when(card.intervals[2])}</span></button>
					<button class="btn r3" onclick={() => rate(3)} disabled={busy}><span>Good <kbd>3</kbd></span><span class="when">{when(card.intervals[3])}</span></button>
					<button class="btn r4" onclick={() => rate(4)} disabled={busy}><span>Easy <kbd>4</kbd></span><span class="when">{when(card.intervals[4])}</span></button>
				</div>
			{:else}
				<div class="rate"><button class="btn primary" onclick={() => (revealed = true)}>Show answer <kbd>space</kbd></button></div>
			{/if}
		</div>
		{#if err}<div class="banner err" style="max-width:760px;margin:1rem auto">{err}</div>{/if}
	{:else}
		<div class="panel" style="max-width:560px;margin:2rem auto;text-align:center">
			<h1>Done</h1>
			{#if done.total === 0}
				<p class="muted">Nothing due{#if tag} for tag {tag}{/if}. Add definitions to bring more terms into rotation.</p>
			{:else}
				<p>{done.total} reviews, {done.again} marked Again.</p>
			{/if}
			<div class="row" style="justify-content:center">
				{#if last}<button class="btn" onclick={undo} disabled={busy}>Undo last rating <kbd>u</kbd></button>{/if}
				<button class="btn" onclick={() => (phase = 'setup')}>Back</button><a class="btn primary" href="/">Home</a>
			</div>
		</div>
	{/if}
</main>
