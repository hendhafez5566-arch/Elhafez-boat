import test from 'node:test';
import assert from 'node:assert/strict';
import {botTemplate} from '../.build/apps/api/src/bot-templates.js';
import {validateFlow,advanceFlow,initialFlowState} from '../.build/apps/api/src/flow-engine.js';
test('empty bot can be saved as a single Start draft but cannot be published',()=>{
 const blank=botTemplate('blank','بوت جديد');assert.equal(validateFlow(blank,{draft:true}).nodes.length,1);assert.throws(()=>validateFlow(blank),/2–500/);
});
test('service template collects name and phone through stable button IDs then hands off',()=>{
 const f=validateFlow(botTemplate('service','مساعد الشركة'));let r=advanceFlow(f,initialFlowState());
 assert.equal(r.state.at,'menu');assert.equal(r.messages.find(m=>m.type==='BUTTONS').choices.length,3);
 r=advanceFlow(f,r.state,{kind:'CHOICE',value:'flow:menu:contact'});assert.equal(r.state.at,'name');
 r=advanceFlow(f,r.state,{kind:'TEXT',value:'عميل تجريبي'});assert.equal(r.state.at,'phone');
 r=advanceFlow(f,r.state,{kind:'TEXT',value:'not-a-phone'});assert.equal(r.state.at,'phone');
 r=advanceFlow(f,r.state,{kind:'TEXT',value:'01000000000'});assert.equal(r.handoff,true);assert.equal(r.state.answers.customer_name,'عميل تجريبي');assert.equal(r.state.answers.customer_phone,'01000000000');
});

test('setup preview and creation share validated greeting and optional phone capture',async()=>{
 const {prepareBotTemplate}=await import('../.build/apps/api/src/bot-templates.js');
 const {definition}=prepareBotTemplate({name:'مساعد المتجر',templateId:'service',setup:{businessName:'متجر تجريبي',greeting:'مرحبًا بك في متجرنا',collectPhone:false}});
 assert.equal(definition.nodes.find(n=>n.id==='welcome').text,'مرحبًا بك في متجرنا');assert.equal(definition.nodes.some(n=>n.id==='phone'),false);validateFlow(definition);
 let r=advanceFlow(definition,initialFlowState());r=advanceFlow(definition,r.state,{kind:'CHOICE',value:'flow:menu:contact'});r=advanceFlow(definition,r.state,{kind:'TEXT',value:'عميل'});assert.equal(r.handoff,true);
 assert.throws(()=>prepareBotTemplate({name:'بوت',setup:{collectPhone:'false'}}),/phone/);
 assert.throws(()=>prepareBotTemplate({name:'بوت',setup:{greeting:' '.repeat(20)}}),/Greeting/);
});
