<script lang="ts">
	import '../app.css';
	import 'katex/dist/katex.min.css';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	let { data, children } = $props();
	const current = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="app">
	<nav class="nav">
		<a class="nav-brand" href="/">Terms</a>
		<a href="/" aria-current={current('/') ? 'page' : undefined}>Home</a>
		<a href="/terms" aria-current={current('/terms') ? 'page' : undefined}>Terms</a>
		<a href="/define" aria-current={current('/define') ? 'page' : undefined} style="display:inline-flex;align-items:center;gap:6px">Define{#if data.todo}<span class="tag tag-outline" style="font-size:10px;padding:1px 7px;font-variant-numeric:tabular-nums">{data.todo}</span>{/if}</a>
		<a href="/review" aria-current={current('/review') ? 'page' : undefined}>Review</a>
		<a href="/lint" aria-current={current('/lint') ? 'page' : undefined}>Lint</a>
		<span class="vault" title="Vault folder">{data.vault}</span>
	</nav>
	<div class="scroll">
		{#if !data.vaultExists}
			<main>
				<div class="banner err">
					<strong>No vault at <code>{data.vault}</code>.</strong>
					Run <code>setup/init-vault.sh</code> to create one, or point <code>TERMS_VAULT</code> at an existing vault, then restart the app.
				</div>
			</main>
		{:else}
			{@render children()}
		{/if}
	</div>
</div>
