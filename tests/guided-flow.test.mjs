import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGuidedFlow,guidedSectors,guidedGoals} from '../apps/web/public/flow-onboarding.js';
import {validateFlow,advanceFlow} from '../.build/apps/api/src/flow-engine.js';

test('guided setup creates publishable source flows for all business sectors and goals',()=>{
 for(const industry of Object.keys(guidedSectors))for(const goal of Object.keys(guidedGoals)){
  for(const collectPhone of [true,false]){
   const raw=buildGuidedFlow({industry,goal,businessName:'شركة اختبار',collectPhone});
   const flow=validateFlow(raw);
   assert.equal(flow.startId,'start');
   assert.ok(flow.nodes.some(n=>n.type==='CATALOG'));
   assert.ok(flow.nodes.some(n=>n.type==='TAG'&&n.tag==='interested'));
   assert.ok(flow.nodes.some(n=>n.type==='HANDOFF'));
   assert.equal(flow.nodes.some(n=>n.type==='INPUT'&&n.field==='customer_phone'),collectPhone);
   const first=advanceFlow(flow,{at:null,answers:{},tags:[]});
   assert.ok(first.messages.some(m=>m.type==='BUTTONS'));
   assert.equal(first.state.at,'menu');
   const handoff=advanceFlow(flow,first.state,{kind:'CHOICE',value:'flow:menu:agent'});
   assert.equal(handoff.handoff,true);
   assert.equal(flow.nodes.find(n=>n.id==='menu').choices.length,3);
  }
 }
});

test('guided setup collects customer answers before tagging and employee handoff',()=>{
 const flow=validateFlow(buildGuidedFlow({industry:'tourism',goal:'leads',businessName:'شركة الرحلات',collectPhone:false}));
 let next=advanceFlow(flow,{at:null,answers:{},tags:[]});
 next=advanceFlow(flow,next.state,{kind:'CHOICE',value:'flow:menu:interest'});
 assert.equal(next.state.at,'need');
 next=advanceFlow(flow,next.state,{kind:'TEXT',value:'عمرة 7 ليالي'});
 assert.equal(next.state.answers.customer_need,'عمرة 7 ليالي');
 next=advanceFlow(flow,next.state,{kind:'TEXT',value:'مريم أحمد'});
 assert.equal(next.handoff,true);
 assert.equal(next.state.answers.customer_name,'مريم أحمد');
 assert.ok(next.state.tags.includes('interested'));
});

test('guide rejects blank names and keeps business content out of the catalog',()=>{
 assert.throws(()=>buildGuidedFlow({businessName:' '}),/اسم الشركة/);
 const flow=buildGuidedFlow({industry:'tourism',goal:'catalog',businessName:'شركة السياحة',category:'عمرة'});
 const catalog=flow.nodes.find(n=>n.type==='CATALOG');
 assert.equal(catalog.category,'عمرة');
 assert.equal(flow.nodes.filter(n=>n.type==='MEDIA'||n.type==='LINK').length,0);
 assert.ok(!JSON.stringify(flow).includes('395000'));
});

test('very long free-form business values are bounded to valid published schemas',()=>{
 const flow=validateFlow(buildGuidedFlow({businessName:'ن'.repeat(200),botName:'ب'.repeat(250),category:'خ'.repeat(250)}));
 assert.ok(flow.name.length<=100);
 assert.equal(flow.nodes.find(n=>n.id==='catalog').category.length,80);
});
