/** Existing integration queue, with a committed claim before HTTP and a separately persisted completion. */
import {sendWebhook,WebhookFailure,type WebhookResponse} from './integrations.js';
import {mapRequestResponse,validateFlowRequest,type FlowRequest} from './flow-request.js';
import {respondToFlow} from './flow-service.js';
import {deliverConversation} from './channels.js';
import {isUuid,type SqlClient,type SqlPool} from './services.js';
export type RequestTransport=typeof sendWebhook;
async function transaction<T>(pool:SqlPool,tenantId:string,fn:(db:SqlClient)=>Promise<T>){
 if(!isUuid(tenantId))throw Error('Invalid worker tenant');const db=await pool.connect();try{await db.query('BEGIN');await db.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);const value=await fn(db);await db.query('COMMIT');return value}catch(error){await db.query('ROLLBACK');throw error}finally{db.release()}
}
function owns(job:Record<string,unknown>){const runtime=job.runtime_state as {wait?:{token?:string}}|undefined;return job.conversation_status==='OPEN'&&!job.do_not_contact&&job.active&&job.session_node===job.flow_node_id&&Number(job.session_version)===Number(job.flow_version)&&runtime?.wait?.token===job.wait_token&&job.contact_id===job.current_contact}
function windowOpen(job:Record<string,unknown>){return Boolean(job.channel_ready)&&( !['WHATSAPP','MESSENGER','INSTAGRAM'].includes(String(job.channel))||Boolean(job.last_customer_message_at&&Date.now()-new Date(String(job.last_customer_message_at)).getTime()<86400000))}
/** Privacy and Website Chat lock contact before conversation; keep that order in every phase. */
async function lockConversation(db:SqlClient,tenantId:string,conversationId:unknown,skip=false){
 const contact=await db.query(`SELECT k.id FROM contacts k JOIN conversations c ON c.tenant_id=k.tenant_id AND c.contact_id=k.id WHERE c.tenant_id=$1 AND c.id=$2 FOR UPDATE OF k${skip?' SKIP LOCKED':''}`,[tenantId,conversationId]);if(!contact.rowCount)return false;
 return Boolean((await db.query(`SELECT id FROM conversations WHERE tenant_id=$1 AND id=$2 FOR UPDATE${skip?' SKIP LOCKED':''}`,[tenantId,conversationId])).rowCount);
}
async function readJob(db:SqlClient,tenantId:string,id:string){await db.query('SELECT s.conversation_id FROM chatbot_flow_sessions s JOIN chatbot_integration_jobs j ON j.tenant_id=s.tenant_id AND j.conversation_id=s.conversation_id WHERE j.tenant_id=$1 AND j.id=$2 FOR UPDATE OF s',[tenantId,id]);return (await db.query(`SELECT j.*,i.url,i.enabled,i.auth_mode,i.secret_encrypted,c.status AS conversation_status,c.channel,c.last_customer_message_at,c.contact_id AS current_contact,k.do_not_contact,
 s.node_id AS session_node,s.version AS session_version,s.runtime_state,CASE WHEN c.channel='WHATSAPP' THEN a.status='CONNECTED' AND (a.token_expires_at IS NULL OR a.token_expires_at>now()) AND a.authorization_status<>'REAUTH_REQUIRED' WHEN c.channel IN ('MESSENGER','INSTAGRAM','TELEGRAM') THEN a2.enabled ELSE true END AS channel_ready,
 EXISTS(SELECT 1 FROM tenant_subscriptions t WHERE t.tenant_id=j.tenant_id AND t.status IN ('ACTIVE','TRIAL') AND t.current_period_ends_at>now()) AS active
 FROM chatbot_integration_jobs j JOIN chatbot_integrations i ON i.tenant_id=j.tenant_id AND i.id=j.integration_id
 JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id
 LEFT JOIN whatsapp_accounts a ON a.tenant_id=c.tenant_id AND a.id=c.whatsapp_account_id
 LEFT JOIN chatbot_social_accounts a2 ON a2.tenant_id=c.tenant_id AND a2.id=c.social_account_id
 LEFT JOIN chatbot_flow_sessions s ON s.tenant_id=j.tenant_id AND s.conversation_id=j.conversation_id
 WHERE j.tenant_id=$1 AND j.id=$2 FOR UPDATE OF j`,[tenantId,id])).rows[0]}
