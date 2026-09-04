import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { vaultPath } from './config.ts';
import { VaultError, assetsDir, atomicWrite } from './vault.ts';

const EXT_BY_MIME: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/svg+xml': 'svg',
	'application/pdf': 'pdf'
};

export function extensionFor(mime: string, filename?: string): string {
	if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
	const ext = filename ? path.extname(filename).slice(1).toLowerCase() : '';
	if (/^[a-z0-9]{1,5}$/.test(ext)) return ext;
	throw new VaultError(`Unsupported asset type ${mime || filename || '?'}`, 415);
}

/**
 * Store pasted bytes under Assets/ as {slug}-{yyyymmdd}-{hash8}.{ext}.
 * Identical bytes map to the same name, so re-pasting does not duplicate.
 */
export async function saveAsset(bytes: Uint8Array, opts: { slug: string; mime: string; filename?: string; now?: Date }, vault = vaultPath()): Promise<{ name: string; reused: boolean }> {
	const ext = extensionFor(opts.mime, opts.filename);
	const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
	const day = (opts.now ?? new Date()).toISOString().slice(0, 10).replace(/-/g, '');
	const prefix = opts.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
	const dir = assetsDir(vault);
	await fs.mkdir(dir, { recursive: true });
	const existing = (await fs.readdir(dir)).find((n) => n.includes(`-${hash}.`));
	if (existing) return { name: existing, reused: true };
	const name = `${prefix}-${day}-${hash}.${ext}`;
	await atomicWrite(path.join(dir, name), bytes);
	return { name, reused: false };
}

export function assetPath(name: string, vault = vaultPath()): string {
	if (name.includes('/') || name.includes('..') || name.startsWith('.')) throw new VaultError('Bad asset name', 400);
	return path.join(assetsDir(vault), name);
}

export function mimeFor(name: string): string {
	const ext = path.extname(name).slice(1).toLowerCase();
	const hit = Object.entries(EXT_BY_MIME).find(([, e]) => e === ext || (e === 'jpg' && ext === 'jpeg'));
	return hit?.[0] ?? 'application/octet-stream';
}
