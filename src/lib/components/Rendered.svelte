<script lang="ts">
	import { hydrateSmiles } from '$lib/client/smiles';
	/** Server-rendered HTML; SMILES placeholders are drawn client-side after mount and on every change. */
	let { html, class: cls = '', inline = false }: { html: string; class?: string; inline?: boolean } = $props();
	let el: HTMLElement | undefined = $state();
	$effect(() => {
		void html;
		if (el) hydrateSmiles(el);
	});
</script>

<svelte:element this={inline ? 'span' : 'div'} bind:this={el} class="rendered {cls}" class:inline>{@html html}</svelte:element>
