import test from 'node:test';
import assert from 'node:assert/strict';
import {mountHybridBasicBuilder} from '../apps/web/public/flow-basic-builder.js';

class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.handlers=new Map();this.dataset={};this.attributes={};this.textContent='';this.className='';}
 append(...els){this.children.push(...els);}
 replaceChildren(...els){this.children=[...els];}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(event,handler){this.handlers.set(event,handler);}
 click(){this.handlers.get('click')?.();}
 find(predicate){if(predicate(this))return this;for(const node of this.children){const result=node.find?.(predicate);if(result)return result;}return null;}
 all(predicate){return [...(predicate(this)?[this]:[]),...this.children.flatMap(node=>node.all?.(predicate)||[])];}
}
test('guided sequence shares the exact flow object and handles cyclic branches safely',()=>{
 const before=globalThis.document;
 globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const flow={startId:'start',nodes:[
   {id:'start',type:'START',next:'welcome'},
   {id:'welcome',type:'TEXT',text:'مرحبا',next:'menu'},
   {id:'menu',type:'BUTTONS',text:'اختر',choices:[{id:'one',title:'الأول',next:'welcome'}]},
   {id:'orphan',type:'TEXT',text:'مسار غير متصل',next:''}
  ]};
  const orig=JSON.stringify(flow),host=new Element('section');
  const events=[];
  const app=mountHybridBasicBuilder({
   host,getFlow:()=>flow,labels:{START:'بداية',TEXT:'رسالة نصية',BUTTONS:'أزرار'},
   getOutputs:node=>node.type==='BUTTONS'?node.choices.map(c=>({key:'choice:'+c.id,label:c.title,to:c.next})):node.next?[{key:'next',label:'التالي',to:node.next}]:[],
   onEdit:id=>events.push(['edit',id]),onLocate:id=>events.push(['locate',id]),
   onInsert:anchor=>events.push(['insert',anchor]),onPreview:()=>events.push(['preview']),
   onTemplate:value=>events.push(['template',value]),onAdvanced:()=>events.push(['advanced'])
  });
  app.render();
  assert.equal(JSON.stringify(flow),orig,'render must not mutate production graph');
  assert.match(host.find(n=>n.className==='hybrid-basic-status').textContent,/3 خطوة متصلة · 1 خطوة غير متصلة/);
  assert.equal(host.all(n=>n.className.startsWith('hybrid-step ')).length,3,'cycle must not duplicate steps');
  const insert=host.find(n=>n.textContent==='+ إضافة خطوة');assert.ok(insert);
  insert.click();assert.deepEqual(events[0],['insert',{nodeId:'start',key:'next'}]);
  const edit=host.find(n=>n.textContent==='تعديل');edit.click();assert.deepEqual(events[1],['edit','start']);
  const preview=host.find(n=>n.textContent==='▶ تجربة المحادثة');preview.click();assert.deepEqual(events[2],['preview']);
  flow.nodes[1].text='رسالة جديدة';
  app.render();
  assert.ok(host.find(n=>n.textContent==='رسالة جديدة'),'redraw reads updated shared draft');
  assert.equal(JSON.stringify(flow),JSON.stringify({...flow}),'redraw remains read-only');
 }finally{globalThis.document=before;}
});
test('template and advanced actions delegate to existing editor rather than persisting separately',()=>{
 const before=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const events=[],host=new Element('div');
  const app=mountHybridBasicBuilder({host,getFlow:()=>({startId:'start',nodes:[{id:'start',type:'START'}]}),labels:{START:'بداية'},getOutputs:()=>[],onEdit:()=>{},onLocate:()=>{},onInsert:()=>{},onPreview:()=>{},onTemplate:v=>events.push(v),onAdvanced:()=>events.push('advanced')});
  app.render();
  host.find(n=>n.textContent==='متجر').click();
  host.find(n=>n.textContent==='عرض المخطط المتقدم ↗').click();
  assert.deepEqual(events,['shop','advanced']);
  assert.equal(host.find(n=>n.className==='hybrid-step-end'),null);
 }finally{globalThis.document=before;}
});

test('basic route targets, duplication and between-step insertion delegate stable IDs without mutating branches',()=>{
 const before=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const flow={startId:'start',nodes:[{id:'start',type:'START',next:'menu'},{id:'menu',type:'BUTTONS',choices:[{id:'a',title:'الأول',next:'end'},{id:'b',title:'الثاني',next:'menu'}]},{id:'end',type:'END',text:'نهاية'}]};
  const initial=JSON.stringify(flow),events=[],host=new Element('div');
  const app=mountHybridBasicBuilder({host,getFlow:()=>flow,labels:{START:'بداية',BUTTONS:'قائمة',END:'نهاية'},getOutputs:n=>n.choices?n.choices.map(c=>({key:'choice:'+c.id,label:c.title,to:c.next})):n.next?[{key:'next',label:'التالي',to:n.next}]:[],onEdit:id=>events.push(['edit',id]),onLocate:()=>{},onInsert:anchor=>events.push(['insert',anchor]),onPreview:()=>{},onTemplate:()=>{},onAdvanced:()=>{},onDuplicate:id=>events.push(['duplicate',id])});
  app.render();
  host.find(n=>n.className==='hybrid-route-target'&&n.textContent==='نهاية').click();
  host.find(n=>n.className==='hybrid-duplicate').click();
  host.find(n=>n.className==='hybrid-between').click();
  assert.deepEqual(events,[['edit','end'],['duplicate','menu'],['insert',{nodeId:'start',key:'next'}]]);
  assert.equal(JSON.stringify(flow),initial);
  assert.equal(host.find(n=>n.className==='hybrid-count-value').textContent,'3');
  assert.equal(host.all(n=>n.className==='hybrid-duplicate').length,2,'start cannot be duplicated');
 }finally{globalThis.document=before}
});
