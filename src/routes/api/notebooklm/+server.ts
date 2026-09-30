import { json, type RequestHandler } from '@sveltejs/kit';
import { notebookStatus, notebookLoginState, startNotebookLogin } from '$lib/server/papers';
import { fail } from '$lib/server/http';
export const GET: RequestHandler = async () => {
	try { return json(await notebookStatus()); }
	catch (e) { return json({ connected: false, login: notebookLoginState(), message: (e as Error).message }); }
};
export const POST: RequestHandler = async()=>{try{return json(await startNotebookLogin());}catch(e){return fail(e);}};
