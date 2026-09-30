import { randomBytes } from 'node:crypto';
import { PHONE_ORIGIN, phoneSecret } from '$lib/server/phone';
import { vaultStudyId } from '$lib/server/study';
export const GET=async()=>{
	const nonce=randomBytes(16).toString('hex');
	const payload={type:'terms-desktop-connected',token:await phoneSecret(),vaultId:await vaultStudyId()};
	return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Desktop connected</title><body><p>Connecting this computer to your private Paper Study app…</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${JSON.stringify(payload)},${JSON.stringify(PHONE_ORIGIN)});document.querySelector('p').textContent='Connected. Keep Paper Study open on this computer to transfer cards and reviews automatically.';setTimeout(()=>window.close(),1800);}else{document.querySelector('p').textContent='Open Paper Study and choose Connect this computer.';}</script></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`}});
};
