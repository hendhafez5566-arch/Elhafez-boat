import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateFlow,advanceFlow,initialFlowState} from '../.build/apps/api/src/flow-engine.js';
import {compileSubflows} from '../.build/apps/api/src/subflows.js';
import {parseTelegram,parseMetaSocial,socialPayload} from '../.build/apps/api/src/social.js';
import {accessKeyScope} from '../.build/apps/api/src/access-keys.js';
import {providerHTTP} from '../.build/apps/api/src/provider-http.js';
import {anonymizeContact,savePrivacySettings} from '../.build/apps/api/src/privacy.js';
import {publicMedia} from '../.build/apps/api/src/media.js';
import {scanBytes} from '../.build/apps/api/src/media-scan.js';
const id=randomUUID(),tenant=randomUUID(),user=randomUUID();
const child={name:'Collect interest',startId:'start',nodes:[{id:'start',type:'START',next:'ask'},{id:'ask',type:'INPUT',text:'ما احتياجك؟',field:'need',next:'end'},{id:'end',type:'END',text:'تم'}]};
const source={name:'Main flow',startId:'start',nodes:[{id:'start',type:'START',next:'call'},{id:'call',type:'SUBFLOW',subflowId:id,version:2,bindings:{need:'customer_need'},next:'done'},{id:'done',type:'END',text:'شكرًا'}]};
test('pinned subflow resolves under tenant scope, captures mapped fields and returns to caller',async()=>{
 const db={query:async(sql,p)=>{assert.match(sql,/tenant_id=\$1 AND subflow_id=\$2 AND version=\$3/);assert.deepEqual(p,[tenant,id,2]);return {rows:[{definition:child}],rowCount:1}}};
 const compiled=await compileSubflows(db,tenant,validateFlow(source));assert.equal(compiled.nodes.some(n=>n.type==='SUBFLOW'),false);
 const ask=advanceFlow(compiled,initialFlowState());assert.equal(ask.messages[0].text,'ما احتياجك؟');const result=advanceFlow(compiled,ask.state,{kind:'TEXT',value:'منتج'});assert.deepEqual(result.messages.map(m=>m.text),['تم','شكرًا']);assert.equal(result.state.answers.customer_need,'منتج');assert.equal(result.finished,true);
});
test('subflow missing version, circular references, expansion and depth fail closed',async()=>{
 await assert.rejects(compileSubflows({query:async()=>({rows:[],rowCount:0})},tenant,source),/unavailable/);
 await assert.rejects(compileSubflows({query:async()=>({rows:[{definition:{...source,nodes:source.nodes.map(n=>n.type==='SUBFLOW'?{...n,next:'done'}:n)}}],rowCount:1})},tenant,source),/Recursive/);
 const huge={...child,nodes:[{id:'start',type:'START',next:'n0'},...Array.from({length:498},(_,i)=>({id:'n'+i,type:'TEXT',text:'x',next:i===497?'end':'n'+(i+1)})),{id:'end',type:'END',text:'x'}]};await assert.rejects(compileSubflows({query:async()=>({rows:[{definition:huge}],rowCount:1})},tenant,source),/exceeds/);
});
test('subflow binding does not inherit Object.prototype keys',async()=>{
 const definition={...child,nodes:child.nodes.map(n=>n.type==='INPUT'?{...n,field:'constructor'}:n)};const compiled=await compileSubflows({query:async()=>({rows:[{definition}],rowCount:1})},tenant,source);assert.equal(compiled.nodes.find(n=>n.type==='INPUT').field,'constructor');
});
test('connector node pauses for server execution and validates provider ID',()=>{const f=validateFlow({...source,nodes:source.nodes.map(n=>n.type==='SUBFLOW'?{id:n.id,type:'CONNECTOR',connectorId:id,next:'done'}:n)});assert.equal(advanceFlow(f,initialFlowState()).pending,true);assert.throws(()=>validateFlow({...f,nodes:f.nodes.map(n=>n.type==='CONNECTOR'?{...n,connectorId:'other-company'}:n)}),/connector/)});
test('Telegram receives only private chats and dedupe uses update id',()=>{assert.equal(parseTelegram({update_id:1,message:{chat:{id:3,type:'group'}}}),null);const r=parseTelegram({update_id:5,message:{chat:{id:123,type:'private'},from:{first_name:'عميل'},date:1700000000,text:'مرحبا'}});assert.equal(r.sender,'123');assert.equal(r.eventId,'5')});
test('Meta social ignores echoes/delivery and retains provider message IDs',()=>{const r=parseMetaSocial({object:'instagram',entry:[{id:'123456',messaging:[{sender:{id:'654321'},timestamp:Date.now(),message:{mid:'m1',text:'hi'}},{sender:{id:'654321'},message:{mid:'echo',is_echo:true}}]}]});assert.equal(r.length,1);assert.equal(r[0].channel,'INSTAGRAM');assert.equal(r[0].message.eventId,'m1')});
test('social adapters obey text and callback boundaries',()=>{const t=socialPayload('TELEGRAM','123',{type:'CHOICES',text:'اختر'},[{id:'opaque-reference',title:'خدمة'}]);assert.equal(t[0].body.reply_markup.inline_keyboard[0][0].callback_data,'opaque-reference');const ig=socialPayload('INSTAGRAM','123',{type:'TEXT',text:'x'.repeat(2500)});assert.deepEqual(ig.map(x=>x.body.message.text.length),[1000,1000,500]);assert.equal(socialPayload('MESSENGER','123',{type:'TEXT',text:'hello'})[0].body.messaging_type,'RESPONSE')});
test('access keys cannot escalate to secrets, export or publishing',()=>{assert.equal(accessKeyScope('/api/v1/catalog','POST'),'catalog:write');for(const [p,m]of [['/api/v1/team','POST'],['/api/v1/flows/publish','POST'],['/api/v1/connectors','GET'],['/api/v1/privacy/contacts/'+id+'/export','GET']])assert.equal(accessKeyScope(p,m),null)});
test('provider destinations reject non-TLS and unapproved hosts before network',async()=>{await assert.rejects(providerHTTP(new URL('http://127.0.0.1'),['127.0.0.1']),/rejected/);await assert.rejects(providerHTTP(new URL('https://attacker.invalid'),['sheets.googleapis.com']),/rejected/)});
test('privacy refuses staff erasure, weak confirmation and unsafe retention',async()=>{const db={query:async()=>{throw new Error('Must not reach database')}};const owner={tenantId:tenant,userId:user,role:'OWNER'};await assert.rejects(anonymizeContact(db,{...owner,role:'AGENT'},id,{confirm:id}),/permissions/);await assert.rejects(anonymizeContact(db,owner,id,{confirm:'yes'}),/Confirm/);await assert.rejects(savePrivacySettings(db,owner,{retentionDays:1,cleanupEnabled:true}),/30/)});
test('missing malware scanner cannot approve any asset',async()=>{const previous=process.env.CLAMAV_SOCKET;delete process.env.CLAMAV_SOCKET;try{await assert.rejects(scanBytes(Buffer.from('untrusted')),/unavailable/)}finally{if(previous)process.env.CLAMAV_SOCKET=previous}});
test('public media query requires CLEAN scan within the routed company',async()=>{let query='';const tx={query:async(sql)=>{query+=sql;return {rows:[],rowCount:0}},release(){}};const pool={query:async()=>({rows:[{tenant_id:tenant,media_id:id}],rowCount:1}),connect:async()=>tx};await assert.rejects(publicMedia(pool,'a'.repeat(43)),/removed/);assert.match(query,/scan_status='CLEAN'/)});
