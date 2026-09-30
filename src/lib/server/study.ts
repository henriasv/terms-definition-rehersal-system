import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { vaultPath, loadConfig } from './config.ts';
import { appendLog, cardStates, listTerms, readLog, assetsDir, VaultError, withReviewWrite } from './vault.ts';
import { listPapers } from './papers.ts';
import { cardsForTerm, serializeCard, type ReviewLine } from '../reviews.ts';
import { renderMarkdown, renderNames } from './render.ts';
import { stateEqual, validateProgress, type StudyPack } from '../study.ts';

export async function vaultStudyId(vault=vaultPath()): Promise<string> {
	const file=path.join(vault,'study-id');
	try { const id=(await fs.readFile(file,'utf8')).trim(); if(!/^[a-f0-9-]{36}$/.test(id)) throw new VaultError('Invalid study-id in the vault.'); return id; }
	catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e; const id=randomUUID(); await fs.mkdir(vault,{recursive:true}); try{await fs.writeFile(file,id+'\n',{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')return vaultStudyId(vault);throw e;}return id;}
}
export async function exportStudyPack(vault=vaultPath()): Promise<StudyPack> {
	const [vaultId,terms,states,papers,log]=await Promise.all([vaultStudyId(vault),listTerms(vault),cardStates(vault),listPapers(vault),readLog(vault)]);
	const cfg=loadConfig(vault);const cards: StudyPack['cards']=[]; let assetBytes=0;
	async function portable(html:string){
		const matches=[...html.matchAll(/src="\/assets\/([^"?]+)"/g)];
		for(const m of matches){
			let name:string;try{name=decodeURIComponent(m[1]);}catch{continue;}
			if(name.includes('/')||name.includes('\\')||name.includes('..'))continue;
			const mime=/\.png$/i.test(name)?'image/png':/\.jpe?g$/i.test(name)?'image/jpeg':/\.webp$/i.test(name)?'image/webp':/\.gif$/i.test(name)?'image/gif':/\.svg$/i.test(name)?'image/svg+xml':null;
			if(!mime)continue;
			try{const data=await fs.readFile(path.join(assetsDir(vault),name));assetBytes+=data.length;if(assetBytes>18*1024*1024)throw new VaultError('Study images exceed 18 MB. Export a smaller collection.');html=html.replaceAll(m[0],`src="data:${mime};base64,${data.toString('base64')}"`);}catch(e){if(e instanceof VaultError)throw e;/* Missing assets remain visibly missing. */}
		}
		return html;
	}
	for(const term of terms){
		if(!term.defined)continue;
		const [names,definition]=await Promise.all([renderNames(term),renderMarkdown(term.definition,{math:term.math,terms})]);
		const answer=await portable(definition.html);
		for(const direction of cardsForTerm(term)){
			const key=`${term.slug}#${direction}`; const state=states.get(key);
			cards.push({key,slug:term.slug,direction,title:term.fm.term,promptHtml:direction==='fwd'?names.termHtml:answer,answerHtml:direction==='fwd'?answer:names.termHtml,tags:term.fm.tags??[],source:term.fm.source??'',state:state?serializeCard(state):null});
		}
	}
	return {format:'terms-study-pack',version:1,vaultId,title:path.basename(vault),exported:new Date().toISOString(),cards,papers:papers.map(({id,title})=>({id,title})),config:{requestRetention:cfg.requestRetention,maximumInterval:cfg.maximumInterval,...(cfg.w?{w:cfg.w}:{})},reviewIds:log.lines.flatMap(l=>'syncId'in l&&l.syncId?[l.syncId]:[])};
}
export async function importPhoneProgress(value:unknown,vault=vaultPath()) {
	return withReviewWrite(async()=>{
		const progress=validateProgress(value);if(progress.vaultId!==await vaultStudyId(vault))throw new VaultError('This progress belongs to a different vault.');
		const [log,states,terms]=await Promise.all([readLog(vault),cardStates(vault),listTerms(vault)]);
		const known=new Set(log.lines.flatMap(l=>'syncId'in l&&l.syncId?[l.syncId]:[]));const slugs=new Set(terms.map(t=>t.slug));
		const pending=progress.reviews.filter(r=>!known.has(r.id)).sort((a,b)=>a.t.localeCompare(b.t));
		const simulated=new Map([...states].map(([key,c])=>[key,serializeCard(c)]));
		for(const r of pending){
			if(!slugs.has(r.card.slice(0,r.card.lastIndexOf('#'))))throw new VaultError(`The card ${r.card} was renamed or removed. Keep this progress file for recovery.`,409);
			if(!stateEqual(simulated.get(r.card)??null,r.previous))throw new VaultError(`Progress differs for ${r.card}. It was reviewed on both devices. Keep this file; no reviews were imported.`,409);
			if(r.state.last_review!==r.t)throw new VaultError('Review timestamp does not match its scheduling state.');
			simulated.set(r.card,r.state);
		}
		for(const r of pending)await appendLog({t:r.t,card:r.card,rating:r.rating,state:r.state,syncId:r.id} satisfies ReviewLine,vault);
		return {imported:pending.length,alreadyImported:progress.reviews.length-pending.length};
	},vault);
}
