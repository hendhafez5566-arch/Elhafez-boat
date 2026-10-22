import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFlow} from '../.build/apps/api/src/flow-engine.js';
import {mergeFlowDrafts} from '../apps/web/public/flow-merge.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const base=()=>({name:'المسار',startId:'start',nodes:[{id:'start',type:'START',next:'text'},{id:'text',type:'TEXT',text:'أهلًا',next:'end'},{id:'end',type:'END',text:'انتهى'}]});
test('independent edits combine without mutating inputs or changing stable step IDs',()=>{
 const before=base(),local=clone(before),remote=clone(before);local.nodes[1].text='تعديل محلي';remote.name='اسم الموظف الآخر';
 const snapshots=[before,local,remote].map(JSON.stringify),result=mergeFlowDrafts(before,local,remote);
 assert.equal(result.unresolved,0);assert.equal(result.definition.name,remote.name);assert.equal(result.definition.nodes[1].text,local.nodes[1].text);
 assert.deepEqual([before,local,remote].map(JSON.stringify),snapshots);assert.deepEqual(result.definition.nodes.map(n=>n.id),['start','text','end']);
});
test('same-field disagreement requires explicit selection and preserves the chosen value',()=>{
 const before=base(),local=clone(before),remote=clone(before);local.nodes[1].text='عندي';remote.nodes[1].text='بالخادم';
 const result=mergeFlowDrafts(before,local,remote);assert.equal(result.unresolved,1);
 for(const choice of ['local','remote']){const resolved=mergeFlowDrafts(before,local,remote,{[result.conflicts[0].key]:choice});assert.equal(resolved.unresolved,0);assert.equal(resolved.definition.nodes[1].text,choice==='local'?'عندي':'بالخادم')}
});
test('different fields on the same node merge and identical concurrent changes do not conflict',()=>{
 const before=base(),local=clone(before),remote=clone(before);local.nodes[1].text='جديد';remote.nodes[1].next='start';
 assert.deepEqual(mergeFlowDrafts(before,local,remote).definition.nodes[1],{id:'text',type:'TEXT',text:'جديد',next:'start'});
 remote.nodes[1].text='جديد';assert.equal(mergeFlowDrafts(before,local,remote).unresolved,0);
});
test('delete versus concurrent edit is explicit, including selection of deletion',()=>{
 const before=base(),local=clone(before),remote=clone(before);local.nodes.splice(1,1);remote.nodes[1].text='تحرير آخر';
 const result=mergeFlowDrafts(before,local,remote);assert.equal(result.unresolved,1);assert.deepEqual(result.conflicts[0].path,['nodes','text']);
 const resolved=mergeFlowDrafts(before,local,remote,{[result.conflicts[0].key]:'local'});assert.equal(resolved.unresolved,0);assert.equal(resolved.definition.nodes.some(n=>n.id==='text'),false);
});
test('one-sided additions/deletions and server order are preserved',()=>{
 const before=base(),local=clone(before),remote=clone(before);local.nodes.push({id:'local',type:'END',text:'محلي'});remote.nodes.push({id:'remote',type:'END',text:'آخر'});local.nodes.splice(2,1);
 const result=mergeFlowDrafts(before,local,remote);assert.equal(result.unresolved,0);assert.deepEqual(result.definition.nodes.map(n=>n.id),['start','text','remote','local']);
});
test('same added ID with different content and incompatible node types stay atomic',()=>{
 const before=base(),local=clone(before),remote=clone(before);local.nodes[1]={id:'text',type:'INPUT',field:'name',text:'اسمك؟',next:'end'};remote.nodes[1].text='تحرير متزامن';
 const result=mergeFlowDrafts(before,local,remote);assert.equal(result.unresolved,1);assert.deepEqual(result.conflicts[0].path,['nodes','text']);
 const merged=mergeFlowDrafts(before,local,remote,{[result.conflicts[0].key]:'local'}).definition.nodes[1];assert.equal(merged.type,'INPUT');assert.equal(merged.field,'name');
 local.nodes.push({id:'new',type:'END',text:'أ'});remote.nodes.push({id:'new',type:'END',text:'ب'});assert.equal(mergeFlowDrafts(before,local,remote).unresolved,2);
});
test('choice arrays stay atomic so row order and routing are never guessed',()=>{
 const before=base();before.nodes[1]={id:'text',type:'BUTTONS',text:'اختر',choices:[{id:'one',title:'أ',next:'end'},{id:'two',title:'ب',next:'end'}]};
 const local=clone(before),remote=clone(before);local.nodes[1].choices.reverse();remote.nodes[1].choices[0].next='start';
 const result=mergeFlowDrafts(before,local,remote);assert.equal(result.unresolved,1);assert.deepEqual(result.conflicts[0].path,['nodes','text','choices']);
});
test('independent layout positions merge and object key order is not a false conflict',()=>{
 const before=base();before.layout={start:{x:0,y:0},text:{x:0,y:100}};const local=clone(before),remote=clone(before);local.layout.start.x=30;remote.layout.text.y=200;
 const result=mergeFlowDrafts(before,local,remote);assert.equal(result.unresolved,0);assert.equal(result.definition.layout.start.x,30);assert.equal(result.definition.layout.text.y,200);
 const reversed=Object.fromEntries(Object.entries(remote).reverse());assert.equal(mergeFlowDrafts(before,remote,reversed).unresolved,0);
});

test('structurally independent edits can still be semantically invalid and must pass compiler validation',()=>{
 const before=base(),local=clone(before),remote=clone(before);local.nodes.splice(1,1);remote.name='تعديل آخر';
 const result=mergeFlowDrafts(before,local,remote);assert.equal(result.unresolved,0);assert.throws(()=>validateFlow(result.definition));
});
