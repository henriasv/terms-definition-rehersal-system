<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { api } from '$lib/client/api';
	let { data } = $props();
	const n = (level: string) => data.issues.filter((i) => i.level === level).length;
	let busy = $state('');
	async function addTerm(name: string) {
		busy = name;
		try {
			await api('/api/terms', { method: 'POST', json: { term: name } });
			await invalidateAll();
		} finally {
			busy = '';
		}
	}
	async function removeAsset(name: string) {
		if (!confirm(`Delete Assets/${name}? This cannot be undone.`)) return;
		busy = name;
		try {
			await api(`/api/assets/${encodeURIComponent(name)}`, { method: 'DELETE' });
			await invalidateAll();
		} finally {
			busy = '';
		}
	}
</script>

<svelte:head><title>Lint</title></svelte:head>
<main>
	<h2 style="margin:0">Lint <span class="count" style="font-size:18px;color:var(--color-neutral-600);font-weight:400;font-variant-numeric:tabular-nums">{n('error')} errors · {n('warn')} warnings · {n('info')} notes</span></h2>
	<p class="text-muted" style="font-size:13px;max-width:70ch;margin:0">Math dialect mismatches, render errors from KaTeX and typst, broken links, missing and orphaned assets. Same output as <code>pnpm terms lint</code>.</p>
	{#if data.issues.length === 0}
		<div class="banner">Clean.</div>
	{:else}
		<table class="table">
			<thead><tr><th style="width:80px">Level</th><th style="width:180px">Term</th><th style="width:60px;text-align:right">Line</th><th>Message</th></tr></thead>
			<tbody>
				{#each data.issues as i (i.slug + i.code + (i.line ?? '') + i.message)}
					<tr>
						<td><span class="tag tag-level" style="color: var(--{i.level === 'error' ? 'err' : i.level === 'warn' ? 'warn' : 'info'})">{i.level}</span></td>
						<td class="mono" style="font-size:13px">{#if i.slug}<a href="/terms/{encodeURIComponent(i.slug)}">{i.slug}</a>{:else}<span class="muted">—</span>{/if}</td>
						<td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--color-neutral-600)">{i.line ?? ''}</td>
						<td>
							<div>{i.message}</div>
							<div class="hint">
								{#if i.fix}<span>{i.fix}</span>{/if}
								{#if i.asset}<button class="linkish" onclick={() => removeAsset(i.asset!)} disabled={busy === i.asset}>Delete file</button>{/if}
								{#if i.code === 'broken-link' && i.target}<button class="linkish" onclick={() => addTerm(i.target!)} disabled={busy === i.target}>Add term “{i.target}”</button>{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</main>
