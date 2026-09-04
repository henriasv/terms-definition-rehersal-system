import type { LayoutServerLoad } from './$types';
import { vaultPath } from '$lib/server/config';
import { vaultExists } from '$lib/server/vault';

export const load: LayoutServerLoad = async () => ({ vault: vaultPath(), vaultExists: await vaultExists() });
