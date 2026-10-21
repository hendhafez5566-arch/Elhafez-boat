import {processFlowIntegration,processFlowConnector} from '../api/src/flow-integration-worker.js';
import {deliveryDisposition,sendWhatsApp} from './delivery.js';
import {verifyCommerceRefs,type CommerceRef} from '../api/src/commerce.js';
import {processConnector} from '../api/src/connectors.js';
import {processMediaScan} from '../api/src/media-scan.js';
import {processRetention} from '../api/src/privacy.js';
import {processSocial} from '../api/src/social.js';
import {processPrivateReply} from '../api/src/comment-automation.js';
import {processCampaign} from '../api/src/campaigns.js';
import {consumeUsage} from '../api/src/usage.js';
import {processDelay} from '../api/src/delay-scheduler.js';
import {processIntegrationJob} from '../api/src/integrations.js';
/** Durable WhatsApp outbox worker. Requires trusted non-owner PostgreSQL role. */
import { createRequire } from 'node:module';
import { createDecipheriv } from 'node:crypto';
const require=createRequire(import.meta.url);
const {Pool}=require('pg') as {Pool:new (o:{connectionString:string;max:number})=>{
 query(sql:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[];rowCount:number|null}>;
 connect():Promise<{query(sql:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[];rowCount:number|null}>;release():void}>;
 on(event:'error',listener:(error:{code?:string})=>void):void;
 on(event:'connect',listener:(client:{on(event:'error',listener:(error:{code?:string})=>void):void})=>void):void;
 end():Promise<void>;
}};
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL missing');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:4});
pool.on('error',error=>console.error('Worker database connection lost',{code:error.code||'DB_CONNECTION_LOST'}));
// A checked-out connection can be terminated between queries (including a committed
// transaction awaiting provider work). Pool errors only cover idle pool clients.
// Observe client errors as well; failed queries still reject and the normal transaction
// handlers roll back, while pg removes the non-queryable connection on release.
pool.on('connect',client=>client.on('error',error=>console.error('Worker client connection lost',{code:error.code||'DB_CONNECTION_LOST'})));
let running=true;let maintainedAt=0;
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function decrypt(ciphertext:string):string {
 const k=Buffer.from(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY??'','base64');
 if(k.length!==32)throw new Error('Missing correct WHATSAPP_TOKEN_ENCRYPTION_KEY');
 const parts=ciphertext.split('.');if(parts.length!==4||parts[0]!=='v1')throw new Error('Invalid stored token');
 const decipher=createDecipheriv('aes-256-gcm',k,Buffer.from(parts[1],'base64url'));
 decipher.setAuthTag(Buffer.from(parts[2],'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(parts[3],'base64url')),decipher.final()]).toString();
}
function graphVersion(){const v=process.env.META_GRAPH_VERSION??'';if(!/^v\d{1,2}\.\d{1,2}$/.test(v))throw new Error('Invalid META_GRAPH_VERSION');return v;}
async function dispatch(job:Record<string,unknown>,account:Record<string,unknown>):Promise<{providerId:string}> {
 const token=decrypt(String(account.access_token_encrypted));
 const payload=job.payload as Record<string,unknown>;
 // All customer-facing traffic originates from stored internal payloads, not arbitrary URLs.
 return sendWhatsApp(graphVersion(),String(account.phone_number_id),token,{...payload,messaging_product:'whatsapp',to:job.recipient_phone,biz_opaque_callback_data:String(job.id)});
}
async function processTenant(tenantId:string):Promise<boolean>{
 const tx=await pool.connect();let began=false;
 try{
  await tx.query('BEGIN');began=true;
  await tx.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  const entitlement=await tx.query("SELECT 1 FROM tenant_subscriptions WHERE tenant_id=$1 AND status IN ('TRIAL','ACTIVE') AND current_period_ends_at>now()",[tenantId]);
  if(!entitlement.rowCount){await tx.query('COMMIT');return false}
  await tx.query('INSERT INTO chatbot_usage(tenant_id,day) VALUES($1,CURRENT_DATE) ON CONFLICT DO NOTHING',[tenantId]);
  await tx.query('SELECT day FROM chatbot_usage WHERE tenant_id=$1 AND day=CURRENT_DATE FOR UPDATE',[tenantId]);
  await tx.query("UPDATE whatsapp_outbox SET status='UNCERTAIN',last_error='Worker interrupted after durable claim; reconcile before any resend' WHERE tenant_id=$1 AND status='PROCESSING' AND locked_at<now()-interval '2 minutes'",[tenantId]);
  // Row-level locking reserves one job among concurrent worker processes.
  const pending=await tx.query(`SELECT j.*,j.usage_day=CURRENT_DATE AS usage_reserved_today,a.phone_number_id,a.access_token_encrypted,c.last_customer_message_at,k.do_not_contact,k.marketing_opt_in
   FROM whatsapp_outbox j JOIN whatsapp_accounts a ON a.tenant_id=j.tenant_id AND a.id=j.account_id
   JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id
   JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id
   LEFT JOIN tenant_subscriptions sub ON sub.tenant_id=j.tenant_id
   WHERE j.tenant_id=$1 AND j.status='PENDING' AND j.next_attempt_at<=now()
   AND a.status='CONNECTED' AND (a.token_expires_at IS NULL OR a.token_expires_at>now()) AND a.authorization_status<>'REAUTH_REQUIRED' AND sub.status IN ('TRIAL','ACTIVE') AND sub.current_period_ends_at>now() ORDER BY j.created_at ASC LIMIT 1 FOR UPDATE OF j,k SKIP LOCKED`,[tenantId]);
  if(pending.rowCount!==1){await tx.query('COMMIT');return false;}
  const job=pending.rows[0];
  // Interactive/text messages must not be dispatched after the WhatsApp 24h service window.
  const windowAge=job.last_customer_message_at ? Date.now()-new Date(String(job.last_customer_message_at)).getTime() : Infinity;
  const payload=job.payload as {type?:string};
  const template=payload.type==='template';
  // Never release stale queued outreach long after an account's suspension/reactivation.
  const queuedAge=Date.now()-new Date(String(job.scheduled_for||job.created_at)).getTime();
  if(template&&queuedAge>24*3600_000){
    await tx.query(`UPDATE whatsapp_outbox SET status='FAILED',last_error='Template job expired before dispatch'
      WHERE tenant_id=$1 AND id=$2`,[tenantId,job.id]);
    await tx.query('COMMIT');return true;
  }
  if(Boolean(job.do_not_contact)||(template&&!job.marketing_opt_in)){
   await tx.query(`UPDATE whatsapp_outbox SET status='FAILED',last_error='Customer opted out or consent missing' WHERE tenant_id=$1 AND id=$2`,[tenantId,job.id]);
   await tx.query('COMMIT');return true;
  }
  if(!template&&windowAge>24*3600_000){
   await tx.query(`UPDATE whatsapp_outbox SET status='FAILED',last_error='Customer service window expired; approved template required'
     WHERE tenant_id=$1 AND id=$2`,[tenantId,job.id]);
   await tx.query('COMMIT');return true;
  }
  if(job.campaign_id){const campaign=await tx.query("SELECT status FROM chatbot_campaigns WHERE tenant_id=$1 AND id=$2",[tenantId,job.campaign_id]);if(campaign.rows[0]?.status!=='ACTIVE'){await tx.query("UPDATE whatsapp_outbox SET status='FAILED',last_error='Campaign inactive' WHERE tenant_id=$1 AND id=$2",[tenantId,job.id]);await tx.query('COMMIT');return true}}
  if(template){
   const recent=await tx.query(`SELECT max(coalesce(dispatched_at,locked_at,created_at)) AS last FROM whatsapp_outbox WHERE tenant_id=$1 AND recipient_phone=$2 AND status IN ('SENT','PROCESSING','UNCERTAIN') AND payload->>'type'='template' AND coalesce(dispatched_at,locked_at,created_at)>now()-interval '24 hours'`,[tenantId,job.recipient_phone]);
   if(recent.rows[0]?.last){await tx.query(`UPDATE whatsapp_outbox SET next_attempt_at=$3::timestamptz+interval '24 hours' WHERE tenant_id=$1 AND id=$2`,[tenantId,job.id,recent.rows[0].last]);await tx.query('COMMIT');return true}
   if(!job.usage_reserved_today){await tx.query('SAVEPOINT usage_reservation');try{await consumeUsage(tx,tenantId,'templates');await tx.query('UPDATE whatsapp_outbox SET usage_day=CURRENT_DATE WHERE tenant_id=$1 AND id=$2',[tenantId,job.id])}catch(e){await tx.query('ROLLBACK TO SAVEPOINT usage_reservation');await tx.query("UPDATE whatsapp_outbox SET next_attempt_at=now()+interval '1 hour',last_error='Daily template limit reached' WHERE tenant_id=$1 AND id=$2",[tenantId,job.id]);await tx.query('COMMIT');return true}}
  }
  if(Array.isArray(job.commerce_refs)&&job.commerce_refs.length){await tx.query('SAVEPOINT commerce_check');try{await verifyCommerceRefs(tx,tenantId,String(job.account_id),job.commerce_refs as CommerceRef[])}catch(e){await tx.query('ROLLBACK TO SAVEPOINT commerce_check');const retry=(e as {status?:number}).status===502&&Number(job.attempt_count)<7;await tx.query("UPDATE whatsapp_outbox SET status=$3,attempt_count=attempt_count+1,next_attempt_at=now()+interval '5 minutes',last_error='Commerce product/account approval check failed' WHERE tenant_id=$1 AND id=$2",[tenantId,job.id,retry?'PENDING':'FAILED']);await tx.query('COMMIT');began=false;return true;}}
  // Commit a durable claim BEFORE the network call. A crashed worker must not resend
  // an ambiguous request: the recovery sweep marks orphaned claims UNCERTAIN.
  await tx.query("UPDATE whatsapp_outbox SET status='PROCESSING',locked_at=now(),attempt_count=attempt_count+1 WHERE tenant_id=$1 AND id=$2",[tenantId,job.id]);
  await tx.query('COMMIT');began=false;
  let providerId:string|undefined,disposition:'UNCERTAIN'|'PENDING'|'FAILED'='UNCERTAIN',lastError='';
  try{providerId=(await dispatch(job,job)).providerId;}
  catch(error){disposition=deliveryDisposition(error);lastError=disposition==='UNCERTAIN'?'Delivery outcome unknown; reconcile before resend':disposition==='PENDING'?'Provider rate limited':'Provider rejected message';}
  await tx.query('BEGIN');began=true;await tx.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  if(providerId){
    await tx.query(`UPDATE whatsapp_outbox SET status='SENT',dispatched_at=now(),provider_message_id=$3,locked_at=NULL
      WHERE tenant_id=$1 AND id=$2`,[tenantId,job.id,providerId]);
    const source=job.payload as {type?:string;text?:{body?:string};interactive?:{body?:{text?:string}}};
    const message=source.text?.body||source.interactive?.body?.text||(source.type==='template'?'[قالب واتساب معتمد]':'[رسالة تفاعلية]');
    await tx.query(`INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body,whatsapp_message_id,delivery_status)
      VALUES($1,$2,'OUTBOUND',$3,$4,'sent') ON CONFLICT DO NOTHING`,[tenantId,job.conversation_id,message,providerId]);
    await tx.query(`UPDATE conversations SET last_message_at=now() WHERE tenant_id=$1 AND id=$2`,[tenantId,job.conversation_id]);
  }else{
    const count=Number(job.attempt_count)+1;
    const status=disposition==='UNCERTAIN'?'UNCERTAIN':disposition==='FAILED'||count>=8?'FAILED':'PENDING';
    const delay=Math.min(3600,Math.pow(2,count)*20);
    await tx.query(`UPDATE whatsapp_outbox SET status=$3,attempt_count=$4,next_attempt_at=now()+($5::integer*interval '1 second'),last_error=$6
     WHERE tenant_id=$1 AND id=$2 AND status='PROCESSING'`,[tenantId,job.id,status,count,delay,lastError]);
  }
  await tx.query('COMMIT');return true;
 }catch(e){if(began)await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
}
async function tenantTask(tenantId:string,task:(db:import('../api/src/services.js').SqlClient,id:string)=>Promise<unknown>,activeOnly=true){
 const tx=await pool.connect();try{await tx.query('BEGIN');await tx.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);const active=await tx.query("SELECT 1 FROM tenant_subscriptions WHERE tenant_id=$1 AND status IN ('TRIAL','ACTIVE') AND current_period_ends_at>now()",[tenantId]);let didWork=false;if(active.rowCount||!activeOnly)didWork=Boolean(await task(tx,tenantId));await tx.query('INSERT INTO chatbot_worker_health(tenant_id,last_seen_at,last_error_code) VALUES($1,now(),NULL) ON CONFLICT(tenant_id) DO UPDATE SET last_seen_at=now(),last_error_code=NULL',[tenantId]);await tx.query('COMMIT');return didWork}catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
}
async function run(){
 console.log('WhatsApp outbox worker started');
 while(running){
  let worked=false;
  try{
   // The tenants table has no tenant RLS; each tenant's jobs still run inside RLS-scoped transactions.
   if(Date.now()-maintainedAt>3600000){await pool.query("DELETE FROM chatbot_rate_buckets WHERE window_at<now()-interval '1 day'");await pool.query('DELETE FROM chatbot_oauth_states WHERE expires_at<now()');maintainedAt=Date.now();}
   const t=await pool.query('SELECT id FROM tenants ORDER BY id LIMIT 10000');
   for(const row of t.rows){if(!running)break;const id=String(row.id);try{await tenantTask(id,async db=>{await db.query("UPDATE whatsapp_signup_operations SET status='UNCERTAIN' WHERE tenant_id=$1 AND status='PROCESSING' AND created_at<now()-interval '2 minutes'",[id]);await db.query("UPDATE whatsapp_onboarding_attempts SET token_encrypted=NULL,phone_choices=NULL,status=CASE WHEN status='PROCESSING' THEN 'UNCERTAIN' ELSE 'FAILED' END,error_code='EXPIRED' WHERE tenant_id=$1 AND expires_at<now() AND status IN ('PENDING','SELECT_PHONE','PROCESSING')",[id])});for(let delayCount=0;delayCount<25&&running;delayCount++){const delayed=await tenantTask(id,processDelay);worked=delayed||worked;if(!delayed)break;}await tenantTask(id,processCampaign);await processFlowIntegration(pool,id);await processFlowConnector(pool,id);await tenantTask(id,processIntegrationJob);await tenantTask(id,processConnector);await tenantTask(id,processMediaScan);await tenantTask(id,processRetention,false);await processSocial(pool,id);await processPrivateReply(pool,id);worked=(await processTenant(id))||worked}catch(e){console.error('Tenant worker task failed',{tenant:id,code:(e as {code?:string}).code||'TASK_FAILED'});await tenantTask(id,async db=>{await db.query("UPDATE chatbot_worker_health SET last_error_code='TASK_FAILED' WHERE tenant_id=$1",[id])}).catch(()=>{})}}
  }catch(e){console.error('Worker poll failed',{code:(e as {code?:string}).code||'POLL_FAILED'});}
  if(!worked)await wait(2000);
 }
 await pool.end();console.log('WhatsApp worker stopped');
}
process.on('SIGTERM',()=>{running=false});process.on('SIGINT',()=>{running=false});
void run().catch(e=>{console.error(e);process.exitCode=1});