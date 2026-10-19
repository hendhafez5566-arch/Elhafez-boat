import test from 'node:test';
import assert from 'node:assert/strict';
import {botTemplate} from '../.build/apps/api/src/bot-templates.js';
import {validateFlow,advanceFlow,initialFlowState} from '../.build/apps/api/src/flow-engine.js';
test('empty bot can be saved as a single Start draft but cannot be published',()=>{
 const blank=botTemplate('blank','بوت جديد');assert.equal(validateFlow(blank,{draft:true}).nodes.length,1);assert.throws(()=>validateFlow(blank),/2–100/);
});
test('service template collects name and phone through stable button IDs then hands off',()=>{
 const f=validateFlow(botTemplate('service','مساعد الشركة'));let r=advanceFlow(f,initialFlowState());
 assert.equal(r.state.at,'menu');assert.equal(r.messages.find(m=>m.type==='BUTTONS').choices.length,3);
 r=advanceFlow(f,r.state,{kind:'CHOICE',value:'flow:menu:contact'});assert.equal(r.state.at,'name');
 r=advanceFlow(f,r.state,{kind:'TEXT',value:'عميل تجريبي'});assert.equal(r.state.at,'phone');
 r=advanceFlow(f,r.state,{kind:'TEXT',value:'not-a-phone'});assert.equal(r.state.at,'phone');
 r=advanceFlow(f,r.state,{kind:'TEXT',value:'01000000000'});assert.equal(r.handoff,true);assert.equal(r.state.answers.customer_name,'عميل تجريبي');assert.equal(r.state.answers.customer_phone,'01000000000');
});
