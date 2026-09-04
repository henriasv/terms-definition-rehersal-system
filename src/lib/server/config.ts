import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG, type SchedulerConfig } from '../reviews.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

/**
 * Vault location, in priority order:
 *   1. TERMS_VAULT environment variable
 *   2. VAULT=... in setup/.local.conf (written by setup/init-vault.sh)
 *   3. ~/repos/terms-vault
 */
export function vaultPath(): string {
	const env = process.env.TERMS_VAULT;
	if (env) return expand(env);
	const conf = path.join(repoRoot, 'setup', '.local.conf');
	if (existsSync(conf)) {
		const m = /^VAULT=(.+)$/m.exec(readFileSync(conf, 'utf8'));
		if (m) return expand(m[1].trim().replace(/^["']|["']$/g, ''));
	}
	return path.join(homedir(), 'repos', 'terms-vault');
}

function expand(p: string): string {
	return path.resolve(p.replace(/^~(?=$|\/)/, homedir()));
}

export interface VaultConfig extends SchedulerConfig {
	typstBin: string;
	optimizedAt?: string;
}

export function loadConfig(vault = vaultPath()): VaultConfig {
	const defaults: VaultConfig = { ...DEFAULT_CONFIG, typstBin: process.env.TYPST_BIN ?? 'typst' };
	const file = path.join(vault, 'config.json');
	if (!existsSync(file)) return defaults;
	try {
		const user = JSON.parse(readFileSync(file, 'utf8'));
		return { ...defaults, ...user };
	} catch (e) {
		console.warn(`config.json unreadable, using defaults: ${(e as Error).message}`);
		return defaults;
	}
}
