import { json,type RequestHandler } from '@sveltejs/kit';
import { exportStudyPack, importPhoneProgress } from '$lib/server/study';
import { phoneCors, validPhoneRequest, PHONE_ORIGIN } from '$lib/server/phone';
import { VaultError } from '$lib/server/vault';
export const OPTIONS:RequestHandler=async({request})=>new Response(null,{status:request.headers.get('origin')===PHONE_ORIGIN?204:403,headers:phoneCors});
export const POST:RequestHandler=async({request})=>{
	try{
		if(!await validPhoneRequest(request))return json({error:'Reconnect this computer from Paper Study.'},{status:401,headers:phoneCors});
		const body=await request.text();if(body.length>10*1024*1024)throw new VaultError('Progress response is too large.');
		const data=JSON.parse(body);if(data.progress)await importPhoneProgress(data.progress);
		return json(await exportStudyPack(),{headers:phoneCors});
	}catch(e){return json({error:(e as Error).message},{status:e instanceof VaultError?e.status:500,headers:phoneCors});}
};
