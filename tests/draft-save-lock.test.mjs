import test from 'node:test';import assert from 'node:assert/strict';
import {withDraftSaveLock,draftSaveLockName,draftMutation} from '../apps/web/public/draft-save-lock.js';
const scope={tenantId:'a',userId:'owner',botId:'bot'};
test('an exclusive browser lease rejects overlap, releases after faults and isolates bot/company/user',async()=>{
 const held=new Set(),locks={request:async(name,options,fn)=>{assert.equal(options.ifAvailable,true);if(held.has(name))return fn(null);held.add(name);try{return await fn({name})}finally{held.delete(name)}}};
 let release;const wait=new Promise(r=>release=r),first=withDraftSaveLock(locks,scope,()=>wait);let calls=0;assert.equal((await withDraftSaveLock(locks,scope,async()=>calls++)).acquired,false);assert.equal(calls,0);
 for(const change of [{botId:'other'},{tenantId:'other'},{userId:'other'}])assert.equal((await withDraftSaveLock(locks,{...scope,...change},async()=>calls++)).acquired,true);
 release();await first;await assert.rejects(withDraftSaveLock(locks,scope,async()=>{throw Error('network')}));assert.equal((await withDraftSaveLock(locks,scope,async()=>{})).acquired,true);assert.equal(draftSaveLockName(scope),draftSaveLockName({...scope}));
});
test('mutation survives failed acknowledgement, changes only for new snapshot/revision and tolerates unavailable storage',async()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},definition={name:'Arabic العربية',nodes:[]};
 const a=await draftMutation(storage,'scoped',definition,4),b=await draftMutation(storage,'scoped',definition,4);assert.equal(a.id,b.id);assert.notEqual((await draftMutation(storage,'scoped',definition,5)).id,a.id);assert.notEqual((await draftMutation(storage,'another-scope',definition,4)).id,a.id);
 const broken={getItem(){throw Error('disabled')},setItem(){throw Error('quota')}};const fallback=await draftMutation(broken,'quota-scope',definition,4);assert.match(fallback.id,/^[0-9a-f-]{36}$/);assert.equal((await draftMutation(broken,'quota-scope',definition,4)).id,fallback.id);let called=false;assert.deepEqual(await withDraftSaveLock(null,scope,async()=>called=true),{acquired:true,coordinated:false});assert.equal(called,true);
});
