<script lang="ts">
	/** Comma/Enter-separated chips with optional datalist suggestions. */
	let {
		values = $bindable<string[]>([]),
		suggestions = [] as string[],
		placeholder = '',
		id = `chips-${Math.random().toString(36).slice(2, 8)}`,
		mono = false
	}: { values?: string[]; suggestions?: string[]; placeholder?: string; id?: string; mono?: boolean } = $props();
	let text = $state('');
	let input: HTMLInputElement | undefined = $state();

	function commit() {
		const parts = text.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
		if (parts.length) {
			const seen = new Set(values.map((v) => v.toLowerCase()));
			const fresh = parts.filter((p) => !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()));
			if (fresh.length) values = [...values, ...fresh];
		}
		text = '';
	}
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			commit();
		} else if (e.key === 'Backspace' && !text && values.length) {
			values = values.slice(0, -1);
		}
	}
	function remove(i: number) {
		values = values.filter((_, j) => j !== i);
		input?.focus();
	}
	const listId = $derived(suggestions.length ? `${id}-list` : undefined);
</script>

<div class="chips" class:mono>
	{#each values as v, i (`${i}:${v}`)}
		<span class="chip">{v}<button type="button" aria-label="Remove {v}" onclick={() => remove(i)}>×</button></span>
	{/each}
	<input bind:this={input} bind:value={text} list={listId} placeholder={values.length ? '' : placeholder} {onkeydown} onblur={commit} onchange={commit} autocomplete="off" />
	{#if listId}
		<datalist id={listId}>{#each suggestions as s (s)}<option value={s}></option>{/each}</datalist>
	{/if}
</div>

<style>
	.chips { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; padding: 0.3rem 0.4rem; border: 1px solid var(--line); border-radius: 7px; background: var(--card); cursor: text; min-height: 2.4rem; }
	.chips:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }
	.chip { display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.85rem; padding: 0.1rem 0.3rem 0.1rem 0.55rem; border-radius: 999px; background: var(--soft); border: 1px solid var(--line); }
	.mono .chip { font-family: var(--mono); }
	.chip button { border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 1rem; line-height: 1; padding: 0 0.2rem; }
	.chip button:hover { color: var(--err); }
	input { flex: 1; min-width: 8rem; border: 0; outline: 0; background: transparent; padding: 0.2rem; font: inherit; color: var(--fg); }
</style>
