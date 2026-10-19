/** Isolated PostgreSQL proof. Never accepts a production database. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createBot,botFlow,updateBot,listBots} from '../.build/apps/api/src/bots.js';
import {createTrigger,listTriggers} from '../.build/apps/api/src/triggers.js';
import {botScope} from '../.build/apps/api/src/bots.js';
import {bindBotRoute,resolveConversationBot} from '../.build/apps/api/src/bot-routing.js';
import {saveFlowDraft,publishFlowDraft,respondToFlow} from '../.build/apps/api/src/flow-service.js';
import {withTenantTransaction} from '../.build/apps/api/src/services.js';
const url=process.env.MIGRATION_DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('/elhafez_ci'))throw Error('Named disposable elhafez_ci required');
const admin=new pg.Client({connectionString:url});await admin.connect();
const role='bots_'+randomBytes(5).toString('hex'),password=randomBytes(24).toString('hex');
const actors=[];let pool;
try{
 await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS`);
 await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
 await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
 const runtime=new URL(url);runtime.username=role;runtime.password=password;pool=new pg.Pool({connectionString:runtime.toString()});
 for(let i=0;i<2;i++){
 const tenantId=randomUUID(),userId=randomUUID();
 await admin.query('INSERT INTO tenants(id,slug,name) VALUES($1,$2,$3)',[tenantId,'bot-fixture-'+tenantId,'Disposable bot fixture']);
 await admin.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[userId,userId+'@example.invalid','unused-no-login']);
 await admin.query("INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')",[tenantId,userId]);actors.push({tenantId,userId,role:'OWNER'});
 }
 const [a,b]=actors,tx=(actor,fn)=>withTenantTransaction(pool,actor,fn);
 const flow=text=>({name:'اختبار مستقل',startId:'start',nodes:[{id:'start',type:'START',next:'message'},{id:'message',type:'TEXT',text,next:'end'},{id:'end',type:'END',text:'انتهت المحادثة'}]});
 await tx(a,db=>saveFlowDraft(db,a,{...flow('تاريخ قديم'),expectedRevision:0}));await tx(a,db=>publishFlowDraft(db,a));
 const before=(await admin.query('SELECT definition,draft_revision FROM chatbot_flow_versions WHERE tenant_id=$1',[a.tenantId])).rows;
 const migration=await readFile('packages/database/migrations/0029_independent_bots.sql','utf8');
 const backfill=migration.slice(migration.indexOf('INSERT INTO chatbot_bots'),migration.indexOf('DO $$'));
 await admin.query(backfill);await admin.query(backfill);
 assert.deepEqual((await admin.query('SELECT definition,draft_revision FROM chatbot_bot_versions WHERE tenant_id=$1',[a.tenantId])).rows,before);
 assert.deepEqual((await admin.query('SELECT definition,draft_revision FROM chatbot_flow_versions WHERE tenant_id=$1',[a.tenantId])).rows,before);
 assert.equal((await tx(a,db=>listBots(db,a))).filter(x=>x.legacyDefault).length,1);
 const one=await tx(a,db=>createBot(db,a,{name:'بوت أول'})),two=await tx(a,db=>createBot(db,a,{name:'بوت ثان'}));
 for(const [bot,text] of [[one,'رسالة الأول'],[two,'رسالة الثاني']]){
 const cfg=await tx(a,db=>botFlow(db,a,bot.id,'get'));assert.equal(cfg.draft.definition.nodes.length,1);
 await tx(a,db=>botFlow(db,a,bot.id,'draft',{...flow(text),expectedRevision:1}));
 const published=await tx(a,db=>botFlow(db,a,bot.id,'publish'));assert.equal(published.version,1);
 }
 await tx(a,db=>botFlow(db,a,one.id,'draft',{...flow('تعديل الأول'),expectedRevision:2}));
 await tx(a,db=>botFlow(db,a,one.id,'publish'));
 await tx(a,async db=>createTrigger(db,a,{kind:'KEYWORD',phrase:'مرحبا',matchMode:'EXACT',targetNode:'message'},await botScope(db,a,one.id,true)));
 assert.equal((await tx(a,async db=>listTriggers(db,a,await botScope(db,a,one.id)))).length,1);
 assert.equal((await tx(a,async db=>listTriggers(db,a,await botScope(db,a,two.id)))).length,0);
 const unchanged=await tx(a,db=>botFlow(db,a,two.id,'get'));assert.equal(unchanged.published.version,1);assert.equal(unchanged.draft.definition.nodes[1].text,'رسالة الثاني');
 await assert.rejects(tx(a,db=>botFlow(db,a,one.id,'draft',{...flow('تعارض'),expectedRevision:1})),e=>e.status===409);
 await assert.rejects(tx(b,db=>botFlow(db,b,one.id,'get')),e=>e.status===404);
 await assert.rejects(tx({...a,role:'AGENT'},db=>botFlow(db,{...a,role:'AGENT'},one.id,'publish')),e=>e.status===403);
 await assert.rejects(tx({...a,role:'VIEWER'},db=>createBot(db,{...a,role:'VIEWER'},{name:'مرفوض'})),e=>e.status===403);
 assert.equal((await tx(b,db=>listBots(db,b))).length,0);
 const contact=(await admin.query("INSERT INTO contacts(tenant_id,full_name,source) VALUES($1,'عميل تجريبي','IMPORT') RETURNING id",[a.tenantId])).rows[0].id;
 const conv=async()=> (await admin.query("INSERT INTO conversations(tenant_id,contact_id,channel) VALUES($1,$2,'WEBSITE') RETURNING id",[a.tenantId,contact])).rows[0].id;
 await admin.query("INSERT INTO chatbot_widget_settings(tenant_id,widget_key,enabled) VALUES($1,$2,true)",[a.tenantId,randomBytes(24).toString('hex')]);
 await tx(a,db=>bindBotRoute(db,a,one.id,{channel:'WEBSITE'}));
 await assert.rejects(tx(a,db=>bindBotRoute(db,a,two.id,{channel:'WEBSITE'})),e=>e.status===409);
 await assert.rejects(tx(a,db=>updateBot(db,a,one.id,{archive:true})),e=>e.status===409);
 const cid=await conv();assert.equal((await tx(a,db=>resolveConversationBot(db,a.tenantId,cid))).id,one.id);
 const out=await tx(a,db=>respondToFlow(db,{tenantId:a.tenantId,conversationId:cid,contactId:contact,actionId:'',body:'ابدأ',fromWhatsApp:false}));
 assert.ok(out.payloads.some(p=>p.text?.body==='تعديل الأول'));
 assert.equal((await admin.query('SELECT bot_id FROM chatbot_flow_sessions WHERE tenant_id=$1 AND conversation_id=$2',[a.tenantId,cid])).rows[0].bot_id,one.id);
 console.log('PASS PostgreSQL: legacy backfill twice preserves versions; two independent bots; optimistic conflict; tenant/RLS and roles; unique channel routing; actual runtime and pinned bot');
}finally{await pool?.end();await admin.end()}
