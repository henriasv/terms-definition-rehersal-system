import { json, type RequestHandler } from '@sveltejs/kit';
import { importPhoneProgress } from '$lib/server/study';
import { fail } from '$lib/server/http';
export const POST: RequestHandler=async({request})=>{try{return json(await importPhoneProgress(await request.json()));}catch(e){return fail(e);}};
