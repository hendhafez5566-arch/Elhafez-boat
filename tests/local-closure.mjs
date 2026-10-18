/** New acceptance gaps: real DB/API production paths, disposable fixtures only. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash,createHmac} from 'node:crypto';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {spawn,execFileSync} from 'node:child_process';
import {processDelay} from '../.build/apps/api/src/delay-scheduler.js';
import {once} from 'node:events';
import pg from 'pg';
import {publicTenant} from '../.build/apps/api/src/public-tenant.js';
import {passwordHash,tokenDigest} from '../.build/apps/api/src/auth.js';
import {sealIntegrationSecret,openIntegrationSecret} from '../.build/apps/api/src/integration-secrets.js';
import {saveConnector,beginConnectorOAuth,finishConnectorOAuth,syncContact,processConnector,connectorResources} from '../.build/apps/api/src/connectors.js';
import {connectSocial,processSocial} from '../.build/apps/api/src/social.js';
import {connectWhatsApp,disconnectWhatsApp,diagnoseWhatsApp,reconcileWhatsAppReceipt} from '../.build/apps/api/src/whatsapp.js';
import {registerApprovedTemplate} from '../.build/apps/api/src/templates.js';
import {createCampaign,cancelCampaign,launchCampaign} from '../.build/apps/api/src/campaigns.js';
import {uploadMedia,deleteMedia,publicMedia,validateManagedMedia} from '../.build/apps/api/src/media.js';
import {scanBytes,processMediaScan} from '../.build/apps/api/src/media-scan.js';
import {anonymizeContact,processRetention,exportContact} from '../.build/apps/api/src/privacy.js';
import {saveSubflow} from '../.build/apps/api/src/subflows.js';
import {groundedReply,saveAiSettings} from '../.build/apps/api/src/ai.js';
import {sendWebhook} from '../.build/apps/api/src/integrations.js';
export async function localClosure({db,env,sim,launch,request,expectCode,apiProcesses}){
 const pool=new pg.Pool({connectionString:env.DATABASE_URL,max:30});pool.on('error',()=>{});
 const tx=(tenant,fn)=>publicTenant(pool,tenant,fn),report={checks:[],mixed:null,explain:null};
 const check=(name)=>{report.checks.push(name);console.log('PASS LOCAL CLOSURE '+name)};
 const browserRoles=[];const tenants=[],suffix=randomBytes(4).toString('hex');
 const pass='Fixture-'+randomBytes(18).toString('hex'),hash=await passwordHash(pass);
 try{
 for(let i=0;i<4;i++){
  const tenant=(await db.query('INSERT INTO tenants(slug,name) VALUES($1,$2) RETURNING id',['mixed-'+suffix+'-'+i,'Mixed fixture '+i])).rows[0].id;
  const user=(await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id',['mixed-'+suffix+'-'+i+'@example.invalid',hash])).rows[0].id;
  await db.query("INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')",[tenant,user]);
  await db.query("INSERT INTO tenant_subscriptions(tenant_id,plan_code,status,current_period_ends_at) VALUES($1,'STARTER','TRIAL',now()+interval '14 days')",[tenant]);
  await db.query('INSERT INTO chatbot_usage_limits(tenant_id,daily_inbound,daily_templates,media_bytes) VALUES($1,100000,10000,52428800)',[tenant]);
  const token=randomBytes(32).toString('base64url');await db.query("INSERT INTO sessions(token_hash,tenant_id,user_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[tokenDigest(token),tenant,user]);
  tenants.push({tenant,user,token,slug:'mixed-'+suffix+'-'+i,actor:{tenantId:tenant,userId:user,role:'OWNER'}});
 }
 const a=tenants[0],b=tenants[1];
 // Seed linked immutable subflows and a delayed prompt -> handoff story in every company.
 const mixedWorkers=[];
 const clients=[];
 for(const t of tenants){
  const sub=await tx(t.tenant,c=>saveSubflow(c,t.actor,{definition:{name:'Pinned collect',startId:'s',nodes:[{id:'s',type:'START',next:'end'},{id:'end',type:'END',text:'Pinned company greeting'}]}}));
  const current=await expectCode('/api/v1/flows',{token:t.token},200);
  const definition={name:'Mixed load',startId:'s',nodes:[{id:'s',type:'START',next:'call'},{id:'call',type:'SUBFLOW',subflowId:sub.id,version:1,bindings:{},next:'pause'},{id:'pause',type:'DELAY',seconds:1,next:'ask'},{id:'ask',type:'INPUT',field:'need',text:'What do you need?',next:'handoff'},{id:'handoff',type:'HANDOFF',text:'Staff will help'}]};
  await expectCode('/api/v1/flows/draft',{method:'PUT',token:t.token,body:{...definition,expectedRevision:current.draft.draftRevision}},200);
  await expectCode('/api/v1/flows/publish',{method:'POST',token:t.token},200);
  const config=await expectCode('/api/v1/widget/settings',{method:'PUT',token:t.token,body:{enabled:true,title:'Mixed fixture',origins:['http://127.0.0.1:3000']}},200);t.widgetKey=config.widgetKey;
  const item=await expectCode('/api/v1/catalog',{method:'POST',token:t.token,body:{kind:'SERVICE',title:'Fixture <img src=x onerror=alert(1)>',description:"SQL fixture '; DROP TABLE contacts; --",categoryLabel:'Fixture',priceText:'100',imageUrl:'',externalUrl:''}},201);t.item=item.id;
  await expectCode('/api/v1/catalog/'+item.id+'/publish',{method:'POST',token:t.token},200);
 }
 await expectCode('/api/v1/catalog/'+a.item,{method:'PUT',token:b.token,body:{kind:'SERVICE',title:'Cross company',description:'Forbidden'}},404);
 // Real mixed workload for >=20 seconds, 200 visitors, thousands of HTTP/message operations.
 let n=0;const samples=[],counts={};const started=performance.now(),cpu=process.cpuUsage();
 await Promise.all(Array.from({length:20},async()=>{while(n<200){const i=n++,t=tenants[i%4],start=performance.now();const visitor=await expectCode('/api/v1/widget/start',{method:'POST',headers:{origin:'http://127.0.0.1:3000'},body:{widgetKey:t.widgetKey,name:'Fixture visitor '+i}},201);clients.push({token:visitor.token,tenant:t.tenant});samples.push(performance.now()-start)}}));
 await sleep(1100);
 // Compare the exact legacy idle policy with the corrected policy on real due jobs.
 // Two passes, four companies: identical production processor and eight jobs each.
 const legacyStarted=performance.now();
 for(let pass=0;pass<2;pass++){for(const t of tenants)assert.equal(await tx(t.tenant,c=>processDelay(c,t.tenant)),true);await sleep(2000)}
 const legacyMs=performance.now()-legacyStarted,correctedStarted=performance.now();
 for(let pass=0;pass<2;pass++)for(const t of tenants)assert.equal(await tx(t.tenant,c=>processDelay(c,t.tenant)),true);
 report.schedulerComparison={scope:'single dispatcher idle-policy comparison, real processor/DB, eight due jobs per policy',legacyMs,correctedMs:performance.now()-correctedStarted};
 mixedWorkers.push(launch('mixed-worker-1',process.execPath,['.build/apps/worker/main.js'],env),launch('mixed-worker-2',process.execPath,['.build/apps/worker/main.js'],env));
 const hz=Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'}).trim());
 const measured=[...apiProcesses,...mixedWorkers];
 async function resource(p){const stat=await readFile('/proc/'+p.pid+'/stat','utf8'),fields=stat.slice(stat.lastIndexOf(')')+2).split(' '),status=await readFile('/proc/'+p.pid+'/status','utf8');return {cpuTicks:Number(fields[11])+Number(fields[12]),rss:Number(/VmRSS:\s+(\d+)/.exec(status)?.[1]||0)*1024}}
 const initial=await Promise.all(measured.map(resource)),peak=initial.map(x=>x.rss);let peakQueueLag=0,sampling=false;
 const sampler=setInterval(async()=>{if(sampling)return;sampling=true;try{for(let i=0;i<measured.length;i++){const r=await resource(measured[i]);peak[i]=Math.max(peak[i],r.rss)}const q=await db.query("SELECT coalesce(max(extract(epoch FROM now()-due_at)),0)::float lag FROM chatbot_delay_jobs WHERE tenant_id=ANY($1::uuid[]) AND status='PENDING'",[tenants.map(t=>t.tenant)]);peakQueueLag=Math.max(peakQueueLag,q.rows[0].lag)}catch{}finally{sampling=false}},500);
 let cursor=0;const until=performance.now()+30000;

 await Promise.all(Array.from({length:20},async()=>{while(performance.now()<until){const i=cursor++,t=tenants[i%4],visitor=clients[i%clients.length],start=performance.now();let r;
  const kind=i%5;
  if(kind===0)r=await request('/api/v1/widget/send',{method:'POST',token:visitor.token,headers:{origin:'http://127.0.0.1:3000'},body:{messageId:randomUUID(),text:'Fixture customer interest '+i,actionId:''}});
  else if(kind===1)r=await request('/api/v1/widget/messages',{token:visitor.token,headers:{origin:'http://127.0.0.1:3000'}});
  else r=await request(['/api/v1/catalog','/api/v1/leads','/api/v1/whatsapp/inbox'][kind-2],{token:t.token});
  // Intentional per-session/per-actor budgets remain enabled; report throttling instead of bypass.
  assert.ok([200,429].includes(r.status),'Mixed response '+r.status+': '+JSON.stringify(r.data));
  counts[r.status]=(counts[r.status]||0)+1;samples.push(performance.now()-start);await sleep(80);
 }}));
 clearInterval(sampler);const serverResources=await Promise.all(measured.map(async(p,i)=>{const r=await resource(p);return {process:i<2?'api-'+i:'worker-'+(i-2),cpuMs:1000*(r.cpuTicks-initial[i].cpuTicks)/hz,peakSampledRssBytes:Math.max(peak[i],r.rss)}}));
 samples.sort((x,y)=>x-y);const elapsed=performance.now()-started;
 const messageCount=(await db.query('SELECT count(*)::int n FROM conversation_messages WHERE tenant_id=ANY($1::uuid[])',[tenants.map(t=>t.tenant)])).rows[0].n;
 const queue=(await db.query("SELECT count(*)::int n,coalesce(max(extract(epoch FROM now()-due_at)),0)::float AS lag FROM chatbot_delay_jobs WHERE tenant_id=ANY($1::uuid[]) AND status='PENDING'",[tenants.map(t=>t.tenant)])).rows[0];
 report.mixed={durationMs:elapsed,companies:4,visitors:200,persistedMessages:messageCount,operations:samples.length,statusCounts:counts,operationsPerSecond:samples.length*1000/elapsed,p50Ms:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],p99Ms:samples[Math.floor(samples.length*.99)],clientCpuMicroseconds:process.cpuUsage(cpu),clientRssBytes:process.memoryUsage().rss,pendingDelayJobs:queue.n,queueLagSeconds:queue.lag,peakQueueLagSeconds:peakQueueLag,serverResources};
 assert.equal(queue.n,0,'Workers must drain all initial delays during sustained workload');
 const plan=await tx(a.tenant,async c=>c.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,body FROM conversation_messages WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY created_at DESC LIMIT 200',[a.tenant,(await db.query('SELECT conversation_id FROM chatbot_delay_jobs WHERE tenant_id=$1 LIMIT 1',[a.tenant])).rows[0].conversation_id]));report.explain=plan.rows;
 check('30-second mixed real HTTP workload with 4 companies / 200 clients, pinned subflows, delays, inbox/leads/catalog; EXPLAIN ANALYZE');
 for(const p of mixedWorkers){p.kill('SIGTERM');await once(p,'exit')}
 // RLS remains effective with runtime role; role escalation and SQL payload cannot cross tenants.

 for(const role of ['MANAGER','AGENT','VIEWER']){
  const uid=(await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id',[role+'-'+suffix+'@example.invalid',hash])).rows[0].id;
  await db.query('INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,$3)',[a.tenant,uid,role]);
  const token=randomBytes(32).toString('base64url');await db.query("INSERT INTO sessions(token_hash,tenant_id,user_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[tokenDigest(token),a.tenant,uid]);
  browserRoles.push({role,slug:a.slug,email:role+'-'+suffix+'@example.invalid',password:pass});
  await expectCode('/api/v1/privacy/settings',{token},403);
  await expectCode('/api/v1/catalog',{method:'POST',token,body:{kind:'SERVICE',title:'Role fixture',description:'Fixture'}},role==='MANAGER'?201:403);
 }
 check('actual API roles OWNER/MANAGER/AGENT/VIEWER and cross-tenant write denial');
 // Original OAuth/PKCE + refresh + contact sync through loopback transport.
 process.env.APP_PUBLIC_ORIGIN='https://app.fixture.test';process.env.GOOGLE_CLIENT_ID='fixture-google-id';process.env.GOOGLE_CLIENT_SECRET='fixture-google-secret';process.env.HUBSPOT_CLIENT_ID='fixture-hubspot-id';process.env.HUBSPOT_CLIENT_SECRET='fixture-hubspot-secret';process.env.SHOPIFY_CLIENT_ID='fixture-shopify-id';process.env.SHOPIFY_CLIENT_SECRET='fixture-shopify-secret';process.env.SHOPIFY_API_VERSION='2026-10';process.env.WOOCOMMERCE_HOSTS='woo.fixture.test';
 const contact=(await db.query("INSERT INTO contacts(tenant_id,full_name,phone,email,source) VALUES($1,'Connector fixture','10000000001','fixture@example.invalid','MANUAL') RETURNING id",[a.tenant])).rows[0].id;
 for(const provider of ['GOOGLE_SHEETS','HUBSPOT','SHOPIFY','WOOCOMMERCE']){
  const config=provider==='GOOGLE_SHEETS'?{spreadsheetId:'fixture_sheet_123',sheet:'Contacts'}:provider==='SHOPIFY'?{host:'fixture.myshopify.com'}:provider==='WOOCOMMERCE'?{host:'woo.fixture.test'}:{};
  const connector=await tx(a.tenant,c=>saveConnector(c,a.actor,{provider,name:provider+' fixture',config,...(provider==='WOOCOMMERCE'?{credentials:{consumer_key:'ck_'+'a'.repeat(40),consumer_secret:'cs_'+'b'.repeat(40)}}:{})}));
  if(provider!=='WOOCOMMERCE'){
   const oauth=await tx(a.tenant,c=>beginConnectorOAuth(c,a.actor,connector.id));const url=new URL(oauth.url);const params=new URLSearchParams({state:url.searchParams.get('state'),code:'fixture-code'});
   if(provider==='SHOPIFY'){params.set('shop',config.host);const canonical=[...params.entries()].sort(([x],[y])=>x.localeCompare(y)).map(([k,v])=>k+'='+v).join('&');params.set('hmac',createHmac('sha256',process.env.SHOPIFY_CLIENT_SECRET).update(canonical).digest('hex'))}
   await finishConnectorOAuth(pool,params,oauth.cookie);await assert.rejects(finishConnectorOAuth(pool,params,oauth.cookie),/consumed|expired/);
   if(provider==='GOOGLE_SHEETS'){
    const exchange=sim.calls.find(c=>c.host==='oauth2.googleapis.com'&&c.body.grant_type==='authorization_code');assert.equal(createHash('sha256').update(exchange.body.code_verifier).digest('base64url'),url.searchParams.get('code_challenge'));
    await tx(a.tenant,c=>c.query('UPDATE chatbot_connectors SET credentials_encrypted=$3 WHERE tenant_id=$1 AND id=$2',[a.tenant,connector.id,sealIntegrationSecret(JSON.stringify({access_token:'fixture-expired',refresh_token:'fixture-refresh',expires_at:1}))]));
   }
  }
  const input={contactId:contact,fields:{email:'fixture@example.invalid'},requestId:randomUUID()};
  await tx(a.tenant,c=>syncContact(c,a.actor,connector.id,input));await tx(a.tenant,c=>syncContact(c,a.actor,connector.id,input));
  await tx(a.tenant,c=>processConnector(c,a.tenant));
  const job=(await db.query('SELECT status FROM chatbot_connector_jobs WHERE tenant_id=$1 AND connector_id=$2',[a.tenant,connector.id])).rows;assert.equal(job.length,1);assert.equal(job[0].status,'DONE',provider);
 }
 assert.ok(sim.calls.some(c=>c.body.grant_type==='refresh_token'));
 check('production Google PKCE/OAuth single-use state/refresh/RAW Sheets and HubSpot/Shopify/WooCommerce deduplicated contact sync');
 const google=(await db.query("SELECT id FROM chatbot_connectors WHERE tenant_id=$1 AND provider='GOOGLE_SHEETS'",[a.tenant])).rows[0].id;
 for(const code of ['401','403','429','500','reset']){sim.modes.set('sheets.googleapis.com',code);await assert.rejects(tx(a.tenant,c=>connectorResources(c,a.actor,google,'fixture_sheet_123')))}sim.modes.delete('sheets.googleapis.com');
 const {fixtureDNS}=await import('./support/offline-transport.mjs');const {providerHTTP}=await import('../.build/apps/api/src/provider-http.js');
 for(const addresses of [[{address:'127.0.0.1',family:4}],[{address:'93.184.216.34',family:4},{address:'169.254.169.254',family:4}]]){fixtureDNS.set('woo.fixture.test',addresses);await assert.rejects(providerHTTP(new URL('https://woo.fixture.test/test'),['woo.fixture.test']),/DNS rejected/)}fixtureDNS.delete('woo.fixture.test');
 process.env.OUTBOUND_WEBHOOK_HOSTS='webhook.fixture.test';process.env.OUTBOUND_WEBHOOK_SIGNING_SECRET='fixture-only-signing-secret';const webhookBody={event:'fixture',contactId:contact};
 await sendWebhook('https://webhook.fixture.test/receive',webhookBody,'stable-fixture-key');await sendWebhook('https://webhook.fixture.test/receive',webhookBody,'stable-fixture-key');
 const hooks=sim.calls.filter(c=>c.host==='webhook.fixture.test');assert.equal(hooks.length,2);assert.ok(hooks.every(c=>c.idempotencyKey==='stable-fixture-key'&&c.signature==='sha256='+createHmac('sha256',process.env.OUTBOUND_WEBHOOK_SIGNING_SECRET).update(JSON.stringify(webhookBody)).digest('hex')));
 process.env.AI_BASE_URL='https://ai.fixture.test/v1';process.env.AI_API_KEY='fixture-ai-key';process.env.AI_MODEL='fixture-model';await tx(a.tenant,c=>saveAiSettings(c,a.actor,{enabled:true,instructions:'Company fixture',monthlyLimit:10}));
 const ai=await tx(a.tenant,c=>groundedReply(c,a.tenant,'Unknown fixture query'));assert.deepEqual(ai.sources,[]);assert.ok(sim.calls.some(c=>c.host==='ai.fixture.test'));
 check('production provider 401/403/429/500/reset matrix, mixed/private DNS rejection, webhook HMAC/stable keys and grounded AI fallback');

 // Native social validation and dispatch through the same production code.
 for(const channel of ['MESSENGER','INSTAGRAM','TELEGRAM']){
  const account=await tx(a.tenant,c=>connectSocial(c,a.actor,{channel,externalId:'123456',token:channel==='TELEGRAM'?'123456:'+'a'.repeat(30):'fixture-social-token-123'}));
  const conv=(await db.query("INSERT INTO conversations(tenant_id,contact_id,channel,social_account_id,external_sender_id,last_customer_message_at) VALUES($1,$2,$3,$4,'10000000001',now()) RETURNING id",[a.tenant,contact,channel,account.id])).rows[0].id;
  const job=(await db.query("INSERT INTO chatbot_social_outbox(tenant_id,account_id,conversation_id,payload) VALUES($1,$2,$3,$4::jsonb) RETURNING id",[a.tenant,account.id,conv,JSON.stringify({method:'sendMessage',body:channel==='TELEGRAM'?{chat_id:'10000000001',text:'Fixture'}:{message:{text:'Fixture'}}})])).rows[0].id;
  await Promise.all([processSocial(pool,a.tenant),processSocial(pool,a.tenant)]);
  assert.equal((await db.query('SELECT status FROM chatbot_social_outbox WHERE tenant_id=$1 AND id=$2',[a.tenant,job])).rows[0].status,'SENT');
 }
 check('production Messenger/Instagram/Telegram account validation and competing dispatch');
 // Seed real encrypted WA/account/template and reproduce in-flight accepted-before-response crash.
 const wa=await tx(a.tenant,c=>connectWhatsApp(c,a.actor,{phoneNumberId:'123456789',wabaId:'987654321',accessToken:'fixture-whatsapp-token-123456789'}));
 await tx(a.tenant,c=>disconnectWhatsApp(c,a.actor,wa.id));
 const reconnected=await tx(a.tenant,c=>connectWhatsApp(c,a.actor,{phoneNumberId:'123456789',wabaId:'987654321',accessToken:'fixture-whatsapp-token-rotated-123456789'}));
 assert.equal(reconnected.id,wa.id,'Reconnect preserves account and conversation identity');
 const diagnosis=await tx(a.tenant,c=>diagnoseWhatsApp(c,a.actor,wa.id));
 assert.equal(diagnosis.verified,true);assert.equal(diagnosis.liveAcceptance,false);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM whatsapp_routes WHERE tenant_id=$1 AND account_id=$2',[a.tenant,wa.id])).rows[0].n,1);
 check('WhatsApp disconnect/reconnect preserves identity and routing; provider diagnostic explicitly excludes live acceptance');
 const template=await tx(a.tenant,c=>registerApprovedTemplate(c,a.actor,{accountId:wa.id,name:'fixture_notice',language:'en'}));
 const templateId=(await db.query('SELECT id FROM whatsapp_approved_templates WHERE tenant_id=$1',[a.tenant])).rows[0].id;
 const campaign=await tx(a.tenant,c=>createCampaign(c,a.actor,{name:'Fixture campaign',startAt:new Date(Date.now()+10000).toISOString(),steps:[{templateId,offsetMinutes:0}]}));await db.query('UPDATE contacts SET marketing_opt_in=true,marketing_opt_in_at=now() WHERE tenant_id=$1 AND id=$2',[a.tenant,contact]);await tx(a.tenant,c=>launchCampaign(c,a.actor,campaign.id));await tx(a.tenant,c=>cancelCampaign(c,a.actor,campaign.id));
 const conv=(await db.query("INSERT INTO conversations(tenant_id,contact_id,channel,whatsapp_account_id,last_customer_message_at) VALUES($1,$2,'WHATSAPP',$3,now()) RETURNING id",[a.tenant,contact,wa.id])).rows[0].id;
 const queued=(await db.query("INSERT INTO whatsapp_outbox(tenant_id,account_id,conversation_id,recipient_phone,payload) VALUES($1,$2,$3,'10000000001',$4::jsonb) RETURNING id",[a.tenant,wa.id,conv,JSON.stringify({type:'text',text:{body:'Accepted then interrupted'}})])).rows[0].id;
 sim.modes.set('graph.facebook.com','hold');
 const crashWorker=launch('inflight-crash',process.execPath,['.build/apps/worker/main.js'],env);
 for(let i=0;i<100&&!sim.accepted.has(queued);i++)await sleep(100);
 assert.ok(sim.accepted.has(queued),'Simulator must accept the actual worker payload before killing it');
 crashWorker.kill('SIGKILL');await once(crashWorker,'exit');sim.modes.delete('graph.facebook.com');
 await db.query("UPDATE whatsapp_outbox SET locked_at=now()-interval '3 minutes' WHERE tenant_id=$1 AND id=$2",[a.tenant,queued]);
 const recovery=launch('inflight-recovery',process.execPath,['.build/apps/worker/main.js'],env);await sleep(2500);
 assert.equal((await db.query('SELECT status FROM whatsapp_outbox WHERE tenant_id=$1 AND id=$2',[a.tenant,queued])).rows[0].status,'UNCERTAIN');
 const accepted=sim.accepted.get(queued);assert.equal(sim.calls.filter(c=>c.body.biz_opaque_callback_data===queued).length,1,'No automatic resend');
 const receipt={id:accepted.id,status:'read',recipient_id:'10000000001',biz_opaque_callback_data:queued};
 await tx(a.tenant,c=>reconcileWhatsAppReceipt(c,a.tenant,wa.id,receipt));await tx(a.tenant,c=>reconcileWhatsAppReceipt(c,a.tenant,wa.id,{...receipt,status:'sent'}));
 assert.equal((await db.query('SELECT status FROM whatsapp_outbox WHERE tenant_id=$1 AND id=$2',[a.tenant,queued])).rows[0].status,'SENT');
 assert.equal((await db.query('SELECT delivery_status FROM conversation_messages WHERE tenant_id=$1 AND whatsapp_message_id=$2',[a.tenant,accepted.id])).rows[0].delivery_status,'read');
 recovery.kill('SIGTERM');await once(recovery,'exit');
 check('actual worker accepted-send SIGKILL -> PROCESSING -> UNCERTAIN -> correlated SENT; one send; duplicate/out-of-order receipt preserves read');
 // Actual ClamAV INSTREAM, not a fake scanner. Custom local acceptance signature database only.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 const eicar=Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
 if(process.env.CLAMAV_SOCKET){
  assert.equal(await scanBytes(png),'CLEAN');assert.equal(await scanBytes(eicar),'QUARANTINED');
  const asset=await tx(a.tenant,c=>uploadMedia(c,a.actor,{name:'Fixture.png',base64:png.toString('base64')}));
  const token=(await db.query('SELECT public_token FROM chatbot_media WHERE tenant_id=$1 AND id=$2',[a.tenant,asset.id])).rows[0].public_token;
  await assert.rejects(publicMedia(pool,token),e=>e.status===410);await tx(a.tenant,c=>processMediaScan(c,a.tenant));assert.deepEqual((await publicMedia(pool,token)).data,png);
  process.env.MEDIA_PUBLIC_ORIGIN='https://media.fixture.test';await assert.rejects(tx(b.tenant,c=>validateManagedMedia(c,b.tenant,'https://media.fixture.test/api/v1/media/public/'+token,'image')));
  await tx(a.tenant,c=>deleteMedia(c,a.actor,asset.id));await assert.rejects(publicMedia(pool,token),e=>e.status===410);
  await assert.rejects(tx(a.tenant,c=>uploadMedia(c,a.actor,{name:'fake.png',base64:Buffer.from('not png').toString('base64')})));
  await assert.rejects(tx(a.tenant,c=>uploadMedia(c,a.actor,{name:'oversized.png',base64:Buffer.concat([png,Buffer.alloc(5242881)]).toString('base64')})));
  const infected=await tx(a.tenant,c=>uploadMedia(c,a.actor,{name:'EICAR fixture.pdf',base64:Buffer.concat([Buffer.from('%PDF-1.0\n'),eicar]).toString('base64')}));await tx(a.tenant,c=>processMediaScan(c,a.tenant));assert.equal((await db.query('SELECT scan_status FROM chatbot_media WHERE tenant_id=$1 AND id=$2',[a.tenant,infected.id])).rows[0].scan_status,'QUARANTINED');
  const old=process.env.CLAMAV_SOCKET;process.env.CLAMAV_SOCKET='/tmp/no-scanner-'+suffix;await assert.rejects(scanBytes(png));process.env.CLAMAV_SOCKET=old;assert.equal(await scanBytes(png),'CLEAN');
  check('real ClamAV CLEAN/EICAR QUARANTINED, pending inaccessible, tenant media denial, deleted link revoked, fake MIME denied, offline/recovery');
 }else throw new Error('Real scanner is mandatory for new closure gate');
 // Retention must preserve an old CLOSED contact with scheduled work; explicit erasure cancels it.
 const retained=(await db.query("INSERT INTO contacts(tenant_id,full_name,phone,source,updated_at) VALUES($1,'Retention fixture','10000000002','MANUAL',now()-interval '90 days') RETURNING id",[a.tenant])).rows[0].id;
 const retainedConv=(await db.query("INSERT INTO conversations(tenant_id,contact_id,status,created_at,last_message_at) VALUES($1,$2,'CLOSED',now()-interval '90 days',now()-interval '90 days') RETURNING id",[a.tenant,retained])).rows[0].id;
 await db.query("INSERT INTO chatbot_delay_jobs(tenant_id,conversation_id,version,node_id,due_at) VALUES($1,$2,1,'pause',now()+interval '1 day')",[a.tenant,retainedConv]);
 await db.query('INSERT INTO chatbot_privacy_settings(tenant_id,retention_days,cleanup_enabled) VALUES($1,30,true)',[a.tenant]);
 await tx(a.tenant,c=>processRetention(c,a.tenant));assert.notEqual((await db.query('SELECT status FROM contacts WHERE tenant_id=$1 AND id=$2',[a.tenant,retained])).rows[0].status,'ARCHIVED');
 await tx(a.tenant,c=>exportContact(c,a.actor,retained));await tx(a.tenant,c=>anonymizeContact(c,a.actor,retained,{confirm:retained}));
 assert.equal((await db.query('SELECT status FROM chatbot_delay_jobs WHERE tenant_id=$1 AND conversation_id=$2',[a.tenant,retainedConv])).rows[0].status,'CANCELLED');
 // Leave seeded PENDING delay, media bytes, ciphertext and audit for independent backup restore.
 await tx(a.tenant,c=>uploadMedia(c,a.actor,{name:'Backup fixture.png',base64:png.toString('base64')}));
 const encrypted=(await db.query('SELECT credentials_encrypted FROM chatbot_connectors WHERE tenant_id=$1 LIMIT 1',[a.tenant])).rows[0].credentials_encrypted;assert.ok(openIntegrationSecret(encrypted));
 const {startWebsiteSession}=await import('../.build/apps/api/src/website.js');const pendingVisitor=await startWebsiteSession(pool,{widgetKey:a.widgetKey,name:'Pending backup visitor'},'http://127.0.0.1:3000');const delayed=(await db.query('SELECT s.conversation_id FROM chatbot_web_sessions s WHERE s.tenant_id=$1 AND s.token_hash=$2',[a.tenant,tokenDigest(pendingVisitor.token)])).rows[0].conversation_id;await db.query("UPDATE chatbot_delay_jobs SET due_at=now()+interval '1 day' WHERE tenant_id=$1 AND conversation_id=$2",[a.tenant,delayed]);
 await mkdir('acceptance-evidence',{recursive:true});await writeFile('acceptance-evidence/browser-roles-private.json',JSON.stringify(browserRoles));await writeFile('acceptance-evidence/restore-fixture-private.json',JSON.stringify({tenant:a.tenant,contact:retained,conversation:delayed,runtimeUrl:env.DATABASE_URL,key:process.env.INTEGRATION_SECRET_ENCRYPTION_KEY}));
 const racing=clients[0];const racingContact=(await db.query('SELECT c.contact_id FROM chatbot_web_sessions s JOIN conversations c ON c.tenant_id=s.tenant_id AND c.id=s.conversation_id WHERE s.tenant_id=$1 AND s.token_hash=$2',[racing.tenant,tokenDigest(racing.token)])).rows[0].contact_id;const racingActor=tenants.find(t=>t.tenant===racing.tenant).actor;
 const outcomes=await Promise.allSettled([tx(racing.tenant,c=>anonymizeContact(c,racingActor,racingContact,{confirm:racingContact})),request('/api/v1/widget/send',{method:'POST',token:racing.token,headers:{origin:'http://127.0.0.1:3000'},body:{messageId:randomUUID(),text:'Concurrent private content fixture',actionId:''}})]);assert.equal(outcomes[0].status,'fulfilled');assert.ok([200,401].includes(outcomes[1].value?.status));
 assert.equal((await db.query('SELECT status FROM contacts WHERE tenant_id=$1 AND id=$2',[racing.tenant,racingContact])).rows[0].status,'ARCHIVED');
 assert.equal((await db.query("SELECT 1 FROM conversation_messages m JOIN conversations c ON c.tenant_id=m.tenant_id AND c.id=m.conversation_id WHERE c.tenant_id=$1 AND c.contact_id=$2 AND m.body LIKE '%Concurrent private content%'",[racing.tenant,racingContact])).rowCount,0);
 check('concurrent customer message and owner erasure: no resurrected contact or retained message content');
 check('retention preserves scheduled work, owner export/anonymization cancels jobs; seeded media/ciphertext/audit/pending queue for restore');
 }finally{await pool.end();await mkdir('acceptance-evidence',{recursive:true});await writeFile('acceptance-evidence/local-closure.json',JSON.stringify(report,null,2))}
}
