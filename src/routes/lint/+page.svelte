<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { api } from '$lib/client/api';
	let { data } = $props();
	const n = (level: string) => data.issues.filter((i) => i.level === level).length;
	let busy = $state('');
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
	<h1>Lint <span class="muted small">{n('error')} errors · {n('warn')} warnings · {n('info')} notes</span></h1>
	<p class="muted small">Math dialect mismatches, render errors from KaTeX and typst, broken links, missing and orphaned assets. Same output as <code>pnpm terms lint</code>.</p>
	{#if data.issues.length === 0}
		<div class="panel">Clean.</div>
	{:else}
		<table class="panel">
			<thead><tr><th>Level</th><th>Term</th><th>Line</th><th>Message</th></tr></thead>
			<tbody>
				{#each data.issues as i (i.slug + i.code + (i.line ?? '') + i.message)}
					<tr>
						<td><span class="badge {i.level}">{i.level}</span></td>
						<td>{#if i.slug}<a href="/terms/{i.slug}">{i.slug}</a>{:else}<span class="muted">—</span>{/if}</td>
						<td class="mono small">{i.line ?? ''}</td>
						<td>
							{i.message}{#if i.fix}<div class="small muted">{i.fix}</div>{/if}
							{#if i.asset}<button class="btn danger small" style="margin-top:0.3rem" onclick={() => removeAsset(i.asset!)} disabled={busy === i.asset}>Delete file</button>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</main>
