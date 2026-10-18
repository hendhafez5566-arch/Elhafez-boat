import assert from 'node:assert/strict';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {tokenDigest} from '../.build/apps/api/src/auth.js';
export async function coexistenceAcceptance({db,a,b,base,env}){
 // Independent actors isolate functional onboarding from the prior deliberate load/throttle workload.
 async function freshOwner(t){const uid=randomUUID(),token=randomBytes(32).toString('base64url');
  await db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[uid,uid+'@example.invalid','not-a-login-fixture']);
  await db.query("INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')",[t.tenant,uid]);
  await db.query("INSERT INTO sessions(token_hash,tenant_id,user_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[tokenDigest(token),t.tenant,uid]);
  return {...t,user:uid,token};}
 a=await freshOwner(a);b=await freshOwner(b);
 const origin=env.APP_PUBLIC_ORIGIN;
 async function call(path,token=a.token,body,nonce,expected=200,method=body?'POST':'GET'){
  const response=await fetch(base+'/api/v1'+path,{method,headers:{authorization:'Bearer '+token,origin,'content-type':'application/json',...(nonce?{cookie:'eb_wa_signup='+nonce}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return {data,cookie:response.headers.get('set-cookie')?.match(/eb_wa_signup=([^;]+)/)?.[1]};
 }
 const start=()=>call('/whatsapp/signup/start',a.token,{mode:'COEXISTENCE'},undefined,201);
 const cancelled=await start();await call('/whatsapp/signup/cancel',a.token,{attemptId:cancelled.data.attemptId},cancelled.cookie);
 const payload=id=>({attemptId:id,code:'fixture-code-coexist',wabaId:'876543210'});
 await call('/whatsapp/signup/complete',a.token,payload(cancelled.data.attemptId),cancelled.cookie,409);
 const expired=await start();await db.query("UPDATE whatsapp_onboarding_attempts SET expires_at=now()-interval '1 second' WHERE tenant_id=$1 AND id=$2",[a.tenant,expired.data.attemptId]);await call('/whatsapp/signup/complete',a.token,payload(expired.data.attemptId),expired.cookie,409);
 const rejected=await start();await call('/whatsapp/signup/complete',a.token,{...payload(rejected.data.attemptId),code:'fixture-denied-code'},rejected.cookie,502);
 const bound=await start();await call('/whatsapp/signup/complete',b.token,payload(bound.data.attemptId),bound.cookie,409);await call('/whatsapp/signup/complete',a.token,payload(bound.data.attemptId),'a'.repeat(43),409);
 const result=await call('/whatsapp/signup/complete',a.token,payload(bound.data.attemptId),bound.cookie);const account=result.data.accountId;
 assert.ok(account);assert.equal(result.data.authorized,true);assert.equal(result.data.subscribed,true);assert.equal(result.data.receivingVerified,false);assert.equal(JSON.stringify(result.data).includes('access_token'),false);
 await call('/whatsapp/signup/complete',a.token,payload(bound.data.attemptId),bound.cookie,409);
 const conflict=await call('/whatsapp/signup/start',b.token,{mode:'COEXISTENCE'},undefined,201);const denied=await fetch(base+'/api/v1/whatsapp/signup/complete',{method:'POST',headers:{authorization:'Bearer '+b.token,origin,'content-type':'application/json',cookie:'eb_wa_signup='+conflict.cookie},body:JSON.stringify(payload(conflict.data.attemptId))});assert.ok(denied.status>=400);
 const cloud=await call('/whatsapp/signup/start',b.token,{mode:'CLOUD'},undefined,201);
 const cloudResult=await call('/whatsapp/signup/complete',b.token,{attemptId:cloud.data.attemptId,code:'fixture-cloud-code',wabaId:'2233445566'},cloud.cookie);assert.equal(cloudResult.data.mode,'CLOUD');
 await call('/whatsapp/signup/accounts/'+cloudResult.data.accountId+'/operation',b.token,{operation:'register',pin:'123456'});
 await call('/whatsapp/signup/accounts/'+cloudResult.data.accountId+'/operation',b.token,{operation:'register',pin:'123456'},undefined,409);
 await call('/whatsapp/signup/accounts/'+account+'/operation',a.token,{operation:'register',pin:'123456'},undefined,400);
 console.log('PASS COEXISTENCE new Cloud authorization/register once; Coexistence refuses register; denied provider authorization fails safely');
 const forged=await fetch(base+'/api/v1/whatsapp/signup/start',{method:'POST',headers:{authorization:'Bearer '+a.token,origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({mode:'CLOUD'})});assert.equal(forged.status,403);
 // Actual signed HTTP webhook, not direct parser calls. Never contacts Meta.
 async function webhook(field,value,time){const body=JSON.stringify({object:'whatsapp_business_account',entry:[{id:'876543210',time,changes:[{field,value:{messaging_product:'whatsapp',metadata:{phone_number_id:'777777777',display_phone_number:'15550783881'},...value}}]}]});const response=await fetch(base+'/api/v1/whatsapp/webhook',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':'sha256='+createHmac('sha256',env.META_APP_SECRET).update(body).digest('hex')},body});assert.equal(response.status,200,await response.text())}
 const now=Math.floor(Date.now()/1000),echo={id:'wamid.coexist-echo',from:'15550783881',to:'16505551234',timestamp:String(now),type:'text',text:{body:'Manual app response'}};
 const before=(await db.query('SELECT count(*)::int n FROM whatsapp_outbox WHERE tenant_id=$1',[a.tenant])).rows[0].n;
 await webhook('smb_message_echoes',{message_echoes:[echo]});await webhook('smb_message_echoes',{message_echoes:[echo]});
 let rows=(await db.query("SELECT m.kind,m.message_source,c.status,c.last_customer_message_at FROM conversation_messages m JOIN conversations c ON c.tenant_id=m.tenant_id AND c.id=m.conversation_id WHERE m.tenant_id=$1 AND m.whatsapp_message_id=$2",[a.tenant,echo.id])).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].kind,'OUTBOUND');assert.equal(rows[0].message_source,'BUSINESS_APP');assert.equal(rows[0].status,'HUMAN');assert.equal(rows[0].last_customer_message_at,null);
 assert.equal((await db.query('SELECT count(*)::int n FROM whatsapp_outbox WHERE tenant_id=$1',[a.tenant])).rows[0].n,before);
 await call('/whatsapp/signup/accounts/'+account+'/operation',a.token,{operation:'history',consent:true});await call('/whatsapp/signup/accounts/'+account+'/operation',a.token,{operation:'history',consent:true},undefined,409);
 await webhook('history',{history:[{metadata:{progress:100,chunk_order:2},threads:[{id:'16505551234',messages:[{id:'wamid.history-in',from:'16505551234',to:'15550783881',timestamp:String(now-86400),type:'text',text:{body:'Historical customer text'}}]}]}]});
 await webhook('history',{history:[{metadata:{progress:50,chunk_order:1},threads:[]}]});
 assert.equal((await db.query('SELECT sync_status FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2',[a.tenant,account])).rows[0].sync_status,'HISTORY_COMPLETE');
 assert.equal((await db.query("SELECT last_customer_message_at FROM conversations WHERE tenant_id=$1 AND whatsapp_account_id=$2",[a.tenant,account])).rows[0].last_customer_message_at,null);
 // Complete customer journey through the real published engine, queued WhatsApp payloads and CRM.
 const current=await call('/flows');
 const definition={name:'Coexistence customer fixture',startId:'s',nodes:[{id:'s',type:'START',next:'menu'},{id:'menu',type:'BUTTONS',text:'كيف نساعدك؟',choices:[{id:'services',title:'الخدمات',next:'list'}]},{id:'list',type:'LIST',text:'اختر اهتمامك',choices:[{id:'service',title:'خدمة معتمدة',next:'ask'}]},{id:'ask',type:'INPUT',field:'interest',text:'ما التفاصيل المطلوبة؟',next:'human'},{id:'human',type:'HANDOFF',text:'الموظف سيساعدك'}]};
 await call('/flows/draft',a.token,{...definition,expectedRevision:current.data.draft.draftRevision},undefined,200,'PUT');await call('/flows/publish',a.token,{});
 const customer='16505551235';let serial=0;
 const inbound=async(content)=>webhook('messages',{messages:[{id:'wamid.customer-'+(++serial),from:customer,timestamp:String(Math.floor(Date.now()/1000)),...content}],contacts:[{wa_id:customer,profile:{name:'Fixture customer'}}]});
 await inbound({type:'text',text:{body:'مرحبا'}});
 const pending=async()=>{const r=await db.query("SELECT j.payload FROM whatsapp_outbox j JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id WHERE j.tenant_id=$1 AND k.phone=$2 ORDER BY j.created_at DESC",[a.tenant,customer]);return r.rows.map(x=>x.payload)};
 let messages=await pending();const buttons=messages.find(x=>x.interactive?.type==='button');assert.ok(buttons);
 await inbound({type:'interactive',interactive:{button_reply:{id:buttons.interactive.action.buttons[0].reply.id,title:'الخدمات'}}});
 messages=await pending();const list=messages.find(x=>x.interactive?.type==='list');assert.ok(list);
 await inbound({type:'interactive',interactive:{list_reply:{id:list.interactive.action.sections[0].rows[0].id,title:'خدمة معتمدة'}}});
 await inbound({type:'text',text:{body:'اهتمام تجريبي مسجل'}});
 const conv=(await db.query("SELECT c.id,c.status FROM conversations c JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id WHERE c.tenant_id=$1 AND k.phone=$2 AND c.channel='WHATSAPP'",[a.tenant,customer])).rows[0];assert.equal(conv.status,'HUMAN');
 const lead=(await db.query('SELECT stage,custom_fields FROM chatbot_leads WHERE tenant_id=$1 AND conversation_id=$2',[a.tenant,conv.id])).rows[0];assert.equal(lead.stage,'READY_FOR_AGENT');assert.equal(lead.custom_fields.interest,'اهتمام تجريبي مسجل');
 await call('/whatsapp/inbox/'+conv.id+'/reply',a.token,{body:'رد الموظف من المنصة'},undefined,202);
 console.log('PASS COEXISTENCE signed customer -> real WhatsApp buttons/list/input -> CRM interest -> handoff -> manual reply queue');
 await webhook('account_update',{event:'ACCOUNT_OFFBOARDED'},now);await webhook('account_update',{event:'ACCOUNT_RECONNECTED'},now-100);
 assert.equal((await db.query('SELECT status FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2',[a.tenant,account])).rows[0].status,'DISABLED');
 console.log('PASS COEXISTENCE real API/DB: cancel/expiry/cookie+tenant binding/one-use code/ownership/CSRF/encrypted credentials; signed app echo dedupe without bot; consent history no service window; delayed chunks/offboarding');
}
