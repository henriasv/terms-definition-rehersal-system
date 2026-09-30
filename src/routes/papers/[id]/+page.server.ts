import { readPaper, paperJobRunning } from '$lib/server/papers';
export const load = async ({ params }) => ({ paper: await readPaper(params.id), running: paperJobRunning(params.id) });
