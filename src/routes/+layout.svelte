<script lang="ts">
	import '../app.css';
	import 'katex/dist/katex.min.css';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	let { data, children } = $props();
	const links = [
		['/', 'Home'],
		['/terms', 'Terms'],
		['/review', 'Review'],
		['/lint', 'Lint']
	];
	const current = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href));
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header class="topbar">
	<a class="brand" href="/">Terms</a>
	<nav>
		{#each links as [href, label] (href)}
			<a {href} aria-current={current(href) ? 'page' : undefined}>{label}</a>
		{/each}
	</nav>
	<span class="spacer"></span>
	<span class="vault" title="Vault folder">{data.vault}</span>
</header>
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
