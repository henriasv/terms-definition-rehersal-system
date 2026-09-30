import { describe,it,expect,afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseSuggestions,type Paper } from '../src/lib/papers.ts';
import { nextStudyState,validatePack,validateProgress } from '../src/lib/study.ts';
import { createTerm,readLog,readTerm,appendLog } from '../src/lib/server/vault.ts';
import { acceptPaper } from '../src/lib/server/papers.ts';
import { exportStudyPack,importPhoneProgress } from '../src/lib/server/study.ts';
import { review,serializeCard } from '../src/lib/reviews.ts';
const dirs:string[]=[];
afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>fs.rm(d,{recursive:true,force:true})));});
async function vault(){const dir=await fs.mkdtemp(path.join(tmpdir(),'paper-study-'));dirs.push(dir);await fs.mkdir(path.join(dir,'Terms'));return dir;}
const suggestions=[{kind:'term',question:'Adsorption',answer:'Accumulation at an interface.',evidence:'Surface accumulation.',location:'Introduction'}];
describe('paper study',()=>{
  it('rejects malformed model responses and empty answers',()=>{expect(()=>parseSuggestions({cards:[{question:'x',answer:''}]})).toThrow();expect(()=>parseSuggestions('not JSON')).toThrow();expect(parseSuggestions(suggestions)[0]).toMatchObject({id:'1',selected:true,kind:'term'});});
  it('links existing terms without overwriting definitions, and creates one-way result cards',async()=>{
    const dir=await vault();await createTerm({term:'Adsorption',definition:'My checked definition.',source:'Textbook'},dir);
    const id=randomUUID();const paper:Paper={id,title:'Surface paper',asset:`paper-${id}.pdf`,created:new Date().toISOString(),status:'ready',suggestions:parseSuggestions([...suggestions,{kind:'result',question:'What changes with pH in this surface paper?',answer:'The measured surface charge changes sign.',evidence:'Sign reversal.',location:'Results'}])};
    await fs.mkdir(path.join(dir,'Papers'));await fs.writeFile(path.join(dir,'Papers',`${id}.json`),JSON.stringify(paper));
    const saved=await acceptPaper(id,paper.suggestions,dir);const term=await readTerm('adsorption',dir);
    expect(term.definition.trim()).toBe('My checked definition.');expect(term.fm.source).toBe('Textbook');expect(term.fm.tags).toContain(`paper/${id}`);
    expect((await readTerm(saved.suggestions[1].slug!,dir)).fm.reverse).toBe(false);
    expect((await acceptPaper(id,paper.suggestions,dir)).suggestions.filter(c=>c.slug)).toHaveLength(2);
  });
  it('exports both directions and imports phone reviews exactly once',async()=>{
    const dir=await vault();await createTerm({term:'Adsorption',definition:'At an interface.'},dir);const pack=validatePack(await exportStudyPack(dir));expect(pack.cards).toHaveLength(2);
    const t=new Date(Date.now()-10000);const state=nextStudyState(null,3,t,pack.config);
    expect(state).toEqual(serializeCard(review(undefined,3,'adsorption#fwd',t).card));
    const progress={format:'terms-phone-progress',version:1,vaultId:pack.vaultId,reviews:[{id:randomUUID(),card:'adsorption#fwd',rating:3,t:t.toISOString(),previous:null,state}]};
    expect(await importPhoneProgress(progress,dir)).toMatchObject({imported:1});expect(await importPhoneProgress(progress,dir)).toMatchObject({imported:0,alreadyImported:1});expect((await readLog(dir)).lines).toHaveLength(1);
  });
  it('detects conflicting desktop reviews before appending any phone reviews',async()=>{
    const dir=await vault();await createTerm({term:'Adsorption',definition:'At an interface.'},dir);const pack=await exportStudyPack(dir);const t=new Date(Date.now()-10000);await appendLog(review(undefined,2,'adsorption#fwd',t).line,dir);
    const progress={format:'terms-phone-progress',version:1,vaultId:pack.vaultId,reviews:[{id:randomUUID(),card:'adsorption#fwd',rating:3,t:t.toISOString(),previous:null,state:nextStudyState(null,3,t,pack.config)}]};
    await expect(importPhoneProgress(progress,dir)).rejects.toThrow('reviewed on both devices');expect((await readLog(dir)).lines).toHaveLength(1);
  });
  it('serializes concurrent imports so the same phone review is appended only once',async()=>{
    const dir=await vault();await createTerm({term:'Adsorption',definition:'At an interface.'},dir);const pack=await exportStudyPack(dir);const t=new Date(Date.now()-10000);
    const progress={format:'terms-phone-progress',version:1,vaultId:pack.vaultId,reviews:[{id:randomUUID(),card:'adsorption#fwd',rating:3,t:t.toISOString(),previous:null,state:nextStudyState(null,3,t,pack.config)}]};
    const results=await Promise.all([importPhoneProgress(progress,dir),importPhoneProgress(progress,dir)]);expect(results.reduce((sum,r)=>sum+r.imported,0)).toBe(1);expect((await readLog(dir)).lines).toHaveLength(1);
  });
  it('rejects future reviews and invalid scheduler values',()=>{expect(()=>validateProgress({format:'terms-phone-progress',version:1,vaultId:'x',reviews:[{id:randomUUID(),card:'x#fwd',rating:3,t:'2999-01-01T00:00:00.000Z',previous:null,state:null}]})).toThrow();});
});
