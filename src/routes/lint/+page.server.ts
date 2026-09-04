import type { PageServerLoad } from './$types';
import { lintVault } from '$lib/server/lint';

export const load: PageServerLoad = async () => ({ issues: await lintVault() });
