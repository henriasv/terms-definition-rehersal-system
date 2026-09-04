<script lang="ts">
	/** CodeMirror 6 Markdown editor with math and wikilink highlighting, image paste/drop, ⌘S. */
	import { onMount } from 'svelte';
	import { EditorState, type Extension } from '@codemirror/state';
	import { EditorView, keymap, drawSelection, highlightActiveLine } from '@codemirror/view';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import { markdown } from '@codemirror/lang-markdown';
	import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
	import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
	import { Tag, tags as t } from '@lezer/highlight';
	import type { InlineContext, MarkdownConfig } from '@lezer/markdown';

	let {
		value = $bindable(''),
		onsave,
		onfiles,
		placeholder = '',
		linkTargets = [] as string[]
	}: { value?: string; onsave?: () => void; onfiles?: (files: File[]) => void; placeholder?: string; linkTargets?: string[] } = $props();

	let host: HTMLDivElement | undefined = $state();
	let view: EditorView | undefined;

	/** Insert text at the cursor (used after an image upload). */
	export function insert(text: string) {
		if (!view) return;
		const { from, to } = view.state.selection.main;
		const before = view.state.doc.sliceString(0, from);
		const pad = before.length && !before.endsWith('\n') ? '\n' : '';
		const ins = pad + text + '\n';
		view.dispatch({ changes: { from, to, insert: ins }, selection: { anchor: from + ins.length } });
		view.focus();
	}
	export function focus() {
		view?.focus();
	}

	const mathTag = Tag.define();
	const wikiTag = Tag.define();
	const highlight = HighlightStyle.define([
		{ tag: t.heading, fontWeight: '700', color: 'var(--accent)' },
		{ tag: t.emphasis, fontStyle: 'italic' },
		{ tag: t.strong, fontWeight: '700' },
		{ tag: t.strikethrough, textDecoration: 'line-through' },
		{ tag: t.link, color: 'var(--accent)', textDecoration: 'underline' },
		{ tag: t.url, color: 'var(--accent)' },
		{ tag: t.monospace, background: 'var(--soft)', borderRadius: '3px' },
		{ tag: t.processingInstruction, color: 'var(--muted)' },
		{ tag: t.labelName, color: 'var(--ok)', fontWeight: '600' },
		{ tag: t.quote, color: 'var(--muted)', fontStyle: 'italic' },
		{ tag: t.contentSeparator, color: 'var(--muted)' },
		{ tag: t.list, color: 'var(--muted)' },
		{ tag: t.escape, color: 'var(--muted)' },
		{ tag: mathTag, color: 'var(--math)' },
		{ tag: wikiTag, color: 'var(--accent)' }
	]);

	// Parser extensions so `$…$`, `$$…$$` and `[[links]]` are single nodes: no links or
	// emphasis are recognised inside math, and they get their own colours.
	const DOLLAR = 36, BACKSLASH = 92, LBRACKET = 91, RBRACKET = 93, BANG = 33;
	const mathAndLinks: MarkdownConfig = {
		defineNodes: [
			{ name: 'InlineMath', style: mathTag },
			{ name: 'WikiLink', style: wikiTag }
		],
		parseInline: [
			{
				name: 'InlineMath',
				before: 'Escape',
				parse(cx: InlineContext, next: number, pos: number) {
					if (next !== DOLLAR) return -1;
					const display = cx.char(pos + 1) === DOLLAR;
					const open = display ? 2 : 1;
					for (let i = pos + open; i < cx.end; i++) {
						const c = cx.char(i);
						if (c === BACKSLASH) {
							i++;
							continue;
						}
						if (c !== DOLLAR) continue;
						if (display) {
							if (cx.char(i + 1) === DOLLAR) return cx.addElement(cx.elt('InlineMath', pos, i + 2));
						} else if (i > pos + 1) {
							return cx.addElement(cx.elt('InlineMath', pos, i + 1));
						}
					}
					return -1;
				}
			},
			{
				name: 'WikiLink',
				before: 'Link',
				parse(cx: InlineContext, next: number, pos: number) {
					let start = pos;
					if (next === BANG) start = pos + 1;
					else if (next !== LBRACKET) return -1;
					if (cx.char(start) !== LBRACKET || cx.char(start + 1) !== LBRACKET) return -1;
					for (let i = start + 2; i < cx.end - 1; i++) {
						if (cx.char(i) === RBRACKET && cx.char(i + 1) === RBRACKET) return cx.addElement(cx.elt('WikiLink', pos, i + 2));
					}
					return -1;
				}
			}
		]
	};

	/** After `[[`, offer term names and aliases; accepting one closes the link. */
	function wikiCompletion(ctx: CompletionContext): CompletionResult | null {
		const m = ctx.matchBefore(/\[\[([^\]\n]*)$/);
		if (!m) return null;
		const after = ctx.state.doc.sliceString(ctx.pos, ctx.pos + 2);
		const close = after === ']]' ? '' : ']]';
		return {
			from: m.from + 2,
			options: linkTargets.map((t) => ({ label: t, type: 'text', apply: t + close })),
			validFor: /^[^\]\n]*$/
		};
	}

	function theme(dark: boolean): Extension {
		return EditorView.theme(
			{
				'&': { fontSize: '0.92rem', height: '100%', background: 'var(--card)', color: 'var(--fg)', borderRadius: '10px', border: '1px solid var(--line)' },
				'&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '1px' },
				'.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.55', padding: '0.5rem 0' },
				'.cm-content': { padding: '0.4rem 0.8rem', caretColor: 'var(--fg)' },
				'.cm-line': { padding: '0 0.2rem' },
				'.cm-activeLine': { background: 'color-mix(in srgb, var(--accent) 6%, transparent)' },
				'.cm-cursor': { borderLeftColor: 'var(--fg)' },
				'&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { background: 'color-mix(in srgb, var(--accent) 25%, transparent)' },
				'.cm-placeholder': { color: 'var(--muted)' },
				'.cm-tooltip': { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--fg)' },
				'.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'var(--accent)', color: 'var(--accent-fg)' }
			},
			{ dark }
		);
	}

	onMount(() => {
		const dark = matchMedia('(prefers-color-scheme: dark)').matches;
		view = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: value,
				extensions: [
					history(),
					drawSelection(),
					highlightActiveLine(),
					EditorView.lineWrapping,
					markdown({ extensions: [mathAndLinks] }),
					syntaxHighlighting(highlight),
					autocompletion({ override: [wikiCompletion], icons: false }),
					theme(dark),
					keymap.of([
						{ key: 'Mod-s', run: () => (onsave?.(), true) },
						indentWithTab,
						...defaultKeymap,
						...historyKeymap
					]),
					EditorView.domEventHandlers({
						paste: (e) => {
							const files = [...(e.clipboardData?.items ?? [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter((f): f is File => !!f);
							if (!files.length || !onfiles) return false;
							e.preventDefault();
							onfiles(files);
							return true;
						},
						drop: (e) => {
							const files = [...(e.dataTransfer?.files ?? [])];
							if (!files.length || !onfiles) return false;
							e.preventDefault();
							onfiles(files);
							return true;
						}
					}),
					EditorView.updateListener.of((u) => {
						if (u.docChanged) value = u.state.doc.toString();
					})
				]
			})
		});
		return () => view?.destroy();
	});

	// External changes (navigating to another term) replace the document.
	$effect(() => {
		const v = value;
		if (view && v !== view.state.doc.toString()) {
			const { anchor, head } = view.state.selection.main;
			const clamp = (n: number) => Math.min(n, v.length);
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v }, selection: { anchor: clamp(anchor), head: clamp(head) } });
		}
	});
</script>

<div bind:this={host} class="cm-host" data-placeholder={placeholder}></div>

<style>
	.cm-host { height: 100%; min-height: 0; }
	.cm-host :global(.cm-editor) { height: 100%; }
	.cm-host :global(.cm-scroller) { overflow: auto; }
</style>
