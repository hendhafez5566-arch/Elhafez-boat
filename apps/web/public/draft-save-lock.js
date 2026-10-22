/** Atomic per-user/company/bot save lease. Browser owns lifetime, including crash release. */
export function draftSaveLockName(scope){return 'eb-draft-save:'+JSON.stringify([scope.tenantId,scope.userId,scope.botId||'default'])}
export async function withDraftSaveLock(locks,scope,save){
 if(!locks?.request){await save();return {acquired:true,coordinated:false}}
 return locks.request(draftSaveLockName(scope),{mode:'exclusive',ifAvailable:true},async lock=>{
  if(!lock)return {acquired:false,coordinated:true};await save();return {acquired:true,coordinated:true};
 });
}
const pendingMutations=new Map();
export function forgetDraftMutation(key){pendingMutations.delete(key)}
export async function draftMutation(storage,key,definition,revision,cryptoProvider=crypto){
 const bytes=new TextEncoder().encode(JSON.stringify({definition,revision})),hash=Array.from(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 let prior=pendingMutations.get(key);try{prior=JSON.parse(storage.getItem(key)||'null')||prior}catch{}
 const receipt=prior?.hash===hash&&/^[0-9a-f-]{36}$/i.test(prior.id)?prior:{id:cryptoProvider.randomUUID(),hash};
 pendingMutations.set(key,receipt);if(pendingMutations.size>100)pendingMutations.delete(pendingMutations.keys().next().value);
 try{storage.setItem(key,JSON.stringify(receipt))}catch{/* Memory keeps this attempt safe; CAS remains authoritative. */}
 return receipt;
}
