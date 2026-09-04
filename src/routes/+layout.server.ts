import type { LayoutServerLoad } from './$types';
import { vaultPath } from '$lib/server/config';
import { listTerms, vaultExists } from '$lib/server/vault';

export const load: LayoutServerLoad = async () => {
	const exists = await vaultExists();
	const todo = exists ? (await listTerms()).filter((t) => !t.defined).length : 0;
	return { vault: vaultPath(), vaultExists: exists, todo };
};
