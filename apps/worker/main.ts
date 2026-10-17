/** Durable WhatsApp outbox worker. Requires trusted non-owner PostgreSQL role. */
import { createRequire } from 'node:module';
import { createDecipheriv } from 'node:crypto';
const require=createRequire(import.meta.url);
const {Pool}=require('pg') as {Pool:new (o:{connectionString:string;max:number})=>{
 query(sql:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[];rowCount:number|null}>;
 connect():Promise<{query(sql:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[];rowCount:number|null}>;release():void}>;
 end():Promise<void>;
}};
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL missing');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:4});
let running=true;
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
 const response=await fetch(`https://graph.facebook.com/${graphVersion()}/${account.phone_number_id}/messages`,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({...payload,messaging_product:'whatsapp',to:job.recipient_phone}),signal:AbortSignal.timeout(15000)
 });
 if(!response.ok){const error=new Error('Meta message API '+response.status);(error as Error&{status?:number}).status=response.status;throw error;}
 const json=await response.json() as {messages?:Array<{id?:string}>};
 const providerId=json.messages?.[0]?.id;
 if(!providerId||providerId.length>256)throw new Error('Meta response lacked message id');
 return {providerId};
}
async function processTenant(tenantId:string):Promise<boolean>{
 const tx=await pool.connect();let began=false;
 try{
  await tx.query('BEGIN');began=true;
  await tx.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  // Row-level locking reserves one job among concurrent worker processes.
  const pending=await tx.query(`SELECT j.*,a.phone_number_id,a.access_token_encrypted,c.last_customer_message_at,k.do_not_contact,k.marketing_opt_in
   FROM whatsapp_outbox j JOIN whatsapp_accounts a ON a.tenant_id=j.tenant_id AND a.id=j.account_id
   JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id
   JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id
   LEFT JOIN tenant_subscriptions sub ON sub.tenant_id=j.tenant_id
   WHERE j.tenant_id=$1 AND j.status='PENDING' AND j.next_attempt_at<=now()
   AND a.status='CONNECTED' AND sub.status IN ('TRIAL','ACTIVE') AND sub.current_period_ends_at>now() ORDER BY j.created_at ASC LIMIT 1 FOR UPDATE OF j SKIP LOCKED`,[tenantId]);
  if(pending.rowCount!==1){await tx.query('COMMIT');return false;}
  const job=pending.rows[0];
  // Interactive/text messages must not be dispatched after the WhatsApp 24h service window.
  const windowAge=job.last_customer_message_at ? Date.now()-new Date(String(job.last_customer_message_at)).getTime() : Infinity;
  const payload=job.payload as {type?:string};
  const template=payload.type==='template';
  if(Boolean(job.do_not_contact)||(template&&!job.marketing_opt_in)){
   await tx.query(`UPDATE whatsapp_outbox SET status='FAILED',last_error='Customer opted out or consent missing' WHERE tenant_id=$1 AND id=$2`,[tenantId,job.id]);
   await tx.query('COMMIT');return true;
  }
  if(!template&&windowAge>24*3600_000){
   await tx.query(`UPDATE whatsapp_outbox SET status='FAILED',last_error='Customer service window expired; approved template required'
     WHERE tenant_id=$1 AND id=$2`,[tenantId,job.id]);
   await tx.query('COMMIT');return true;
  }
  // Keep lock while outbound API completes: blocks duplicate concurrent dispatch in healthy processes.
  // A timeout may mean provider received the request. To avoid an accidental duplicate charge/send,
  // do NOT retry unknown network outcomes automatically (mark UNCERTAIN for manual reconciliation).
  let providerId:string|undefined,permanent=false,unknown=false,lastError='';
  try{providerId=(await dispatch(job,job)).providerId;}
  catch(error){const status=(error as {status?:number}).status;permanent=typeof status==='number'&&status>=400&&status<500&&status!==429;
    unknown=status===undefined;lastError=error instanceof Error?error.message.slice(0,180):'Meta send failed';}
  if(providerId){
    await tx.query(`UPDATE whatsapp_outbox SET status='SENT',provider_message_id=$3,attempt_count=attempt_count+1,locked_at=NULL
      WHERE tenant_id=$1 AND id=$2`,[tenantId,job.id,providerId]);
    const source=job.payload as {type?:string;text?:{body?:string};interactive?:{body?:{text?:string}}};
    const message=source.text?.body||source.interactive?.body?.text||(source.type==='template'?'[قالب واتساب معتمد]':'[رسالة تفاعلية]');
    await tx.query(`INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body,whatsapp_message_id,delivery_status)
      VALUES($1,$2,'OUTBOUND',$3,$4,'sent')`,[tenantId,job.conversation_id,message,providerId]);
    await tx.query(`UPDATE conversations SET last_message_at=now() WHERE tenant_id=$1 AND id=$2`,[tenantId,job.conversation_id]);
  }else{
    const count=Number(job.attempt_count)+1;
    const status=unknown?'UNCERTAIN':permanent||count>=8?'FAILED':'PENDING';
    const delay=Math.min(3600,Math.pow(2,count)*20);
    await tx.query(`UPDATE whatsapp_outbox SET status=$3,attempt_count=$4,next_attempt_at=now()+($5::integer*interval '1 second'),last_error=$6
     WHERE tenant_id=$1 AND id=$2`,[tenantId,job.id,status,count,delay,lastError]);
  }
  await tx.query('COMMIT');return true;
 }catch(e){if(began)await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
}
async function run(){
 console.log('WhatsApp outbox worker started');
 while(running){
  let worked=false;
  try{
   // The tenants table has no tenant RLS; each tenant's jobs still run inside RLS-scoped transactions.
   const t=await pool.query('SELECT id FROM tenants ORDER BY id LIMIT 10000');
   for(const row of t.rows){if(!running)break;worked=(await processTenant(String(row.id)))||worked;}
  }catch(e){console.error('Worker poll failed:',e instanceof Error?e.message:'unknown');}
  if(!worked)await wait(2000);
 }
 await pool.end();console.log('WhatsApp worker stopped');
}
process.on('SIGTERM',()=>{running=false});process.on('SIGINT',()=>{running=false});
void run().catch(e=>{console.error(e);process.exitCode=1});