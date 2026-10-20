/** Opt-in, identity-scoped, per-tab backups. Server validation/revisions still control restoration and saving. */
const ROOT='eb-persistent-draft-v1:',MAX_BYTES=1048576,MAX_AGE=7*86400000;
export function createDraftRecovery({storage,now=Date.now,tabId=crypto.randomUUID()}){
 const identity=scope=>scope?.tenantId&&scope?.userId?ROOT+encodeURIComponent(scope.tenantId)+':'+encodeURIComponent(scope.userId)+':':null;
 const prefix=scope=>{const user=identity(scope);return user?user+encodeURIComponent(scope.botId||'default')+':':null};
 const preference=scope=>{const user=identity(scope);return user?user+'enabled':null};
 const keys=()=>Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(Boolean);
 function enabled(scope){try{const key=preference(scope);return Boolean(key&&storage.getItem(key)==='1')}catch{return false}}
 function clearUser(scope){const user=identity(scope);if(!user)return true;try{for(const key of keys())if(key.startsWith(user))storage.removeItem(key);return true}catch{return false}}
 function setEnabled(scope,value){const key=preference(scope);if(!key)return false;if(!value)return clearUser(scope);try{storage.setItem(key,'1');return true}catch{return false}}
 function candidates(scope){const start=prefix(scope);if(!start||!enabled(scope))return [];try{const found=[];for(const key of keys()){if(!key.startsWith(start))continue;const value=storage.getItem(key);if(!value||value.length>MAX_BYTES)continue;let snapshot;try{snapshot=JSON.parse(value)}catch{continue}const age=now()-Date.parse(snapshot?.savedAt);if(!Number.isFinite(age)||age< -300000||age>MAX_AGE||!Number.isInteger(snapshot.revision)||snapshot.revision<0||!snapshot.definition||!Array.isArray(snapshot.definition.nodes)||snapshot.definition.nodes.length<1||snapshot.definition.nodes.length>100)continue;found.push({key,snapshot})}return found.sort((a,b)=>Date.parse(b.snapshot.savedAt)-Date.parse(a.snapshot.savedAt)).slice(0,3)}catch{return []}}
 function save(scope,snapshot){const start=prefix(scope);if(!start||!enabled(scope))return false;try{const entry={revision:snapshot.revision,definition:snapshot.definition,savedAt:new Date(now()).toISOString(),ownerTab:tabId},value=JSON.stringify(entry);if(value.length>MAX_BYTES)return false;const key=start+encodeURIComponent(tabId);storage.setItem(key,value);const keep=new Set(candidates(scope).map(r=>r.key));for(const old of keys())if(old.startsWith(start)&&!keep.has(old))storage.removeItem(old);return true}catch{return false}}
 function clearMatching(scope,serialized){try{for(const record of candidates(scope))if(JSON.stringify(record.snapshot.definition)===serialized)storage.removeItem(record.key)}catch{}}
 function discard(scope,key){const start=prefix(scope);if(start&&typeof key==='string'&&key.startsWith(start))try{storage.removeItem(key)}catch{}}
 return {enabled,setEnabled,save,candidates,clearMatching,discard,clearUser};
}
