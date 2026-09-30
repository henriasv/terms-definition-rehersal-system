import { listPapers } from '$lib/server/papers';
export const load = async () => ({ papers: await listPapers() });
