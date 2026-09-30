import { randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
export const PHONE_ORIGIN='https://paper-study-henri.henrik-sveinsson.chatgpt.site';
const connectionFile=()=>path.join(process.cwd(),'setup/.phone-connection.json');
export async function phoneSecret():Promise<string>{
	try{return JSON.parse(await fs.readFile(connectionFile(),'utf8')).secret;}
	catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const secret=randomBytes(32).toString('hex');await fs.mkdir(path.dirname(connectionFile()),{recursive:true});try{await fs.writeFile(connectionFile(),JSON.stringify({secret}),{mode:0o600,flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')return phoneSecret();throw e;}return secret;}
}
export async function validPhoneRequest(request:Request){
	if(request.headers.get('origin')!==PHONE_ORIGIN)return false;
	const token=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';const secret=await phoneSecret();
	return token.length===secret.length&&timingSafeEqual(Buffer.from(token),Buffer.from(secret));
}
export const phoneCors={'Access-Control-Allow-Origin':PHONE_ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Private-Network':'true','Vary':'Origin','Cache-Control':'no-store'};
