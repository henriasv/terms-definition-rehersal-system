/** Browser-only SMILES rendering via smiles-drawer. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lib: Promise<any> | undefined;
function load() {
	if (!lib) lib = import('smiles-drawer').then((m) => (m as { default?: unknown }).default ?? m);
	return lib;
}

export async function drawSmiles(smiles: string, target: SVGSVGElement, size: { width: number; height: number } = { width: 320, height: 220 }) {
	const SD = await load();
	const drawer = new SD.SmiDrawer({ ...size, padding: 12 });
	const theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	await new Promise<void>((resolve) => {
		drawer.draw(
			smiles,
			target,
			theme,
			() => {
				// smiles-drawer emits an unsized SVG; pin the drawing size so CSS max-width can shrink it, never grow it.
				target.setAttribute('width', String(size.width));
				target.setAttribute('height', String(size.height));
				resolve();
			},
			(err: unknown) => {
				const span = document.createElement('span');
				span.className = 'math-error';
				span.textContent = `SMILES error: ${String((err as Error)?.message ?? err)} in "${smiles}"`;
				target.replaceWith(span);
				resolve();
			}
		);
	});
}

/** Draw every `.smiles[data-smiles]` placeholder under `root` that has not been drawn yet. */
export async function hydrateSmiles(root: HTMLElement) {
	const els = root.querySelectorAll<HTMLElement>('.smiles[data-smiles]:not([data-done])');
	for (const el of els) {
		el.dataset.done = '1';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		el.appendChild(svg);
		const inline = el.classList.contains('smiles-inline');
		// Inline drawings use a generous canvas and are scaled down by CSS so labels stay legible.
		await drawSmiles(el.dataset.smiles!, svg, inline ? { width: 260, height: 170 } : { width: 320, height: 220 });
	}
}
