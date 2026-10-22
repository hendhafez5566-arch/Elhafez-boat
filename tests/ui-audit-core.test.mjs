import test from 'node:test';
import assert from 'node:assert/strict';
import {arrangeFlow,nodeFootprint,collides} from '../apps/web/public/flow-geometry.js';
import {advanceFlow,normalizePhoneAnswer,validPhoneAnswer} from '../.build/apps/api/src/flow-engine.js';

test('auto arrangement reserves enough room for Arabic branching cards',()=>{
 const flow={startId:'start',nodes:[
  {id:'start',type:'START',next:'welcome'},
  {id:'welcome',type:'TEXT',text:'أهلًا بكم '.repeat(30),next:'menu'},
  {id:'menu',type:'BUTTONS',text:'اختار',choices:[{id:'one',title:'خدمة طويلة جدًا',next:'phone'},{id:'two',title:'المعلومات',next:'done'},{id:'three',title:'موظف',next:'done'}]},
  {id:'phone',type:'INPUT',text:'اكتب رقم التواصل',field:'customer_phone',next:'done'},
  {id:'done',type:'END',text:'شكرًا'}
 ]};
 const p=arrangeFlow(flow);
 for(let i=0;i<flow.nodes.length;i++)for(let j=i+1;j<flow.nodes.length;j++){
  const a=flow.nodes[i],b=flow.nodes[j];
  assert.equal(collides({...p[a.id],...nodeFootprint(a)},{...p[b.id],...nodeFootprint(b)},30),false,a.id+' overlaps '+b.id);
 }
 assert.ok(p.menu.y>p.welcome.y);
});
test('phone answers reject letters and normalize Arabic digits',()=>{
 assert.equal(validPhoneAnswer('customer_phone','abc'),false);
 assert.equal(validPhoneAnswer('customer_phone','٠١٠١٢٣٤٥٦٧٨'),true);
 assert.equal(normalizePhoneAnswer('٠١٠١٢٣٤٥٦٧٨'),'01012345678');
 assert.equal(validPhoneAnswer('customer_need','abc'),true);
 const flow={name:'جمع العملاء',startId:'start',nodes:[
  {id:'start',type:'START',next:'phone'},
  {id:'phone',type:'INPUT',text:'رقم الهاتف',field:'customer_phone',next:'done'},
  {id:'done',type:'END',text:'تم التسجيل'}
 ]};
 const first=advanceFlow(flow,{at:null,answers:{},tags:[]});
 const bad=advanceFlow(flow,first.state,{kind:'TEXT',value:'abc'});
 assert.equal(bad.state.at,'phone');
 assert.equal(bad.state.answers.customer_phone,undefined);
 const good=advanceFlow(flow,bad.state,{kind:'TEXT',value:'٠١٠١٢٣٤٥٦٧٨'});
 assert.equal(good.state.answers.customer_phone,'01012345678');
});
