<script lang="ts">
	import { hydrateSmiles } from '$lib/client/smiles';
	let { html, class: cls = '' }: { html: string; class?: string } = $props();
	let el: HTMLElement | undefined = $state();
	$effect(() => {
		void html;
		if (el) hydrateSmiles(el);
	});
</script>

<div bind:this={el} class="rendered {cls}">{@html html}</div>
