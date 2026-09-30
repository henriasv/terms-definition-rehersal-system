<script lang="ts">
	import { api } from '$lib/client/api';
	import type { Paper } from '$lib/papers';
	let { data } = $props();
	let title = $state(''); let file: File | undefined = $state();
	let busy = $state(false); let error = $state(''); let connection = $state('');
	let search = $state('');
	const papers = $derived(data.papers.filter(p => p.title.toLowerCase().includes(search.toLowerCase())));
	async function checkConnection() {
		connection = 'Checking…';
		try { const result = await api<{connected: boolean; message: string}>('/api/notebooklm'); connection = result.connected ? 'NotebookLM connected' : result.message; }
		catch(e) { connection = (e as Error).message; }
	}
	async function connect() {
		try { await api('/api/notebooklm',{method:'POST'});connection='Complete the Google sign-in in the browser window, then check the connection.'; }
		catch(e){connection=(e as Error).message;}
	}
	async function upload(event: SubmitEvent) {
		event.preventDefault(); if (!file || busy) return;
		if (file.size > 40 * 1024 * 1024) { error = 'Choose a PDF under 40 MB.'; return; }
		busy = true; error = '';
		try {
			const body = new FormData(); body.set('pdf', file); body.set('title', title);
			const result = await api<{id: string}>('/api/papers', { method: 'POST', body, signal: AbortSignal.timeout(120_000) });
			// Start the results page in a fresh document instead of keeping the upload
			// screen busy while client-side navigation initializes the card editors.
			window.location.assign(`/papers/${encodeURIComponent(result.id)}`);
		} catch (e) {
			error = (e as Error).name === 'TimeoutError'
				? 'The upload did not respond within two minutes. Reload Papers and check whether the paper was saved before trying again.'
				: (e as Error).message;
		} finally { busy = false; }
	}
</script>
<svelte:head><title>Papers · Terms</title></svelte:head>
<main class="fill">
	<div class="page-title"><h2>Papers</h2><span class="count">{data.papers.length}</span><a class="btn secondary right" href="/phone">Study on your phone</a></div>
	<form class="row" onsubmit={upload}>
		<label class="field"><span class="label">Paper title (optional)</span><input type="text" bind:value={title} placeholder="Use the PDF filename" disabled={busy} /></label>
		<label class="field"><span class="label">PDF, up to 40 MB</span><input type="file" accept="application/pdf,.pdf" onchange={e => file = e.currentTarget.files?.[0]} required disabled={busy} /></label>
		<button class="btn primary" disabled={!file || busy}>{busy ? 'Adding paper…' : 'Extract study cards'}</button>
	</form>
	<p class="small muted">NotebookLM suggests questions about terminology, methods, findings and limitations. Review and edit them before adding them to your collection. The PDF is uploaded to your Google account when extraction starts.</p>
	<details><summary>Connect NotebookLM</summary><p class="small">Sign in once in the browser window. Your Google login stays on this computer.</p><button class="btn primary small" onclick={connect}>Sign in to NotebookLM</button> <button class="btn secondary small" onclick={checkConnection}>Check connection</button><span class="small" role="status"> {connection}</span></details>
	{#if error}<div class="banner err" role="alert">{error}</div>{/if}
	{#if data.papers.length}<input type="search" aria-label="Find a paper" placeholder="Find a paper…" bind:value={search} />{/if}
	<div class="grow scrollable">
		{#if !data.papers.length}<p class="muted">Add a paper to create your first study collection.</p>{/if}
		{#if data.papers.length && !papers.length}<p class="muted">No papers match “{search}”.</p>{/if}
		{#each papers as paper: Paper (paper.id)}
			<div class="paper-row"><div><a href="/papers/{paper.id}"><h3>{paper.title}</h3></a><span class="small muted">{paper.status === 'ready' ? `${paper.suggestions.filter(c => c.slug).length} saved · ${paper.suggestions.length} suggestions` : paper.status === 'error' ? 'Needs attention' : 'Extracting cards'}</span></div><div class="row">{#if paper.suggestions.some(c => c.slug)}<a class="btn primary" href="/review?tag={encodeURIComponent(`paper/${paper.id}`)}&start=1">Study</a>{/if}<a class="btn secondary" href="/papers/{paper.id}">{paper.status === 'ready' ? 'View cards' : 'Open'}</a></div></div>
		{/each}
	</div>
</main>
<style>.paper-row{display:flex;align-items:center;justify-content:space-between;padding:18px 0;border-bottom:1px solid var(--line)}.paper-row h3{margin:0 0 4px}form .field{flex:1;min-width:200px}</style>
