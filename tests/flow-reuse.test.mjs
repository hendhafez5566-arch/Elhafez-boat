import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFlow} from '../.build/apps/api/src/flow-engine.js';
import {captureSnippet,insertSnippet,validateSnippet,createFlowSnippet} from '../.build/apps/api/src/flow-reuse.js';

const example=()=>validateFlow({name:'Reusable sample',startId:'start',nodes:[
 {id:'start',type:'START',next:'hello'},
 {id:'hello',type:'TEXT',text:'أهلًا وسهلًا',next:'ask'},
 {id:'ask',type:'INPUT',text:'تحب إيه؟',field:'interest',next:'done'},
 {id:'done',type:'END',text:'شكرًا'}
]});
const actor={userId:'11111111-1111-4111-8111-111111111111',tenantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'OWNER'};
test('capture a two-step linear reusable section with one exit',()=>{
 const sn=captureSnippet(example(),'hello',2,'أسئلة الاستقبال');
 assert.equal(sn.steps.length,2);
 assert.equal(sn.steps[0].next,'ask');
 assert.equal(sn.steps[1].next,'__exit__');
 assert.deepEqual(validateSnippet(sn),sn);
});
test('insert cloned section without changing original flow or published semantics',()=>{
 const base=example(),copy=captureSnippet(base,'hello',2,'نسخة');
 const result=insertSnippet(base,'start',copy);
 assert.equal(base.nodes.length,4);
 assert.equal(base.nodes[0].next,'hello');
 assert.equal(result.nodes.length,6);
 assert.equal(result.nodes[0].next,'reuse1');
 assert.equal(result.nodes.find(n=>n.id==='reuse2').next,'hello');
 assert.doesNotThrow(()=>validateFlow(result));
});
test('repeated import never collides with previously imported IDs',()=>{
 const b=example(),sn=captureSnippet(b,'hello',1,'رسالة قابلة لإعادة الاستخدام');
 const twice=insertSnippet(insertSnippet(b,'start',sn),'start',sn);
 assert.equal(new Set(twice.nodes.map(n=>n.id)).size,twice.nodes.length);
 assert.equal(twice.nodes.find(n=>n.id==='reuse2').next,'reuse1');
});
test('reject branched reusable sections and non-linear jumps',()=>{
 const flow=validateFlow({name:'Branched flow',startId:'start',nodes:[
  {id:'start',type:'START',next:'choice'},
  {id:'choice',type:'BUTTONS',text:'Select',choices:[{id:'yes',title:'Yes',next:'done'}]},
  {id:'done',type:'END',text:'End'}]});
 assert.throws(()=>captureSnippet(flow,'choice',1,'Bad'),/linear sequence/);
 const sn=captureSnippet(example(),'hello',2,'Good');
 sn.steps[0].next='somewhere_else';
 assert.throws(()=>validateSnippet(sn),/one linear path/);
});
test('reuse validation keeps HTTPS/content and field constraints',()=>{
 const sn=captureSnippet(example(),'hello',1,'Valid text');
 sn.steps[0]={id:'hello',type:'MEDIA',mediaKind:'image',url:'http://internal/',next:'__exit__'};
 assert.throws(()=>validateSnippet(sn),/HTTPS/);
});
test('visual groups are persisted only for valid non-overlapping nodes',()=>{
 const b=example();
 const grouped=validateFlow({...b,groups:[{id:'group1',title:'مرحلة الأسئلة',nodeIds:['hello','ask']}]});
 assert.deepEqual(grouped.groups[0].nodeIds,['hello','ask']);
 assert.throws(()=>validateFlow({...b,groups:[
  {id:'g1',title:'مجموعة أولى',nodeIds:['hello','ask']},
  {id:'g2',title:'مجموعة ثانية',nodeIds:['hello','done']}
 ]}),/Overlapping/);
});
test('reusable library inserts only into the authenticated company',async()=>{
 const queries=[];
 const db={query:async(sql,args)=>{
  queries.push({sql,args});
  if(sql.startsWith('SELECT count(*)'))return {rows:[{count:0}],rowCount:1};
  if(sql.startsWith('INSERT INTO chatbot_flow_snippets'))return {rows:[{id:'one',name:'Name',definition:args[2]}],rowCount:1};
  return {rows:[{id:actor.tenantId}],rowCount:1};
 }};
 const created=await createFlowSnippet(db,actor,captureSnippet(example(),'hello',1,'Name'));
 assert.equal(created.id,'one');
 assert.equal(queries.find(q=>q.sql.startsWith('INSERT INTO chatbot_flow_snippets')).args[0],actor.tenantId);
});
