<script lang="ts">
	import { drawSmiles } from '$lib/client/smiles';
	let { smiles, width = 320, height = 220 }: { smiles: string; width?: number; height?: number } = $props();
	let host: HTMLElement | undefined = $state();
	$effect(() => {
		if (!host) return;
		host.replaceChildren();
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		host.appendChild(svg);
		drawSmiles(smiles, svg, { width, height });
	});
</script>

<div class="structure" bind:this={host} title={smiles}></div>