async function audit(db:SqlClient,t:string,id:unknown,action:string){await db.query("INSERT INTO audit_events(tenant_id,action,entity_type,entity_id) VALUES($1,$2,'integration_job',$3)",[t,action,id])}
async function cancel(db:SqlClient,t:string,job:Record<string,unknown>){await db.query("UPDATE chatbot_integration_jobs SET status=CASE WHEN status='PROCESSING' THEN 'UNCERTAIN' WHEN status='PENDING' THEN 'CANCELLED' ELSE status END,completion_pending=false,last_error='FLOW_NOT_OWNED_OR_WINDOW_CLOSED' WHERE tenant_id=$1 AND id=$2",[t,job.id]);await audit(db,t,job.id,'FLOW_REQUEST_CANCELLED')}
/** One job per invocation. POST is never reclaimed or automatically retried after dispatch. */
export async function processFlowIntegration(pool:SqlPool,tenantId:string,transport:RequestTransport=sendWebhook){
 const claim=await transaction(pool,tenantId,async db=>{
  const due=await db.query(`SELECT j.id,j.conversation_id FROM chatbot_integration_jobs j JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id
   WHERE j.tenant_id=$1 AND j.flow_request IS NOT NULL AND ((j.status='PENDING' AND j.next_attempt_at<=now()) OR j.completion_pending OR (j.status='PROCESSING' AND j.dispatch_until<=now()))
   ORDER BY j.created_at,j.id LIMIT 1`,[tenantId]);if(!due.rowCount)return null;
  if(!await lockConversation(db,tenantId,due.rows[0].conversation_id,true))return null;
  const job=await readJob(db,tenantId,String(due.rows[0].id));if(!job||!(job.completion_pending||job.status==='PENDING'&&new Date(String(job.next_attempt_at)).getTime()<=Date.now()||job.status==='PROCESSING'&&new Date(String(job.dispatch_until)).getTime()<=Date.now()))return null;
  if(!owns(job)||!windowOpen(job)){await cancel(db,tenantId,job);return {worked:true as const}}
  if(job.status==='PROCESSING'){await db.query("UPDATE chatbot_integration_jobs SET status='UNCERTAIN',result_outcome='TIMEOUT',result_fields='{}',completion_pending=true,last_error='DISPATCH_INTERRUPTED_NO_RESEND' WHERE tenant_id=$1 AND id=$2",[tenantId,job.id]);return {worked:true as const,complete:String(job.id)}}
  if(job.completion_pending)return {worked:true as const,complete:String(job.id)};
  if(!job.enabled||new Date(String(job.deadline_at)).getTime()<=Date.now()){
   await db.query("UPDATE chatbot_integration_jobs SET status='FAILED',result_outcome=$3,result_fields='{}',completion_pending=true,last_error=$4 WHERE tenant_id=$1 AND id=$2",[tenantId,job.id,job.enabled?'TIMEOUT':'ERROR',job.enabled?'FLOW_DEADLINE':'INTEGRATION_DISABLED']);return {worked:true as const,complete:String(job.id)};
  }
  const request=job.flow_request as FlowRequest;validateFlowRequest(request);
  await db.query("UPDATE chatbot_integration_jobs SET status='PROCESSING',attempts=attempts+1,dispatch_until=now()+($3::integer*interval '1 second') WHERE tenant_id=$1 AND id=$2",[tenantId,job.id,request.timeoutSeconds+1]);
  return {worked:true as const,dispatch:{...job,attempts:Number(job.attempts)+1,flow_request:request}};
 });
 if(!claim)return false;if('complete'in claim&&claim.complete){await complete(pool,tenantId,claim.complete);return true}if(!('dispatch'in claim)||!claim.dispatch)return true;
 const job=claim.dispatch as Record<string,unknown>&{attempts:number;flow_request:FlowRequest},request=job.flow_request;let response:WebhookResponse|undefined,failure:WebhookFailure|undefined,fields:Record<string,string>={};
 try{response=await transport(String(job.url),job.payload,String(job.id),{mode:String(job.auth_mode),encrypted:job.secret_encrypted?String(job.secret_encrypted):null},{method:request.method,timeoutSeconds:request.timeoutSeconds})}catch(error){failure=error instanceof WebhookFailure?error:new WebhookFailure('MAPPING_OR_TRANSPORT',0,request.method==='POST')}
 if(response&&!failure){try{fields=mapRequestResponse(request,response.body)}catch{failure=new WebhookFailure('MAPPING',response.status)}}
 const ready=await transaction(pool,tenantId,async db=>{
  if(!await lockConversation(db,tenantId,job.conversation_id))return false;const current=await readJob(db,tenantId,String(job.id));if(!current||current.status!=='PROCESSING')return false;
  if(!owns(current)||!windowOpen(current)){await cancel(db,tenantId,current);return false}
  const expired=new Date(String(current.deadline_at)).getTime()<=Date.now();
  const retry=request.method==='GET'&&failure&&Number(current.attempts)<request.maxAttempts&&!expired&&(['TIMEOUT','TRANSPORT'].includes(failure.code)||[429,500,502,503,504].includes(failure.status));
  if(retry){await db.query("UPDATE chatbot_integration_jobs SET status='PENDING',next_attempt_at=now()+interval '2 seconds',last_error='SAFE_GET_RETRY' WHERE tenant_id=$1 AND id=$2",[tenantId,job.id]);await audit(db,tenantId,job.id,'FLOW_REQUEST_GET_RETRY');return false}
  const outcome=expired||failure?.code==='TIMEOUT'?'TIMEOUT':failure?'ERROR':'SUCCESS',status=failure?.ambiguous?'UNCERTAIN':failure?'FAILED':'SENT';
  await db.query("UPDATE chatbot_integration_jobs SET status=$3,result_outcome=$4,result_fields=$5::jsonb,response_status=$6,completion_pending=true,last_error=$7 WHERE tenant_id=$1 AND id=$2",[tenantId,job.id,status,outcome,JSON.stringify(outcome==='SUCCESS'?fields:{}),response?.status||failure?.status||null,failure?'REQUEST_'+failure.code:null]);await audit(db,tenantId,job.id,'FLOW_REQUEST_'+outcome);return true;
 });
 if(ready)await complete(pool,tenantId,String(job.id));return true;
}
async function complete(pool:SqlPool,tenantId:string,id:string){
 await transaction(pool,tenantId,async db=>{
  const ref=await db.query('SELECT conversation_id FROM chatbot_integration_jobs WHERE tenant_id=$1 AND id=$2',[tenantId,id]);if(!ref.rowCount)return;
  if(!await lockConversation(db,tenantId,ref.rows[0].conversation_id))return;const job=await readJob(db,tenantId,id);if(!job?.completion_pending)return;
  if(!owns(job)||!windowOpen(job)){await cancel(db,tenantId,job);return}
  await db.query('SAVEPOINT request_completion');
  try{
   const result=await respondToFlow(db,{tenantId,conversationId:String(job.conversation_id),contactId:String(job.contact_id),actionId:'',body:'',fromWhatsApp:job.channel==='WHATSAPP',integrationResume:{jobId:id,token:String(job.wait_token)}});
   await deliverConversation(db,tenantId,String(job.conversation_id),result.payloads,{staff:result.handedOff});
   await db.query('UPDATE chatbot_integration_jobs SET completion_pending=false,continuation_attempts=continuation_attempts+1 WHERE tenant_id=$1 AND id=$2',[tenantId,id]);await db.query('RELEASE SAVEPOINT request_completion');
  }catch{
   await db.query('ROLLBACK TO SAVEPOINT request_completion');await db.query("UPDATE chatbot_integration_jobs SET continuation_attempts=continuation_attempts+1,completion_pending=(continuation_attempts<4),last_error='CONTINUATION_FAILED_NO_HTTP_RESEND' WHERE tenant_id=$1 AND id=$2",[tenantId,id]);await audit(db,tenantId,id,'FLOW_REQUEST_CONTINUATION_FAILED');
  }
 });
}
