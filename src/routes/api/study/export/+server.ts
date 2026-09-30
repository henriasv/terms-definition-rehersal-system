import { json, type RequestHandler } from '@sveltejs/kit';
import { exportStudyPack } from '$lib/server/study';
import { fail } from '$lib/server/http';
export const GET: RequestHandler = async()=>{try{return json(await exportStudyPack(),{headers:{'Content-Disposition':'attachment; filename="study-pack.json"','Cache-Control':'no-store'}});}catch(e){return fail(e);}};
