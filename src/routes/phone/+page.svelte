<script lang="ts">
	import { api } from '$lib/client/api';
	let busy=$state(false);let message=$state('');let error=$state('');
	async function importFile(e:Event){const file=(e.currentTarget as HTMLInputElement).files?.[0];if(!file)return;busy=true;error='';message='';try{if(file.size>10*1024*1024)throw new Error('Choose a progress file under 10 MB.');const result=await api<{imported:number;alreadyImported:number}>('/api/study/import',{method:'POST',json:JSON.parse(await file.text())});message=`Imported ${result.imported} reviews. ${result.alreadyImported} were already imported.`;}catch(e){error=(e as Error).message;}finally{busy=false;}}
</script>
<svelte:head><title>Phone study · Terms</title></svelte:head>
<main class="narrow">
	<h2>Study on your phone</h2>
	<p>Your private study app keeps cards and review progress online so you can study while this computer is off.</p>
	<div class="row"><a class="btn primary" href="https://paper-study-henri.henrik-sveinsson.chatgpt.site" target="_blank" rel="noreferrer">Open Paper Study</a><a class="btn secondary" href="/api/study/export">Download study pack</a></div>
	<ol><li>Open Paper Study on this computer and choose <strong>Connect this computer</strong>. Allow the local connection if your browser asks.</li><li>Keep the desktop app running and the Paper Study tab open here. Cards and reviews transfer automatically.</li><li>Open the same private app on your phone and sign in to your ChatGPT account. You can study while this computer is off.</li></ol>
	<p class="small muted">PDFs and your Google login stay on this computer. Approved cards and illustrations are copied to your private study app. If the same card is reviewed independently on both apps while disconnected, sync pauses and explains the conflict.</p>
	<details><summary>Backup file transfer</summary><p class="small">You can also transfer files if a browser cannot connect to this computer.</p><label class="field"><span class="label">Import phone progress</span><input type="file" accept="application/json,.json" onchange={importFile} disabled={busy}/></label></details>
	{#if message}<div class="banner" role="status">{message}</div>{/if}{#if error}<div class="banner err" role="alert">{error}</div>{/if}
</main>
