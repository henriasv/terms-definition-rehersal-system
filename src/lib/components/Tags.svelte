<script lang="ts">
	let { tags }: { tags: string[] } = $props();
</script>

{#each tags as tag (tag)}
	<a class="tag" href="/terms?tag={encodeURIComponent(tag)}">{tag}</a>
{/each}
