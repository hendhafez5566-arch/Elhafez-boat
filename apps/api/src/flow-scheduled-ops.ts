/** Inspect existing scheduled DELAY work, never customer answers or request jobs. */
import {botScope} from './bots.js';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {setWhatsAppHandoff} from './whatsapp.js';
import {registerInterest,readyForAgent} from './chatbot-leads.js';
async function rows(db:SqlClient,a:Actor,bot:string,scope:string|undefined,status:string,before?:string,id?:string){
 return db.query(`SELECT j.conversation_id AS "conversationId",j.version,j.node_id AS "nodeId",j.status,j.due_at AS "dueAt",extract(epoch FROM j.due_at)::text AS "dueKey",j.wait_token AS "waitToken",c.status AS "conversationStatus",
 (j.status='PENDING' AND c.status='OPEN' AND s.node_id=j.node_id AND s.version=j.version AND coalesce(s.runtime_state->'wait'->>'token','')=coalesce(j.wait_token::text,'')) AS "canCancel"
 FROM chatbot_delay_jobs j JOIN chatbot_flow_sessions s ON s.tenant_id=j.tenant_id AND s.conversation_id=j.conversation_id JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id
 JOIN ${scope?'chatbot_bot_versions':'chatbot_flow_versions'} v ON v.tenant_id=j.tenant_id AND v.version=j.version${scope?' AND v.bot_id=$2':''}
 JOIN LATERAL jsonb_array_elements(v.definition->'nodes') n ON n->>'id'=j.node_id AND n->>'type'='DELAY'
 WHERE j.tenant_id=$1 AND j.purpose='FLOW' AND (s.bot_id=$2 OR ($3::boolean AND s.bot_id IS NULL)) AND ($4='ALL' OR j.status=$4)
 AND ($5::uuid IS NULL OR (j.due_at,j.conversation_id)>(SELECT mark.due_at,mark.conversation_id FROM chatbot_delay_jobs mark WHERE mark.tenant_id=$1 AND mark.conversation_id=$5))
 AND ($6::uuid IS NULL OR j.conversation_id=$6) ORDER BY j.due_at,j.conversation_id LIMIT 21`,[a.tenantId,bot,scope===undefined,status,before??null,id??null]);
}
export async function scheduledFlowJobs(db:SqlClient,a:Actor,bot:string,input:{status?:string;before?:string}={}){
 allow(a,['OWNER','MANAGER']);const scope=await botScope(db,a,bot),status=input.status||'PENDING';
 if(!['PENDING','ALL','DONE','CANCELLED','FAILED'].includes(status)||input.before!==undefined&&!isUuid(input.before))throw new HttpFailure(400,'Invalid schedule filter');
 if(input.before){const c=await rows(db,a,bot,scope,'ALL',undefined,input.before);if(!c.rowCount)throw new HttpFailure(400,'Schedule cursor unavailable')}
 const result=await rows(db,a,bot,scope,status,input.before);
 return {rows:result.rows.slice(0,20),nextCursor:result.rows.length>20?result.rows[19].conversationId:null,scope:'scheduled_delay_metadata_only'};
}
export async function cancelScheduledFlow(db:SqlClient,a:Actor,bot:string,id:string,input:unknown){
 allow(a,['OWNER','MANAGER']);const scope=await botScope(db,a,bot,true),d=input as {acknowledged?:unknown;dueKey?:unknown;waitToken?:unknown;version?:unknown;nodeId?:unknown};
 if(!isUuid(id)||!d||d.acknowledged!==true||typeof d.dueKey!=='string'||!/^[0-9]{9,12}(?:\.[0-9]{1,6})?$/.test(d.dueKey)||!(d.waitToken===null||isUuid(d.waitToken))||!Number.isInteger(d.version)||typeof d.nodeId!=='string'||d.nodeId.length>180)throw new HttpFailure(400,'Confirm the exact scheduled wait and handoff');
 // Match privacy/inbound lock ordering; stale inspection can never cancel a rescheduled wait.
 const contact=await db.query('SELECT k.id FROM contacts k JOIN conversations c ON c.tenant_id=k.tenant_id AND c.contact_id=k.id WHERE c.tenant_id=$1 AND c.id=$2 FOR UPDATE OF k',[a.tenantId,id]);if(!contact.rowCount)throw new HttpFailure(404,'Scheduled conversation unavailable');
 await db.query('SELECT id FROM conversations WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[a.tenantId,id]);
 await db.query('SELECT conversation_id FROM chatbot_flow_sessions WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[a.tenantId,id]);
 await db.query('SELECT conversation_id FROM chatbot_delay_jobs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[a.tenantId,id]);
 const result=await rows(db,a,bot,scope,'ALL',undefined,id),job=result.rows[0];if(!job)throw new HttpFailure(404,'Scheduled flow wait unavailable');
 if(job.dueKey!==d.dueKey||job.waitToken!==d.waitToken||job.version!==d.version||job.nodeId!==d.nodeId)throw new HttpFailure(409,'تغير موعد الانتظار؛ حدّث القائمة أولًا.');
 const evidence=id+':'+d.dueKey+':'+(d.waitToken||'legacy');
 const existing=await db.query("SELECT 1 FROM audit_events WHERE tenant_id=$1 AND entity_id=$2 AND action='SCHEDULE_CANCELLED_BY_AUTHOR'",[a.tenantId,evidence]);
 if(job.status==='CANCELLED'&&job.conversationStatus==='HUMAN'&&existing.rowCount)return {cancelled:true,handedOff:true,replayed:true,sent:0};
 if(!job.canCancel)throw new HttpFailure(409,'لم يعد هذا الانتظار قابلًا للإلغاء.');
 const lead=await registerInterest(db,a.tenantId,id,String(contact.rows[0].id),null);await readyForAgent(db,a.tenantId,lead,id,null);
 await setWhatsAppHandoff(db,a,id,{status:'HUMAN'});
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'SCHEDULE_CANCELLED_BY_AUTHOR','conversation',$3)",[a.tenantId,a.userId,evidence]);
 return {cancelled:true,handedOff:true,replayed:false,sent:0};
}
