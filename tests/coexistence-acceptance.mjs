import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
export async function coexistenceAcceptance({db,a,b,base,env}){
 const origin=env.APP_PUBLIC_ORIGIN;
 async function call(path,token=a.token,body,nonce,expected=200){
  const response=await fetch(base+'/api/v1'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,origin,'content-type':'application/json',...(nonce?{cookie:'eb_wa_signup='+nonce}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return {data,cookie:response.headers.get('set-cookie')?.match(/eb_wa_signup=([^;]+)/)?.[1]};
 }
 const start=()=>call('/whatsapp/signup/start',a.token,{mode:'COEXISTENCE'},undefined,201);
 const cancelled=await start();await call('/whatsapp/signup/cancel',a.token,{attemptId:cancelled.data.attemptId},cancelled.cookie);
 const payload=id=>({attemptId:id,code:'fixture-code-coexist',wabaId:'876543210'});
 await call('/whatsapp/signup/complete',a.token,payload(cancelled.data.attemptId),cancelled.cookie,409);
 const expired=await start();await db.query("UPDATE whatsapp_onboarding_attempts SET expires_at=now()-interval '1 second' WHERE tenant_id=$1 AND id=$2",[a.tenant,expired.data.attemptId]);await call('/whatsapp/signup/complete',a.token,payload(expired.data.attemptId),expired.cookie,409);
 const bound=await start();await call('/whatsapp/signup/complete',b.token,payload(bound.data.attemptId),bound.cookie,409);await call('/whatsapp/signup/complete',a.token,payload(bound.data.attemptId),'a'.repeat(43),409);
 const result=await call('/whatsapp/signup/complete',a.token,payload(bound.data.attemptId),bound.cookie);const account=result.data.accountId;
 assert.ok(account);assert.equal(result.data.authorized,true);assert.equal(result.data.subscribed,true);assert.equal(result.data.receivingVerified,false);assert.equal(JSON.stringify(result.data).includes('access_token'),false);
 await call('/whatsapp/signup/complete',a.token,payload(bound.data.attemptId),bound.cookie,409);
 const conflict=await call('/whatsapp/signup/start',b.token,{mode:'COEXISTENCE'},undefined,201);const denied=await fetch(base+'/api/v1/whatsapp/signup/complete',{method:'POST',headers:{authorization:'Bearer '+b.token,origin,'content-type':'application/json',cookie:'eb_wa_signup='+conflict.cookie},body:JSON.stringify(payload(conflict.data.attemptId))});assert.ok(denied.status>=400);
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
 await webhook('account_update',{event:'ACCOUNT_OFFBOARDED'},now);await webhook('account_update',{event:'ACCOUNT_RECONNECTED'},now-100);
 assert.equal((await db.query('SELECT status FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2',[a.tenant,account])).rows[0].status,'DISABLED');
 console.log('PASS COEXISTENCE real API/DB: cancel/expiry/cookie+tenant binding/one-use code/ownership/CSRF/encrypted credentials; signed app echo dedupe without bot; consent history no service window; delayed chunks/offboarding');
}
