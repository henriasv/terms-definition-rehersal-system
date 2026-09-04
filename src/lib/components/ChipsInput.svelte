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
	.chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 36px; padding: 5px 8px; border: 1px solid var(--color-divider); border-radius: var(--radius-md); background: transparent; cursor: text; }
	.chips:hover { border-color: color-mix(in srgb, var(--color-text) 45%, transparent); }
	.chips:focus-within { border-color: var(--color-accent); }
	.chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: 0.02em; padding: 3px 10px; border-radius: calc(var(--radius-md) * 0.75); background: var(--color-neutral-100); color: var(--color-neutral-800); }
	.mono .chip { font-family: var(--font-mono); }
	.chip button { border: 0; background: none; color: var(--color-neutral-600); cursor: pointer; font-size: 13px; line-height: 1; padding: 0; }
	.chip button:hover { color: var(--color-accent); }
	input { flex: 1; min-width: 7rem; min-height: 0; border: 0; outline: 0; background: transparent; padding: 2px; font: inherit; font-size: 14px; color: var(--color-text); caret-color: var(--color-accent); }
	input::placeholder { color: var(--color-neutral-500); font-size: 13px; }
</style>
