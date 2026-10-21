import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceFlow,initialFlowState,validateFlow,validateInputAnswer,matchesCondition} from '../.build/apps/api/src/flow-engine.js';
import {graphOutputs} from '../apps/web/public/flow-geometry.js';
const base={name:'Tourism sandbox',startId:'start',nodes:[{id:'start',type:'START',next:'email'},{id:'email',type:'INPUT',text:'البريد',field:'email',validation:{type:'email'},next:'condition'},{id:'condition',type:'CONDITION',field:'email',operator:'exists',match:'all',rules:[{field:'email',operator:'contains',value:'@example.invalid'},{field:'budget',operator:'gte',value:'100'}],yes:'end',no:'handoff'},{id:'end',type:'END',text:'تم'},{id:'handoff',type:'HANDOFF',text:'الموظف'}]};
test('typed answers reject malformed values without losing earlier answers, then route with trace',()=>{
 const flow=validateFlow(base);let r=advanceFlow(flow,initialFlowState());assert.equal(r.state.at,'email');
 r=advanceFlow(flow,{...r.state,answers:{budget:'150'}},{kind:'TEXT',value:'bad'});assert.equal(r.state.at,'email');assert.deepEqual(r.state.answers,{budget:'150'});
 r=advanceFlow(flow,r.state,{kind:'TEXT',value:'test@example.invalid'});assert.equal(r.finished,true);assert.equal(r.state.answers.email,'test@example.invalid');assert.ok(r.trace.some(e=>e.nodeId==='condition'&&e.outcome==='yes'));assert.equal(r.trace.some(e=>Object.hasOwn(e,'value')),false);
});
test('typed input rules cover Arabic phone/number, strict dates, zoned time and coordinate bounds',()=>{
 const input=type=>({id:'ask',type:'INPUT',field:'answer',text:'?',next:'end',validation:{type}});
 for(const [type,good,bad]of [['phone','+١٢٠٢٥٥٥٠١٢٣','abc'],['number','١٢','abc'],['email','a@example.invalid','a@'],['date','2026-10-20','2026-02-30'],['datetime','2026-10-20T12:30Z','2026-10-20T12:30'],['location','30.04,31.23','95,200']]){assert.equal(validateInputAnswer(input(type),good).valid,true,type);assert.equal(validateInputAnswer(input(type),bad).valid,false,type)}
 assert.equal(validateInputAnswer({...input('number'),validation:{type:'number',min:10,max:20}},'9').valid,false);
});
test('all/any truth tables and missing numeric values are explicit',()=>{
 const n=base.nodes[2];for(const [email,budget,all,any]of [['a@example.invalid','150',true,true],['a@example.invalid','50',false,true],['x','150',false,true],['x','50',false,false]]){assert.equal(matchesCondition({...n,match:'all'},{email,budget}),all);assert.equal(matchesCondition({...n,match:'any'},{email,budget}),any)}assert.equal(matchesCondition({...n,rules:[{field:'budget',operator:'gte',value:'0'}]},{}),false);
});
test('invalid structured rules fail validation, legacy input and condition still run unchanged',()=>{
 assert.throws(()=>validateFlow({...base,nodes:base.nodes.map(n=>n.id==='email'?{...n,validation:{type:'unknown'}}:n)}),/validation/);
 assert.throws(()=>validateFlow({...base,nodes:base.nodes.map(n=>n.id==='condition'?{...n,rules:[]}:n)}),/rules/);
 const legacy={...base,nodes:base.nodes.map(n=>{const copy={...n};delete copy.rules;delete copy.match;delete copy.validation;return copy})};assert.equal(advanceFlow(validateFlow(legacy),{at:'email',answers:{},tags:[]},{kind:'TEXT',value:'legacy'}).finished,true);
});
test('choice port identity survives reorder and 100 automatic steps execute within the supported graph limit',()=>{
 const node={type:'BUTTONS',choices:[{id:'cairo',title:'القاهرة',next:'a'},{id:'redsea',title:'البحر الأحمر',next:'b'}]};assert.equal(graphOutputs(node)[0].key,'choice:cairo');node.choices.reverse();assert.equal(graphOutputs(node)[1].key,'choice:cairo');
 const nodes=[{id:'s',type:'START',next:'n1'},...Array.from({length:98},(_,i)=>({id:'n'+(i+1),type:'TEXT',text:'message',next:i===97?'end':'n'+(i+2)})),{id:'end',type:'END',text:'Done'}];assert.equal(advanceFlow(validateFlow({name:'100 nodes',startId:'s',nodes}),initialFlowState()).finished,true);
});
test('composite content emits in order through legacy TEXT and rejects unsafe resources or nesting',()=>{
 const flow={name:'Composite',startId:'s',nodes:[{id:'s',type:'START',next:'message'},{id:'message',type:'TEXT',text:'First',blocks:[{type:'TEXT',text:'Second'},{type:'MEDIA',mediaKind:'image',url:'https://example.invalid/image.jpg'},{type:'LINK',text:'More',url:'https://example.invalid'}],next:'end'},{id:'end',type:'END',text:'Done'}]};
 const r=advanceFlow(validateFlow(flow),initialFlowState());assert.deepEqual(r.messages.map(m=>m.type),['TEXT','TEXT','MEDIA','TEXT','TEXT']);assert.equal(r.messages[1].text,'Second');
 const bad=structuredClone(flow);bad.nodes[1].blocks[1].url='javascript:alert(1)';assert.throws(()=>validateFlow(bad),/HTTPS/);
 bad.nodes[1].blocks=[{type:'TEXT',text:'Nested',blocks:[]}];assert.throws(()=>validateFlow(bad),/Nested/);
});
test('disconnected choice can be saved as draft but cannot publish',()=>{
 const d={name:'Disconnected',startId:'s',nodes:[{id:'s',type:'START',next:'menu'},{id:'menu',type:'BUTTONS',text:'?',choices:[{id:'a',title:'A',next:''}]}]};assert.doesNotThrow(()=>validateFlow(d,{draft:true}));assert.throws(()=>validateFlow(d),/destination/);
});
test('SET_FIELD persists bounded mapped answers and weighted random branches execute deterministically under injected RNG',()=>{
 const flow={name:'Actions',startId:'s',nodes:[{id:'s',type:'START',next:'set'},{id:'set',type:'SET_FIELD',field:'program_id',value:'{{selected}}',next:'random'},{id:'random',type:'RANDOMIZER',choices:[{id:'a',title:'A',weight:30,next:'a'},{id:'b',title:'B',weight:70,next:'b'}]},{id:'a',type:'END',text:'A'},{id:'b',type:'END',text:'B'}]};const f=validateFlow(flow);
 for(const [rng,branch]of [[0,'a'],[.299,'a'],[.3,'b'],[.9999,'b']]){const r=advanceFlow(f,{at:null,answers:{selected:'cairo_demo'},tags:[]},undefined,()=>rng);assert.equal(r.state.at,branch);assert.equal(r.state.answers.program_id,'cairo_demo');assert.equal(r.trace.find(t=>t.type==='RANDOMIZER').outcome,branch)}
 const bad=structuredClone(flow);bad.nodes[2].choices[0].weight=20;assert.throws(()=>validateFlow(bad),/total 100/);
 bad.nodes[2].choices[0].weight=30;bad.nodes[2].choices[0].next='random';bad.nodes[2].choices[1].weight=69;bad.nodes[2].choices.push({id:'c',title:'C',weight:1,next:'a'});assert.throws(()=>validateFlow(bad),/automatic loop/);
});
test('pinned subflow bindings remap structured rules, actions, tokens and random branch destinations',async()=>{
 const {compileSubflows}=await import('../.build/apps/api/src/subflows.js');const child={name:'Child',startId:'s',nodes:[{id:'s',type:'START',next:'set'},{id:'set',type:'SET_FIELD',field:'result',value:'{{input}}',next:'condition'},{id:'condition',type:'CONDITION',field:'result',operator:'exists',match:'all',rules:[{field:'result',operator:'exists'}],yes:'message',no:'end'},{id:'message',type:'TEXT',text:'{{result}}',blocks:[{type:'TEXT',text:'{{input}}'}],next:'end'},{id:'end',type:'END',text:'return'}]};const id='11111111-1111-4111-8111-111111111111';const parent={name:'Parent',startId:'start',nodes:[{id:'start',type:'START',next:'call'},{id:'call',type:'SUBFLOW',subflowId:id,version:1,bindings:{input:'source',result:'destination'},next:'end'},{id:'end',type:'END',text:'Done'}]};
 const compiled=await compileSubflows({query:async()=>({rows:[{definition:child}],rowCount:1})},id,validateFlow(parent));const r=advanceFlow(compiled,{at:null,answers:{source:'cairo_demo'},tags:[]});assert.equal(r.finished,true);assert.equal(r.state.answers.destination,'cairo_demo');assert.equal(r.messages.filter(m=>m.text==='cairo_demo').length,2);
});
test('step names and internal notes persist in definitions but are never customer messages',()=>{
 const f=validateFlow({name:'Review notes',startId:'s',nodes:[{id:'s',type:'START',next:'end',label:'بداية واضحة',note:'Internal review only'},{id:'end',type:'END',text:'Done'}]});assert.equal(f.nodes[0].note,'Internal review only');assert.deepEqual(advanceFlow(f,initialFlowState()).messages,[{type:'TEXT',text:'Done'}]);
});
test('publication checks tenant and scan status for media nested in composite messages',async()=>{
 const {publishFlowDraft}=await import('../.build/apps/api/src/flow-service.js');const origin=process.env.MEDIA_PUBLIC_ORIGIN;process.env.MEDIA_PUBLIC_ORIGIN='https://media.fixture.invalid';
 const actor={tenantId:'11111111-1111-4111-8111-111111111111',userId:'22222222-2222-4222-8222-222222222222',role:'OWNER'};const definition={name:'Managed content',startId:'s',nodes:[{id:'s',type:'START',next:'m'},{id:'m',type:'TEXT',text:'Media',blocks:[{type:'MEDIA',mediaKind:'image',url:process.env.MEDIA_PUBLIC_ORIGIN+'/api/v1/media/public/'+'a'.repeat(43)}],next:'end'},{id:'end',type:'END',text:'Done'}]};let checked=false,published=false;
 const db={query:async(sql,args)=>{if(sql.includes('FROM chatbot_flow_drafts'))return {rows:[{definition,draftRevision:1}],rowCount:1};if(sql.includes('FROM chatbot_media')){checked=true;assert.equal(args[0],actor.tenantId);assert.ok(sql.includes("scan_status='CLEAN'"));return {rows:[],rowCount:0}}if(sql.includes('INSERT INTO chatbot_flow_versions'))published=true;return {rows:[],rowCount:0}}};
 try{await assert.rejects(publishFlowDraft(db,actor),e=>e.status===400&&/unavailable/.test(e.message));assert.equal(checked,true);assert.equal(published,false)}finally{if(origin===undefined)delete process.env.MEDIA_PUBLIC_ORIGIN;else process.env.MEDIA_PUBLIC_ORIGIN=origin}
});
