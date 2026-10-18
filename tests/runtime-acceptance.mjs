/** Disposable end-to-end acceptance with a real non-owner PostgreSQL runtime role.
 * Runs only after migrations on an isolated CI database. NEVER run against production.
 */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import pg from 'pg';
import {passwordHash} from '../.build/apps/api/src/auth.js';

if(process.env.CI_RUNTIME_ACCEPTANCE!=='1'||process.env.CI_ACCEPTANCE_DISPOSABLE_DB!=='YES')
 throw new Error('CI_RUNTIME_ACCEPTANCE=1 and CI_ACCEPTANCE_DISPOSABLE_DB=YES required');
const adminUrl=process.env.MIGRATION_DATABASE_URL;
if(!adminUrl||!/elhafez_ci/.test(new URL(adminUrl).pathname))
 throw new Error('Acceptance requires named disposable elhafez_ci database');
const db=new pg.Client({connectionString:adminUrl});await db.connect();
const suffix=randomBytes(5).toString('hex');
const role='boat_accept_'+suffix,password='SafeTest-'+randomBytes(15).toString('hex');
const runtimeUrl=new URL(adminUrl);
runtimeUrl.username=role;runtimeUrl.password=password;
const slugA='company-a-'+suffix,slugB='company-b-'+suffix;
const email='owner-'+suffix+'@example.invalid',pass='Acceptance-'+randomBytes(14).toString('hex');
let apiProcess,webProcess;
const logs=[];
const processes=[];
const base='http://127.0.0.1:3000';
async function request(path,{method='GET',token,body,headers={}}={}){
 const response=await fetch(base+path,{method,headers:{...headers,...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(8000)});
 const contentType=response.headers.get('content-type')||'';
 const data=contentType.includes('application/json')?await response.json():await response.text();
 return {status:response.status,data};
}
function launch(name,cmd,args,env){
 const child=spawn(cmd,args,{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 processes.push(child);
 for(const fd of [child.stdout,child.stderr])fd.on('data',buf=>{
  const sanitized=String(buf).replaceAll(pass,'[redacted]').replaceAll(password,'[redacted]');
  logs.push(name+': '+sanitized.slice(0,1000));
  if(logs.length>60)logs.shift();
 });
 child.on('error',error=>logs.push(name+' spawn failed: '+error.message));
 return child;
}
async function waitForHealth(){
 for(let i=0;i<70;i++){
  if(processes.some(p=>p.exitCode!==null))throw new Error('Process exited during startup: '+logs.slice(-6).join('\n'));
  try{const r=await request('/health');if(r.status===200&&r.data.database==='reachable')return;}catch{}
  await sleep(400);
 }
 throw new Error('API or web health did not become available: '+logs.slice(-10).join('\n'));
}
async function expectCode(path,options,expected){const result=await request(path,options);assert.equal(result.status,expected,`${options?.method||'GET'} ${path}: ${JSON.stringify(result.data).slice(0,900)}`);return result.data}
try{
 await db.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
 await db.query(`GRANT CONNECT ON DATABASE elhafez_ci TO ${role}`);
 await db.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
 await db.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
 await db.query(`GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
 const hash=await passwordHash(pass);
 const ids=[];
 for(const [slug,name] of [[slugA,'Acceptance Company A'],[slugB,'Acceptance Company B']]){
  const t=(await db.query('INSERT INTO tenants(slug,name) VALUES($1,$2) RETURNING id',[slug,name])).rows[0].id;
  const u=(await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id',[`${slug}@example.invalid`,hash])).rows[0].id;
  await db.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')`,[t,u]);
  await db.query(`INSERT INTO tenant_subscriptions(tenant_id,plan_code,status,current_period_ends_at) VALUES($1,'STARTER','TRIAL',now()+interval '14 days')`,[t]);
  ids.push({tenantId:t,userId:u,slug});
 }
 // A real low-privilege role (unlike SET ROLE from a privileged connection).
 const env={DATABASE_URL:runtimeUrl.toString(),PLATFORM_DATABASE_URL:adminUrl,PORT:'4000',WEB_PORT:'3000',API_INTERNAL_ORIGIN:'http://127.0.0.1:4000',RATE_LIMIT_SECRET:randomBytes(32).toString('hex'),META_APP_SECRET:'acceptance-only-not-provider',META_WEBHOOK_VERIFY_TOKEN:'ci-test',WHATSAPP_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64'),INTEGRATION_SECRET_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
 apiProcess=launch('api',process.execPath,['.build/apps/api/src/server.js'],env);
 webProcess=launch('web',process.execPath,['apps/web/server.mjs'],env);
 await waitForHealth();
 assert.equal((await expectCode('/api/v1/auth/me',{},401)).error!==undefined,true);
 const first=await expectCode('/api/v1/auth/login',{method:'POST',body:{tenantSlug:slugA,email:`${slugA}@example.invalid`,password:pass}},200);
 const second=await expectCode('/api/v1/auth/login',{method:'POST',body:{tenantSlug:slugB,email:`${slugB}@example.invalid`,password:pass}},200);
 const one=first.token,two=second.token;
 assert.equal((await expectCode('/api/v1/auth/me',{token:one},200)).tenantId,ids[0].tenantId);
 assert.equal((await expectCode('/api/v1/auth/me',{token:two},200)).tenantId,ids[1].tenantId);
 const item=await expectCode('/api/v1/catalog',{method:'POST',token:one,body:{kind:'SERVICE',title:'اختبار خدمة الشركة الأولى',description:'خدمة خاصة بالشركة الأولى',categoryLabel:'خدمات',priceText:'100 EGP',imageUrl:'',externalUrl:''}},201);
 assert.ok(item.id,'Expected item ID');
 await expectCode('/api/v1/catalog/'+item.id+'/publish',{method:'POST',token:one},200);
 const listA=await expectCode('/api/v1/catalog',{token:one},200);
 const listB=await expectCode('/api/v1/catalog',{token:two},200);
 assert.ok(listA.some(x=>x.id===item.id));
 assert.equal(listB.some(x=>x.id===item.id),false,'Other company must not see catalog');
 await expectCode('/api/v1/catalog/'+item.id,{method:'PUT',token:two,body:{kind:'SERVICE',title:'Foreign edit',description:'Invalid',categoryLabel:'',priceText:'',imageUrl:'',externalUrl:''}},404);
 const faq=await expectCode('/api/v1/knowledge',{method:'POST',token:one,body:{question:'ما هي ساعات العمل؟',answer:'من التاسعة إلى الخامسة'}},201);
 await expectCode('/api/v1/knowledge/'+faq.id+'/publish',{method:'PATCH',token:one},200);
 assert.equal((await expectCode('/api/v1/knowledge',{token:two},200)).some(x=>x.id===faq.id),false);
 const def={name:'Acceptance flow',startId:'start',nodes:[
  {id:'start',type:'START',next:'hello'},
  {id:'hello',type:'TEXT',text:'أهلًا بك في شركتنا',next:'menu'},
  {id:'menu',type:'BUTTONS',text:'كيف نساعدك؟',choices:[
    {id:'products',title:'المنتجات',next:'finish'},{id:'agent',title:'موظف',next:'handoff'}]},
  {id:'finish',type:'END',text:'شكرًا لك'},
  {id:'handoff',type:'HANDOFF',text:'سنتواصل معك'}]};
 const initial=await expectCode('/api/v1/flows',{token:one},200);
 const revision=Number(initial.draft.draftRevision||0);
 await expectCode('/api/v1/flows/draft',{method:'PUT',token:one,body:{...def,expectedRevision:revision}},200);
 const published=await expectCode('/api/v1/flows/publish',{method:'POST',token:one},200);
 assert.ok(Number(published.version)>0);
 const otherFlows=await expectCode('/api/v1/flows',{token:two},200);
 assert.equal(otherFlows.published,null);
 const preview=await expectCode('/api/v1/flows/preview',{method:'POST',token:one,body:{definition:def,state:{at:null,answers:{},tags:[]}}},200);
 assert.ok(preview.messages.some(m=>m.text?.includes('أهلًا')));
 assert.ok(preview.messages.some(m=>m.type==='BUTTONS'));
 const widgetConfig=await expectCode('/api/v1/widget/settings',{method:'PUT',token:one,body:{
   enabled:true,title:'اختبار مساعد الموقع',origins:[base]}},200);
 assert.match(widgetConfig.widgetKey,/^[A-Za-z0-9_-]{32}$/);
 const visitor=await expectCode('/api/v1/widget/start',{method:'POST',headers:{origin:base},body:{
   widgetKey:widgetConfig.widgetKey,name:'زائر تجريبي'}},201);
 assert.match(visitor.token,/^[A-Za-z0-9_-]{43}$/);
 const visitorOpts={token:visitor.token,headers:{origin:base}};
 const initialWidget=await expectCode('/api/v1/widget/messages',visitorOpts,200);
 assert.ok(initialWidget.messages.some(m=>String(m.body).includes('أهلًا')),'Widget must deliver published greeting');
 await expectCode('/api/v1/widget/messages',{token:visitor.token,headers:{origin:'https://unapproved.example'}},401);
 const visitorMessage=randomUUID();
 await expectCode('/api/v1/widget/send',{method:'POST',...visitorOpts,body:{
   messageId:visitorMessage,text:'',actionId:'flow:menu:agent'}},200);
 const duplicate=await expectCode('/api/v1/widget/send',{method:'POST',...visitorOpts,body:{
   messageId:visitorMessage,text:'',actionId:'flow:menu:agent'}},200);
 assert.equal(duplicate.duplicate,true,'Website message dedupe must reject replay');
 const afterWidget=await expectCode('/api/v1/widget/messages',visitorOpts,200);
 assert.equal(afterWidget.status,'HUMAN','Staff handoff must silence bot');
 const leadsA=await expectCode('/api/v1/leads',{token:one},200);
 assert.ok(leadsA.some(l=>l.stage==='READY_FOR_AGENT'),'Website visitor should become qualified lead');
 assert.equal((await expectCode('/api/v1/leads',{token:two},200)).length,0,'Company B must not see Company A visitor');
 const inboxA=await expectCode('/api/v1/whatsapp/inbox',{token:one},200);
 assert.ok(inboxA.some(c=>c.channel==='WEBSITE'&&c.status==='HUMAN'),'Employee inbox must show handoff');
 console.log('PASS real Website Chat: published greeting, origin restriction, dedupe, lead qualification and staff handoff');
 await expectCode('/api/v1/leads',{token:one},200);
 await expectCode('/api/v1/contacts',{token:one},200);
 await expectCode('/api/v1/team',{token:one},200);
 await expectCode('/api/v1/summary',{token:one},200);
 await expectCode('/api/v1/whatsapp/inbox',{token:one},200);
 const home=await request('/');assert.equal(home.status,200);assert.match(home.data,/Elhafez Boat/);
 const widget=await request('/widget.js');assert.equal(widget.status,200);assert.match(widget.data,/widget/i);
 const pageAuth={slug:slugA,email:`${slugA}@example.invalid`,password:pass};
 const worker=launch('worker',process.execPath,['.build/apps/worker/main.js'],{...env,META_GRAPH_VERSION:'v24.0'});
 let healthy=false;
 for(let i=0;i<35;i++){
   if(worker.exitCode!==null)throw new Error('Worker exited during poll');
   const seen=await db.query('SELECT count(*)::int AS n FROM chatbot_worker_health WHERE tenant_id=ANY($1::uuid[]) AND last_error_code IS NULL',[ids.map(x=>x.tenantId)]);
   if(Number(seen.rows[0]?.n)>=2){healthy=true;break}
   await sleep(350);
 }
 assert.ok(healthy,'Worker did not process both tenants using restricted runtime role');
 console.log('PASS background worker heartbeat for both scoped tenant queues');
 const started=performance.now();
 const batch=await Promise.all(Array.from({length:40},()=>request('/api/v1/catalog',{token:one})));
 const elapsed=performance.now()-started;
 assert.ok(batch.every(x=>x.status===200),'Concurrent catalog requests failed');
 assert.ok(elapsed<10000,'40 concurrent authenticated catalog requests exceeded 10s on CI');
 console.log('PASS 40 concurrent authenticated catalog requests in '+Math.round(elapsed)+'ms (CI smoke, not load benchmark)');
 // Browser acceptance uses this **disposable** account only, never real credentials.
 const {writeFile,mkdir}=await import('node:fs/promises');
 await mkdir('acceptance-evidence',{recursive:true});
 await writeFile('acceptance-evidence/browser-account.json',JSON.stringify(pageAuth));
 console.log('PASS live HTTP through web gateway: auth, tenant boundary, catalog, FAQ, flow save/publish/preview, leads and inbox');
 console.log('PASS runtime uses PostgreSQL non-owner, non-superuser, non-BYPASSRLS role');
 // Keep API/web running for browser test, executed as child before cleanup.
 const browser=spawn(process.execPath,['tests/browser-acceptance.mjs'],{env:{...process.env,WEB_BASE_URL:base,ACCEPTANCE_BROWSER_ACCOUNT:'acceptance-evidence/browser-account.json'},stdio:'inherit'});
 const [code]=await once(browser,'exit');
 assert.equal(code,0,'Chromium/browser acceptance failed');
 const logout=await expectCode('/api/v1/auth/logout',{method:'POST',token:one},200);
 assert.ok(logout);
 await expectCode('/api/v1/auth/me',{token:one},401);
 console.log('PASS post-logout token invalidation');
}catch(error){console.error('ACCEPTANCE FAILURE:',error);console.error(logs.slice(-12).join('\n'));process.exitCode=1;}
finally{
 for(const p of processes){if(p?.exitCode===null){p.kill('SIGTERM');await Promise.race([once(p,'exit').catch(()=>{}),sleep(2500)]);if(p.exitCode===null)p.kill('SIGKILL')}}
 await db.end();
 // Test fixture accounts intentionally remain only in the disposable CI database.
}