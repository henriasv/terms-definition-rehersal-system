<script lang="ts">
	let { tags }: { tags: string[] } = $props();
</script>

{#each tags as tag, i (`${i}:${tag}`)}
	<a class="tag tag-neutral" href="/terms?tag={encodeURIComponent(tag)}">{tag}</a>
{/each}
