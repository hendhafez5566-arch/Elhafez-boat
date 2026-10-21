/** Disposable end-to-end acceptance with a real non-owner PostgreSQL runtime role.
 * Runs only after migrations on an isolated CI database. NEVER run against production.
 */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
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
const {closureProvider}=await import('./support/closure-provider.mjs');const sim=await closureProvider();
process.env.OFFLINE_PROVIDER_ORIGIN=sim.origin;await import('./support/offline-transport.mjs');
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
 await db.query('INSERT INTO platform_owners(email,password_hash) VALUES($1,$2)',[email,hash]);
 const platformUrl=new URL(adminUrl);platformUrl.searchParams.set('application_name','boat-platform-'+suffix);
 const ids=[];
 for(const [slug,name] of [[slugA,'Acceptance Company A'],[slugB,'Acceptance Company B']]){
  const t=(await db.query('INSERT INTO tenants(slug,name) VALUES($1,$2) RETURNING id',[slug,name])).rows[0].id;
  const u=(await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id',[`${slug}@example.invalid`,hash])).rows[0].id;
  await db.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')`,[t,u]);
  await db.query(`INSERT INTO tenant_subscriptions(tenant_id,plan_code,status,current_period_ends_at) VALUES($1,'STARTER','TRIAL',now()+interval '14 days')`,[t]);
  ids.push({tenantId:t,userId:u,slug});
 }
 // A real low-privilege role (unlike SET ROLE from a privileged connection).
 const env={OUTBOUND_WEBHOOK_HOSTS:'webhook.fixture.invalid,webhook.fixture.test',APP_PUBLIC_ORIGIN:'https://pilot.fixture.test',META_APP_ID:'9999911111',META_GRAPH_VERSION:'v24.0',META_EMBEDDED_CONFIG_ID:'1111122222',META_COEXISTENCE_CONFIG_ID:'3333344444',META_EMBEDDED_SIGNUP_ENABLED:'true',META_ONBOARDING_REVIEWED:'true',META_COEXISTENCE_ENABLED:'true',NODE_OPTIONS:'--import=./tests/support/offline-transport.mjs',OFFLINE_PROVIDER_ORIGIN:sim.origin,CLAMAV_SOCKET:process.env.CLAMAV_SOCKET,DATABASE_URL:runtimeUrl.toString(),PLATFORM_DATABASE_URL:platformUrl.toString(),PORT:'4000',WEB_PORT:'3000',API_INTERNAL_ORIGIN:'http://[::1]:4000',RATE_LIMIT_SECRET:randomBytes(32).toString('hex'),META_APP_SECRET:'acceptance-only-not-provider',META_WEBHOOK_VERIFY_TOKEN:'ci-test',WHATSAPP_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64'),INTEGRATION_SECRET_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
 apiProcess=launch('api',process.execPath,['.build/apps/api/src/server.js'],env);
 webProcess=launch('web',process.execPath,['apps/web/server.mjs'],env);
 await waitForHealth();
 assert.equal((await expectCode('/api/v1/auth/me',{},401)).error!==undefined,true);
 const first=await expectCode('/api/v1/auth/login',{method:'POST',body:{tenantSlug:slugA,email:`${slugA}@example.invalid`,password:pass}},200);
 const second=await expectCode('/api/v1/auth/login',{method:'POST',body:{tenantSlug:slugB,email:`${slugB}@example.invalid`,password:pass}},200);
 const one=first.token,two=second.token;
 assert.equal((await expectCode('/api/v1/auth/me',{token:one},200)).tenantId,ids[0].tenantId);
 assert.equal((await expectCode('/api/v1/auth/me',{token:two},200)).tenantId,ids[1].tenantId);
 await expectCode('/api/v1/platform/tenants',{token:one},401);
 const platformSession=await expectCode('/api/v1/platform/auth/login',{method:'POST',body:{email,password:pass}},200);
 await expectCode('/api/v1/platform/tenants',{token:platformSession.token},200);
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
 const leadId=String(leadsA[0].id);
 const dueAt=new Date(Date.now()+86400000).toISOString();
 const task=await expectCode('/api/v1/leads/'+leadId+'/tasks',{method:'POST',token:one,body:{description:'اتصال متابعة تجريبي',dueAt}},201);
 const tasks=await expectCode('/api/v1/leads/'+leadId+'/tasks',{token:one},200);
 assert.ok(tasks.some(t=>t.id===task.id&&t.status==='OPEN'),'CRM task must persist');
 await expectCode('/api/v1/leads/'+leadId+'/tasks',{token:two},404);
 const score=(await expectCode('/api/v1/leads',{token:one},200)).find(l=>l.id===leadId);
 assert.ok(Number(score.priorityScore)>=0&&Number(score.priorityScore)<=100,'CRM priority must be bounded');
 const analytics=await expectCode('/api/v1/analytics/overview',{token:one},200);
 assert.ok(analytics.conversations>=1&&analytics.leads>=1&&analytics.tasks.open>=1,'Live tenant analytics must include lead and task');
 assert.equal((await expectCode('/api/v1/analytics/overview',{token:two},200)).leads,0,'Analytics must isolate companies');
 await expectCode('/api/v1/leads/'+leadId+'/tasks/'+task.id+'/complete',{method:'POST',token:one},200);
 assert.ok((await expectCode('/api/v1/leads/'+leadId+'/tasks',{token:one},200)).some(t=>t.id===task.id&&t.status==='DONE'));
 console.log('PASS real CRM follow-up task, role-scoped endpoint, lead priority and tenant-isolated analytics');

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
 const pageAuth={slug:slugA,email:`${slugA}@example.invalid`,password:pass,platform:{email,password:pass}};
 // Publish a new version with a real short delay. Earlier customer sessions remain pinned.
 const flowRevision=await expectCode('/api/v1/flows',{token:one},200);
 const delayedFlow={name:'Delayed support flow',startId:'start',nodes:[
  {id:'start',type:'START',next:'greeting'},
  {id:'greeting',type:'TEXT',text:'رسالة قبل الانتظار',next:'pause'},
  {id:'pause',type:'DELAY',seconds:1,next:'followup'},
  {id:'followup',type:'TEXT',text:'رسالة بعد الانتظار',next:'end'},
  {id:'end',type:'END',text:'انتهت المحادثة'}]};
 await expectCode('/api/v1/flows/draft',{method:'PUT',token:one,body:{
   ...delayedFlow,expectedRevision:Number(flowRevision.draft.draftRevision||0)}},200);
 await expectCode('/api/v1/flows/publish',{method:'POST',token:one},200);
 const waitingVisitor=await expectCode('/api/v1/widget/start',{method:'POST',headers:{origin:base},body:{
   widgetKey:widgetConfig.widgetKey,name:'زائر تأخير تجريبي'}},201);
 const waitingOpts={token:waitingVisitor.token,headers:{origin:base}};
 const beforeResume=await expectCode('/api/v1/widget/messages',waitingOpts,200);
 assert.ok(beforeResume.messages.some(m=>String(m.body).includes('قبل الانتظار')));
 assert.equal(beforeResume.messages.some(m=>String(m.body).includes('بعد الانتظار')),false);
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
 let resumed=false;
 for(let i=0;i<40;i++){
   const messages=await expectCode('/api/v1/widget/messages',waitingOpts,200);
   if(messages.messages.some(m=>String(m.body).includes('بعد الانتظار'))){resumed=true;break}
   await sleep(300);
 }
 assert.ok(resumed,'Delayed website reply was not resumed by background worker');
 const afterResume=await expectCode('/api/v1/widget/messages',waitingOpts,200);
 assert.equal(afterResume.messages.filter(m=>String(m.body).includes('بعد الانتظار')).length,1,'Delayed reply must not be duplicated');
 console.log('PASS real delayed conversation continuation from PostgreSQL worker, exactly once');

 // Full public API -> restricted worker -> production HTTP boundary -> durable continuation.
 const requestIntegration=await expectCode('/api/v1/integrations',{method:'POST',token:one,body:{name:'Offline request fixture',url:'https://webhook.fixture.test/receive',authMode:'NONE'}},201);
 const requestFixture='public-widget-'+suffix;
 const requestCalls=()=>sim.calls.filter(c=>c.host==='webhook.fixture.test'&&c.body.fixture===requestFixture);
 const requestDefinition={name:'Durable public request',startId:'s',nodes:[{id:'s',type:'START',next:'api'},{id:'api',type:'WEBHOOK',integrationId:requestIntegration.id,next:'ok',request:{method:'POST',timeoutSeconds:10,maxAttempts:1,body:{fixture:requestFixture},mapping:[{path:'data.value',field:'api_value'}],errorNext:'error',timeoutNext:'timeout'}},...['ok','error','timeout'].map(id=>({id,type:'END',text:'request_'+id+' {{api_value}}'}))]};
 const requestRevision=await expectCode('/api/v1/flows',{token:one},200);
 await expectCode('/api/v1/flows/draft',{method:'PUT',token:one,body:{...requestDefinition,expectedRevision:requestRevision.draft.draftRevision}},200);
 await expectCode('/api/v1/flows/publish',{method:'POST',token:one},200);
 for(const [mode,outcome] of [['','ok'],['429','error'],['hold','timeout']]){
  sim.modes.set('webhook.fixture.test',mode);const beforeCalls=requestCalls().length;
  // Earlier PG fixtures share this host and workers drain every synthetic tenant.
  // Exercise unrelated traffic explicitly; it must not weaken this wait's once-only assertion.
  if(outcome==='ok'){const unrelated=await fetch(sim.origin+'/receive',{method:'POST',headers:{'content-type':'application/json','x-fixture-host':'webhook.fixture.test','idempotency-key':'independent-'+suffix},body:JSON.stringify({fixture:'independent-'+suffix})});assert.equal(unrelated.status,200);assert.equal(requestCalls().length,beforeCalls);}
  const requestVisitor=await expectCode('/api/v1/widget/start',{method:'POST',headers:{origin:base},body:{widgetKey:widgetConfig.widgetKey,name:'Synthetic request '+outcome}},201);
  const opts={token:requestVisitor.token,headers:{origin:base}};let result;
  for(let i=0;i<150;i++){result=await expectCode('/api/v1/widget/messages',opts,200);if(result.messages.some(m=>String(m.body).startsWith('request_'+outcome)))break;await sleep(200)}
  assert.equal(result.messages.filter(m=>String(m.body).startsWith('request_'+outcome)).length,1,'One public request continuation for '+outcome);
  if(outcome==='ok')assert.ok(result.messages.some(m=>String(m.body).includes('fixture-response')));
  assert.equal(requestCalls().length-beforeCalls,1,'One HTTP POST attempt for '+outcome);
  const job=(await db.query('SELECT id,attempts FROM chatbot_integration_jobs WHERE tenant_id=$1 AND integration_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1',[ids[0].tenantId,requestIntegration.id])).rows[0];
  assert.equal(job.attempts,1,'One durable dispatch attempt for '+outcome);assert.equal(requestCalls().filter(c=>c.idempotencyKey===job.id&&c.method==='POST').length,1,'One actual HTTP POST for the exact persisted job '+outcome);
 }
 sim.modes.delete('webhook.fixture.test');
 const restoreRevision=await expectCode('/api/v1/flows',{token:one},200);
 await expectCode('/api/v1/flows/draft',{method:'PUT',token:one,body:{...delayedFlow,expectedRevision:restoreRevision.draft.draftRevision}},200);
 await expectCode('/api/v1/flows/publish',{method:'POST',token:one},200);
 console.log('PASS public API/widget + real restricted worker/HTTP boundary: mapped response, HTTP failure and timeout, one POST per wait');

 // Two API replicas and competing workers against the same limited-role database.
 const replica=launch('api-replica',process.execPath,['.build/apps/api/src/server.js'],{...env,PORT:'4001'});
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:4001/health')).ok)break}catch{}await sleep(200)}
 const replicaRead=()=>fetch('http://127.0.0.1:4001/api/v1/catalog',{headers:{authorization:'Bearer '+one}});
 assert.equal((await replicaRead()).status,200);
 const secondWorker=launch('worker-2',process.execPath,['.build/apps/worker/main.js'],{...env,META_GRAPH_VERSION:'v24.0'});
 const crashVisitor=await expectCode('/api/v1/widget/start',{method:'POST',headers:{origin:base},body:{widgetKey:widgetConfig.widgetKey,name:'Crash recovery visitor'}},201);
 // Kill the first worker; committed delay state must remain exactly-once with a competitor alive.
 worker.kill('SIGKILL');await once(worker,'exit');
 apiProcess.kill('SIGKILL');await once(apiProcess,'exit');
 apiProcess=launch('api-restarted',process.execPath,['.build/apps/api/src/server.js'],env);
 for(let i=0;i<60;i++){try{if((await request('/health')).status===200)break}catch{}await sleep(200)}
 assert.equal((await request('/api/v1/auth/me',{token:one})).status,200,'Durable login survives API crash');
 // Drop idle runtime DB connections, simulating a connection interruption without deleting data.
 await sleep(300);
 await db.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename=$1 AND state=\'idle\'',[role]);
 await sleep(500);
 await expectCode('/api/v1/platform/tenants',{token:platformSession.token},200);
 await db.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name=$1 AND state=\'idle\'',['boat-platform-'+suffix]);
 await sleep(200);
 assert.equal(apiProcess.exitCode,null,'Idle DB disconnect must not crash API');
 await expectCode('/api/v1/platform/tenants',{token:platformSession.token},200);
 console.log('PASS platform admin pool reconnects; company token cannot access platform administration');
 assert.equal(secondWorker.exitCode,null,'Idle DB disconnect must not crash worker');
 assert.equal((await replicaRead()).status,200,'Replica reconnects after DB connection termination');
 let crashReplies;for(let i=0;i<60;i++){crashReplies=await expectCode('/api/v1/widget/messages',{token:crashVisitor.token,headers:{origin:base}},200);if(crashReplies.messages.some(m=>String(m.body).includes('بعد الانتظار')))break;await sleep(250)}
 assert.equal(crashReplies.messages.filter(m=>String(m.body).includes('بعد الانتظار')).length,1,'Competing worker must resume pending delay after peer crash');
 const recovered=await expectCode('/api/v1/widget/messages',waitingOpts,200);
 assert.equal(recovered.messages.filter(m=>String(m.body).includes('بعد الانتظار')).length,1);
 console.log('PASS API SIGKILL/restart, competing worker survival, idle PostgreSQL disconnect/reconnect, durable session and completed delay preserved');
 const restartedWorker=launch('worker-restarted',process.execPath,['.build/apps/worker/main.js'],{...env,META_GRAPH_VERSION:'v24.0'});
 const hz=Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'}).trim());
 async function resources(child){const stat=await readFile('/proc/'+child.pid+'/stat','utf8'),fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');const status=await readFile('/proc/'+child.pid+'/status','utf8');return {cpuTicks:Number(fields[11])+Number(fields[12]),rssBytes:Number(/VmRSS:\s+(\d+)/.exec(status)?.[1]||0)*1024}}
 const measured=[['api',apiProcess],['api-replica',replica],['worker',secondWorker],['worker-restarted',restartedWorker]];
 const initialResources=await Promise.all(measured.map(async([name,p])=>({name,...await resources(p)})));
 const peakRss=initialResources.map(r=>r.rssBytes);let sampling=false;
 const sampler=setInterval(async()=>{if(sampling)return;sampling=true;try{for(let i=0;i<measured.length;i++){const r=await resources(measured[i][1]);peakRss[i]=Math.max(peakRss[i],r.rssBytes)}}catch{}finally{sampling=false}},50);
 const latency=[];let next=0;const loadStarted=performance.now();

 await Promise.all(Array.from({length:40},async()=>{while(next<400){const i=next++;const t=performance.now();const response=i%2?await replicaRead():await fetch('http://127.0.0.1:4000/api/v1/catalog',{headers:{authorization:'Bearer '+one}});await response.arrayBuffer();assert.equal(response.status,200);latency.push(performance.now()-t)}}));
 latency.sort((a,b)=>a-b);const loadMs=performance.now()-loadStarted;
 clearInterval(sampler);const serverResources=await Promise.all(measured.map(async([name,p],i)=>{const r=await resources(p);return {name,cpuMs:1000*(r.cpuTicks-initialResources[i].cpuTicks)/hz,peakSampledRssBytes:Math.max(peakRss[i],r.rssBytes)}}));
 const load={requests:400,concurrency:40,apiInstances:2,workers:2,elapsedMs:loadMs,requestsPerSecond:400000/loadMs,p50Ms:latency[200],p95Ms:latency[380],p99Ms:latency[396],serverResources,scope:'authenticated catalog reads only; not full workload capacity'};
 const fs=await import('node:fs/promises');await fs.mkdir('acceptance-evidence',{recursive:true});await fs.writeFile('acceptance-evidence/http-load.json',JSON.stringify(load,null,2));console.log('PASS HTTP load '+JSON.stringify(load));
 // A shared identity must enforce a single budget across independent DB clients.
 const {distributedLimit}=await import('../.build/apps/api/src/rate-limit.js');
 process.env.RATE_LIMIT_SECRET=env.RATE_LIMIT_SECRET;
 const budgetClients=await Promise.all(Array.from({length:2},async()=>{const c=new pg.Client({connectionString:runtimeUrl.toString()});await c.connect();return c}));
 try{const outcomes=await Promise.allSettled(Array.from({length:40},(_,i)=>distributedLimit(budgetClients[i%2],'acceptance-'+suffix,20,3600)));assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,20);assert.ok(outcomes.filter(r=>r.status==='rejected').every(r=>r.reason.status===429))}finally{await Promise.all(budgetClients.map(c=>c.end()))}
 console.log('PASS distributed throttle: 40 attempts, exactly 20 accepted / 20 HTTP 429 outcomes');
 const started=performance.now();
 const batch=await Promise.all(Array.from({length:40},()=>request('/api/v1/catalog',{token:one})));
 const elapsed=performance.now()-started;
 assert.ok(batch.every(x=>x.status===200),'Concurrent catalog requests failed');
 assert.ok(elapsed<10000,'40 concurrent authenticated catalog requests exceeded 10s on CI');
 console.log('PASS 40 concurrent authenticated catalog requests in '+Math.round(elapsed)+'ms (CI smoke, not load benchmark)');
 // Existing smoke remains; new closure gaps run independently of it.
 if(process.env.CI_LOCAL_CLOSURE==='1'){
  for(const p of processes.filter(p=>p!==apiProcess&&p!==webProcess&&p!==replica)){if(p.exitCode===null)p.kill('SIGTERM')}
  process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY=env.WHATSAPP_TOKEN_ENCRYPTION_KEY;process.env.INTEGRATION_SECRET_ENCRYPTION_KEY=env.INTEGRATION_SECRET_ENCRYPTION_KEY;process.env.META_GRAPH_VERSION='v24.0';
  // Keep two instrumented workers for mixed load; stop them before provider fixtures.
  const {localClosure}=await import('./local-closure.mjs');await localClosure({db,env,sim,launch,request,expectCode,apiProcesses:[apiProcess,replica]});
  // Closure intentionally stops its crash/load workers; browser uploads still need the real scanner queue.
  launch('browser-scan-worker',process.execPath,['.build/apps/worker/main.js'],env);
 }
 const browserFlow=await expectCode('/api/v1/flows',{token:one},200);await expectCode('/api/v1/flows/draft',{method:'PUT',token:one,body:{...def,expectedRevision:browserFlow.draft.draftRevision}},200);await expectCode('/api/v1/flows/publish',{method:'POST',token:one},200);
 // Browser acceptance uses this **disposable** account only, never real credentials.
 const {writeFile,mkdir}=await import('node:fs/promises');
 await mkdir('acceptance-evidence',{recursive:true});
 // Separate fixture actors for load, broad UI and novice UI preserve the real per-user limiter.
 async function browserAccount(label){const email=label+'-'+suffix+'@example.invalid';const user=(await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id',[email,hash])).rows[0].id;await db.query("INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')",[ids[0].tenantId,user]);return {...pageAuth,email,widgetKey:widgetConfig.widgetKey,roles:process.env.CI_LOCAL_CLOSURE==='1'?JSON.parse(await readFile('acceptance-evidence/browser-roles-private.json','utf8')):[]}}
 await writeFile('acceptance-evidence/browser-account.json',JSON.stringify(await browserAccount('broad-ui')));
 console.log('PASS live HTTP through web gateway: auth, tenant boundary, catalog, FAQ, flow save/publish/preview, leads and inbox');
 console.log('PASS runtime uses PostgreSQL non-owner, non-superuser, non-BYPASSRLS role');
 // Keep API/web running for browser test, executed as child before cleanup.
 if(process.env.CI_BOT_BROWSER_ONLY!=='1'){
 const browser=spawn(process.execPath,['tests/browser-acceptance.mjs'],{env:{...process.env,WEB_BASE_URL:base,ACCEPTANCE_BROWSER_ACCOUNT:'acceptance-evidence/browser-account.json'},stdio:'inherit'});
 const [code]=await once(browser,'exit');
 assert.equal(code,0,'Chromium/browser acceptance failed');
 }
 // Unroutable, synthetic campaign fixture: review only, never launch or real provider auth.
 const reviewAccount=(await db.query(`INSERT INTO whatsapp_accounts(tenant_id,phone_number_id,waba_id,access_token_encrypted,connected_by) VALUES($1,$2,'9999911111','DISPOSABLE-NOT-A-PROVIDER-CREDENTIAL',$3) RETURNING id`,[ids[0].tenantId,BigInt('0x'+randomBytes(8).toString('hex')).toString(),ids[0].userId])).rows[0].id;
 const reviewTemplate=(await db.query(`INSERT INTO whatsapp_approved_templates(tenant_id,account_id,template_name,language_code,category,components) VALUES($1,$2,'review_fixture','ar','MARKETING',$3::jsonb) RETURNING id`,[ids[0].tenantId,reviewAccount,JSON.stringify([{type:'BODY',text:'قالب اختبار محلي — لا يُرسل'}])])).rows[0].id;
 const reviewCampaign=(await db.query(`INSERT INTO chatbot_campaigns(tenant_id,name,segment,steps,start_at,created_by) VALUES($1,'حملة مراجعة محلية دون إرسال','{}',$2::jsonb,now()+interval '1 day',$3) RETURNING id`,[ids[0].tenantId,JSON.stringify([{templateId:reviewTemplate,offsetMinutes:0}]),ids[0].userId])).rows[0].id;
 await db.query(`INSERT INTO whatsapp_approved_templates(tenant_id,account_id,template_name,language_code,category,components) VALUES($1,$2,'fixture_carousel','ar','MARKETING',$3::jsonb)`,[ids[0].tenantId,reviewAccount,JSON.stringify([{type:'BODY',text:'بطاقات محلية'},{type:'CAROUSEL',cards:[0,1].map(()=>({components:[{type:'HEADER',format:'IMAGE'},{type:'BODY',text:'بطاقة {{1}}'},{type:'BUTTONS',buttons:[{type:'URL',text:'زيارة',url:'https://example.invalid/item/{{1}}'}]}]}))}])]);
 // Dedicated company preserves the production seat limit instead of raising it for test actors.
 const teamSlug='team-browser-'+suffix,teamEmail=teamSlug+'@example.invalid';
 const teamTenant=(await db.query('INSERT INTO tenants(slug,name) VALUES($1,$2) RETURNING id',[teamSlug,'Disposable team browser company'])).rows[0].id;
 const teamOwner=(await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id',[teamEmail,hash])).rows[0].id;
 await db.query("INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')",[teamTenant,teamOwner]);
 await db.query("INSERT INTO tenant_subscriptions(tenant_id,plan_code,status,current_period_ends_at) VALUES($1,'STARTER','TRIAL',now()+interval '14 days')",[teamTenant]);
 await db.query(`INSERT INTO whatsapp_approved_templates(tenant_id,account_id,template_name,language_code,category,components) VALUES($1,$2,'fixture_named','ar','MARKETING',$3::jsonb),($1,$2,'fixture_media','ar','MARKETING',$4::jsonb)`,[ids[0].tenantId,reviewAccount,JSON.stringify([{type:'HEADER',format:'TEXT',text:'أهلًا {{business}}'},{type:'BODY',text:'مرحبًا {{customer}}'},{type:'BUTTONS',buttons:[{type:'QUICK_REPLY',text:'مهتم'},{type:'URL',text:'التفاصيل',url:'https://example.invalid/offer/{{1}}'}]}]),JSON.stringify([{type:'HEADER',format:'IMAGE'},{type:'BODY',text:'رسالة {{1}}'}])]);
 await writeFile('acceptance-evidence/bot-browser-account.json',JSON.stringify({...await browserAccount('novice-ui'),team:{slug:teamSlug,email:teamEmail,password:pass}}));
 // A separate real IPv4 gateway gives the independent novice/team client its own network identity.
 // The broad/API client uses IPv6. The production 10/600-second limit and counters stay unchanged.
 launch('novice-web',process.execPath,['apps/web/server.mjs'],{...env,WEB_PORT:'3002',API_INTERNAL_ORIGIN:'http://127.0.0.1:4000'});
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:3002/health')).ok)break}catch{}await sleep(100)}
 const botBrowser=spawn(process.execPath,['tests/bots-browser.mjs'],{env:{...process.env,WEB_BASE_URL:'http://127.0.0.1:3002',ACCEPTANCE_BROWSER_ACCOUNT:'acceptance-evidence/bot-browser-account.json'},stdio:'inherit'});
 const [botCode]=await once(botBrowser,'exit');assert.equal(botCode,0,'Independent bot browser acceptance failed');
 const premiumAccount=await browserAccount('premium-ui');
 const premiumBrowser=spawn(process.execPath,['tests/premium-builder-browser.mjs'],{env:{...process.env,WEB_BASE_URL:'http://127.0.0.1:3002',ACCEPTANCE_SLUG:premiumAccount.slug,ACCEPTANCE_EMAIL:premiumAccount.email,ACCEPTANCE_PASSWORD:premiumAccount.password},stdio:'inherit'});
 const [premiumCode]=await once(premiumBrowser,'exit');assert.equal(premiumCode,0,'Premium flow builder Chromium acceptance failed');
 const controlsHttp=spawn(process.execPath,['tests/flow-controls-http.mjs'],{env:{...process.env,WEB_BASE_URL:base,ACCEPTANCE_BROWSER_ACCOUNT:'acceptance-evidence/browser-account.json'},stdio:'inherit'});const [controlsCode]=await once(controlsHttp,'exit');assert.equal(controlsCode,0,'Flow controls HTTP acceptance failed');
 if(process.env.CI_TRACE_BROWSER==='1'){const traceBrowser=spawn(process.execPath,['tests/flow-trace-browser.mjs'],{env:{...process.env,WEB_BASE_URL:'http://127.0.0.1:3002'},stdio:'inherit'});const [traceCode]=await once(traceBrowser,'exit');assert.equal(traceCode,0,'Committed conversation trace browser acceptance failed');const requests=spawn(process.execPath,['tests/flow-request-browser.mjs'],{env:{...process.env,WEB_BASE_URL:'http://127.0.0.1:3002'},stdio:'inherit'});const [requestCode]=await once(requests,'exit');assert.equal(requestCode,0,'Request editor and response preview browser acceptance failed');}
 if(process.env.CI_INTEGRATED_BROWSER==='1'){const rich=spawn(process.execPath,['tests/integrated-builder-browser.mjs'],{env:{...process.env,WEB_BASE_URL:'http://127.0.0.1:3002'},stdio:'inherit'});const [richCode]=await once(rich,'exit');assert.equal(richCode,0,'Integrated cards/actions/drawing Chromium acceptance failed');}
 assert.equal((await db.query('SELECT count(*)::int AS n FROM chatbot_campaign_jobs WHERE tenant_id=$1 AND campaign_id=$2',[ids[0].tenantId,reviewCampaign])).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM whatsapp_outbox WHERE tenant_id=$1 AND campaign_id=$2',[ids[0].tenantId,reviewCampaign])).rows[0].n,0);
 if(process.env.CI_OPS_BROWSER==='1'){const ops=spawn(process.execPath,['tests/flow-request-ops-browser.mjs'],{env:{...process.env,WEB_BASE_URL:'http://127.0.0.1:3002'},stdio:'inherit'});const [opsCode]=await once(ops,'exit');assert.equal(opsCode,0,'Request operations and no-replay Chromium acceptance failed');}
 console.log('PASS campaign browser review queued zero jobs and zero outbound messages');
 const logout=await expectCode('/api/v1/auth/logout',{method:'POST',token:one},200);
 assert.ok(logout);
 await expectCode('/api/v1/auth/me',{token:one},401);
 console.log('PASS post-logout token invalidation');
}catch(error){console.error('ACCEPTANCE FAILURE:',error);console.error(logs.slice(-12).join('\n'));process.exitCode=1;}
finally{
 for(const p of processes){if(p?.exitCode===null){p.kill('SIGTERM');await Promise.race([once(p,'exit').catch(()=>{}),sleep(2500)]);if(p.exitCode===null)p.kill('SIGKILL')}}
 await sim.close();await db.end();
 // Test fixture accounts intentionally remain only in the disposable CI database.
}