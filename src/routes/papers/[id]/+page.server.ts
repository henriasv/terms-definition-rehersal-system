import { readPaper, paperJobRunning } from '$lib/server/papers';
import { paperPreviews } from '$lib/server/paper-preview';
export const load = async ({ params }) => {
	const paper = await readPaper(params.id);
	return { paper, running: paperJobRunning(params.id), previews: await paperPreviews(paper) };
};
