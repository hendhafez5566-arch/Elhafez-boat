import test from 'node:test';import assert from 'node:assert/strict';
import {validateFlow,initialFlowState} from '../.build/apps/api/src/flow-engine.js';
import {executeFlow} from '../.build/apps/api/src/flow-service.js';
import {graphOutputs,setGraphOutput} from '../apps/web/public/flow-geometry.js';
const db={query:async()=>{throw Error('A simulated policy must never access storage/providers')}};
const base=node=>validateFlow({name:'Control policy',channel:'WEBSITE',startId:'s',nodes:[{id:'s',type:'START',next:'policy'},node,{id:'ok',type:'END',text:'OK'},...(node.type==='CONTROL'?[]:[{id:'no',type:'END',text:'NO'}])]});
test('consent requires an explicit current-node choice and simulates every outcome without storage',async()=>{
 const f=base({id:'policy',type:'CONSENT',text:'Allow marketing?',purpose:'MARKETING',policyVersion:'v1',acceptNext:'ok',declineNext:'no',withdrawNext:'no'}),first=await executeFlow(db,'t',f,initialFlowState(),undefined,true);
 assert.equal(first.state.at,'policy');assert.equal(first.messages[0].choices.length,3);
 for(const input of [{kind:'CHOICE',value:'flow:policy:accept'},{kind:'TEXT',value:'yes'},{kind:'CHOICE',value:'flow:wrong:accept'}])assert.equal((await executeFlow(db,'t',f,first.state,input,true)).state.at,'policy');
 for(const [decision,end]of [['accept','ok'],['decline','no'],['withdraw','no']]){const r=await executeFlow(db,'t',f,first.state,{kind:'CHOICE',value:'consent:'+first.state.runtime.consent.token+':'+decision},true);assert.equal(r.state.at,end);assert.ok(r.trace.some(t=>t.outcome.startsWith('mock_consent_')))}
 assert.deepEqual(graphOutputs(f.nodes[1]).map(o=>o.key),['acceptNext','declineNext','withdrawNext']);
});
test('pause and stop are runtime boundaries; resume advances without creating a second runtime',async()=>{
 for(const operation of ['PAUSE','STOP','RESUME']){const f=base({id:'policy',type:'CONTROL',operation,next:'ok',...(operation==='PAUSE'?{seconds:60}:{})}),r=await executeFlow(db,'t',f,initialFlowState(),undefined,true);if(operation==='RESUME')assert.equal(r.state.at,'ok');else{assert.equal(r.botAction.operation,operation);assert.equal(r.state.at,'policy')}}
 assert.throws(()=>base({id:'policy',type:'CONTROL',operation:'PAUSE',seconds:0,next:'ok'}));
});
test('handoff uses actual schedule and simulated staff availability with editable fallback/resume ports',async()=>{
 const node={id:'policy',type:'HANDOFF',text:'Staff will help',handoffPolicy:{strategy:'ANY',queue:'Support',unavailableNext:'no',resumeNext:'ok',schedule:{timezone:'UTC',weekdays:[1,2,3,4,5],open:'09:00',close:'17:00'}}};
 const f=base(node),run=(now,staffAvailable)=>executeFlow(db,'t',f,initialFlowState(),undefined,true,undefined,{now:Date.parse(now),staffAvailable});
 assert.equal((await run('2026-10-21T12:00Z',true)).handoff,true);assert.equal((await run('2026-10-21T12:00Z',false)).state.at,'no');assert.equal((await run('2026-10-21T20:00Z',true)).state.at,'no');
 setGraphOutput(node,'handoff:resumeNext','no');assert.equal(node.handoffPolicy.resumeNext,'no');assert.throws(()=>base({...node,handoffPolicy:{...node.handoffPolicy,idleSeconds:60,idleAction:'RESUME',resumeNext:undefined}}));
});
test('consent challenges reject callbacks from another conversation, consumed prompt or changed notice version',async()=>{
 const f=base({id:'policy',type:'CONSENT',text:'Allow marketing?',purpose:'MARKETING',policyVersion:'v1',acceptNext:'ok',declineNext:'no'}),first=await executeFlow(db,'t',f,initialFlowState(),undefined,true),other=await executeFlow(db,'t',f,initialFlowState(),undefined,true),action={kind:'CHOICE',value:'consent:'+first.state.runtime.consent.token+':accept'};
 assert.notEqual(first.state.runtime.consent.token,other.state.runtime.consent.token);assert.equal((await executeFlow(db,'t',f,other.state,action,true)).state.at,'policy');
 const accepted=await executeFlow(db,'t',f,first.state,action,true);assert.equal(accepted.state.runtime.consent,undefined);const again=await executeFlow(db,'t',f,accepted.state,undefined,true);assert.notEqual(again.state.runtime.consent.token,first.state.runtime.consent.token);assert.equal((await executeFlow(db,'t',f,again.state,action,true)).state.at,'policy');
 const changed=structuredClone(f);changed.nodes[1].policyVersion='v2';const rejected=await executeFlow(db,'t',changed,first.state,action,true);assert.equal(rejected.state.at,'policy');assert.equal(rejected.state.runtime.consent.policyVersion,'v2');assert.notEqual(rejected.state.runtime.consent.token,first.state.runtime.consent.token);
});
