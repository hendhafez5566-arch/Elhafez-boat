/** Existing conversation/session/queues are authoritative. No second runtime or job system. */
import {randomUUID} from 'node:crypto';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {botScope} from './bots.js';
export async function cancelConversationAutomation(db:SqlClient,t:string,cid:string){
 await db.query("UPDATE chatbot_delay_jobs SET status='CANCELLED',error='CONVERSATION_CONTROL' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING'",[t,cid]);
 for(const table of ['chatbot_integration_jobs','chatbot_connector_jobs'])await db.query(`UPDATE ${table} SET status=CASE WHEN status='PROCESSING' THEN 'UNCERTAIN' WHEN status='PENDING' THEN 'CANCELLED' ELSE status END,completion_pending=false,last_error='CONVERSATION_CONTROL' WHERE tenant_id=$1 AND conversation_id=$2 AND flow_request IS NOT NULL AND (status IN ('PENDING','PROCESSING') OR completion_pending)`,[t,cid]);
 await db.query("UPDATE whatsapp_outbox SET status='FAILED',last_error='CONVERSATION_CONTROL' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING'",[t,cid]);
 await db.query("UPDATE chatbot_social_outbox SET status='CANCELLED',last_error='CONVERSATION_CONTROL' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING'",[t,cid]);
 await db.query("UPDATE chatbot_flow_sessions SET runtime_state=runtime_state-'wait' WHERE tenant_id=$1 AND conversation_id=$2",[t,cid]);
}
export async function lockControlledConversation(db:SqlClient,t:string,id:string){
 const k=await db.query('SELECT k.id FROM contacts k JOIN conversations c ON c.tenant_id=k.tenant_id AND c.contact_id=k.id WHERE c.tenant_id=$1 AND c.id=$2 FOR UPDATE OF k',[t,id]);if(!k.rowCount)throw new HttpFailure(404,'Conversation unavailable');
 const c=await db.query('SELECT * FROM conversations WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[t,id]);return c.rows[0];
}
export async function setBotControl(db:SqlClient,t:string,id:string,control:Record<string,unknown>,assigned:string|null=null){
 await cancelConversationAutomation(db,t,id);
 const status=control.mode==='RUNNING'?'OPEN':control.mode==='STOPPED'?'CLOSED':'HUMAN';
 await db.query('UPDATE conversations SET bot_control=$3::jsonb,bot_revision=bot_revision+1,status=$4,assigned_user_id=$5 WHERE tenant_id=$1 AND id=$2',[t,id,JSON.stringify({...control,token:randomUUID(),since:new Date().toISOString()}),status,assigned]);
}
export async function controlledConversations(db:SqlClient,a:Actor,bot:string){
 allow(a,['OWNER','MANAGER','AGENT']);const scope=await botScope(db,a,bot);
 return {rows:(await db.query(`SELECT c.id,c.status,c.bot_revision AS revision,c.bot_control AS control,c.assigned_user_id AS "assignedUserId",s.version,s.node_id AS "nodeId" FROM conversations c JOIN chatbot_flow_sessions s ON s.tenant_id=c.tenant_id AND s.conversation_id=c.id WHERE c.tenant_id=$1 AND (s.bot_id=$2 OR ($3::boolean AND s.bot_id IS NULL)) ORDER BY c.last_message_at DESC NULLS LAST,c.id LIMIT 100`,[a.tenantId,bot,scope===undefined])).rows};
}
export async function resumeControlledConversation(db:SqlClient,t:string,id:string,restart=false){
 const c=await lockControlledConversation(db,t,id),k=await db.query('SELECT do_not_contact FROM contacts WHERE tenant_id=$1 AND id=$2',[t,c.contact_id]);
 if(k.rows[0]?.do_not_contact)throw new HttpFailure(409,'العميل أوقف الخدمة؛ لا يمكن للموظف منح الموافقة بالنيابة عنه.');
 const control=(c.bot_control||{}) as Record<string,unknown>;
 if(!restart&&control.mode==='STOPPED')throw new HttpFailure(409,'المسار منتهٍ؛ اختر بدءًا جديدًا صراحةً.');
 await setBotControl(db,t,id,{mode:'RUNNING'});
 if(!restart&&control.resumeFinished)return {resumed:true,sent:0};
 if(restart)await db.query('DELETE FROM chatbot_flow_sessions WHERE tenant_id=$1 AND conversation_id=$2',[t,id]);
 else await db.query("UPDATE chatbot_flow_sessions SET node_id=$3,runtime_state=runtime_state-'wait',runtime_nodes=CASE WHEN $3::text IS NULL THEN NULL ELSE runtime_nodes END WHERE tenant_id=$1 AND conversation_id=$2",[t,id,typeof control.resumeNode==='string'?control.resumeNode:null]);
 const {respondToFlow}=await import('./flow-service.js'),{deliverConversation}=await import('./channels.js');
 const result=await respondToFlow(db,{tenantId:t,conversationId:id,contactId:String(c.contact_id),actionId:restart?'flow:restart':'',body:'',fromWhatsApp:c.channel==='WHATSAPP',operatorResume:true});
 await deliverConversation(db,t,id,result.payloads,{staff:result.handedOff});return {resumed:true,sent:result.payloads.length};
}
export async function controlConversation(db:SqlClient,a:Actor,bot:string,id:string,input:unknown){
 allow(a,['OWNER','MANAGER','AGENT']);const scope=await botScope(db,a,bot),d=input as {action?:unknown;expectedRevision?:unknown};
 if(!isUuid(id)||!d||!['PAUSE','RESUME','STOP','RESTART'].includes(String(d.action))||!Number.isInteger(d.expectedRevision))throw new HttpFailure(400,'Choose a control action and current revision');
 const c=await lockControlledConversation(db,a.tenantId,id);
 const s=await db.query(`SELECT s.node_id,s.version,coalesce(v.definition,f.definition) AS definition FROM chatbot_flow_sessions s LEFT JOIN chatbot_bot_versions v ON v.tenant_id=s.tenant_id AND v.bot_id=s.bot_id AND v.version=s.version LEFT JOIN chatbot_flow_versions f ON f.tenant_id=s.tenant_id AND f.version=s.version AND $4::boolean WHERE s.tenant_id=$1 AND s.conversation_id=$2 AND (s.bot_id=$3 OR ($4::boolean AND s.bot_id IS NULL)) FOR UPDATE OF s`,[a.tenantId,id,bot,scope===undefined]);if(!s.rowCount)throw new HttpFailure(404,'Bot conversation unavailable');
 if(c.bot_revision!==d.expectedRevision)throw new HttpFailure(409,'تغيرت المحادثة؛ حدّث حالتها أولًا.');
 if(a.role==='AGENT'&&c.assigned_user_id&&c.assigned_user_id!==a.userId)throw new HttpFailure(403,'المحادثة مسندة لموظف آخر.');
 if((c.bot_control as Record<string,unknown>)?.mode==='STOPPED'&&d.action==='PAUSE')throw new HttpFailure(409,'Stopped flow requires explicit restart');
 let result:unknown={changed:true};
 if(d.action==='RESUME'||d.action==='RESTART')result=await resumeControlledConversation(db,a.tenantId,id,d.action==='RESTART');
 else{const node=(s.rows[0].definition as any)?.nodes?.find((n:any)=>n.id===s.rows[0].node_id),next=node?.type==='WEBHOOK'||node?.type==='CONNECTOR'?node.request?.errorNext??node.next:node?.type==='DELAY'||node?.type==='CONTROL'?node.next:node?.type==='HANDOFF'||node?.type==='END'?null:node?.id;await setBotControl(db,a.tenantId,id,{mode:d.action==='STOP'?'STOPPED':'PAUSED',resumeNode:next,resumeFinished:node?.type==='END'},d.action==='PAUSE'?a.userId:null)}
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'conversation',$4)",[a.tenantId,a.userId,'BOT_CONTROL_'+d.action,id]);return result;
}
export async function handoffRoster(db:SqlClient,a:Actor){allow(a,['OWNER','MANAGER','AGENT']);return (await db.query("SELECT m.user_id AS id,u.email,m.role,m.inbox_available AS available,m.inbox_team AS team FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=$1 AND m.role IN ('OWNER','MANAGER','AGENT') ORDER BY u.email LIMIT 200",[a.tenantId])).rows}
export async function updateHandoffAvailability(db:SqlClient,a:Actor,input:unknown){
 allow(a,['OWNER','MANAGER','AGENT']);const d=input as {userId?:unknown;available?:unknown;team?:unknown};
 if(!d||!isUuid(d.userId)||typeof d.available!=='boolean'||d.team!==undefined&&(typeof d.team!=='string'||d.team.length>80))throw new HttpFailure(400,'Invalid availability');
 if(a.role==='AGENT'&&(d.userId!==a.userId||d.team!==undefined))throw new HttpFailure(403,'Agents may change only their own availability');
 const r=await db.query("UPDATE memberships SET inbox_available=$3,inbox_team=coalesce($4,inbox_team) WHERE tenant_id=$1 AND user_id=$2 AND role IN ('OWNER','MANAGER','AGENT') RETURNING user_id",[a.tenantId,d.userId,d.available,d.team??null]);if(!r.rowCount)throw new HttpFailure(404,'Eligible member unavailable');
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'HANDOFF_AVAILABILITY_CHANGED','member',$3)",[a.tenantId,a.userId,d.userId]);return {updated:true};
}
/** Uses the existing delay queue; activity extends only the configured human inactivity wait. */
export async function processControlledDeadline(db:SqlClient,t:string,id:string,job:Record<string,unknown>){
 const c=await lockControlledConversation(db,t,id),control=(c.bot_control||{}) as Record<string,unknown>;
 if(!['PAUSED','HANDOFF'].includes(String(control.mode))||control.token!==job.wait_token){await db.query("UPDATE chatbot_delay_jobs SET status='CANCELLED',error='STALE_CONTROL_TOKEN' WHERE tenant_id=$1 AND conversation_id=$2",[t,id]);return;}
 const active=await db.query("SELECT 1 FROM tenant_subscriptions WHERE tenant_id=$1 AND status IN ('ACTIVE','TRIAL') AND current_period_ends_at>now()",[t]);if(!active.rowCount){await db.query("UPDATE chatbot_delay_jobs SET due_at=now()+interval '5 minutes' WHERE tenant_id=$1 AND conversation_id=$2",[t,id]);return;}
 const contact=await db.query('SELECT do_not_contact FROM contacts WHERE tenant_id=$1 AND id=$2',[t,c.contact_id]);if(contact.rows[0]?.do_not_contact){await cancelConversationAutomation(db,t,id);return}
 if(job.purpose==='HUMAN_IDLE'){
  const activity=Math.max(new Date(String(c.last_message_at||0)).getTime(),new Date(String(c.last_customer_message_at||0)).getTime(),new Date(String(control.since)).getTime());const due=activity+Number(control.idleSeconds)*1000;
  if(due>Date.now()){await db.query('UPDATE chatbot_delay_jobs SET due_at=to_timestamp($3::double precision/1000) WHERE tenant_id=$1 AND conversation_id=$2',[t,id,due]);return;}
 }
 if(job.purpose==='BOT_RESUME'||control.idleAction==='RESUME')await resumeControlledConversation(db,t,id);
 else await setBotControl(db,t,id,{...control,mode:control.idleAction==='CLOSE'?'STOPPED':'HANDOFF'},null);
 await db.query("UPDATE chatbot_delay_jobs SET status='DONE' WHERE tenant_id=$1 AND conversation_id=$2 AND wait_token=$3",[t,id,job.wait_token]);
 await db.query("INSERT INTO audit_events(tenant_id,action,entity_type,entity_id) VALUES($1,'CONTROL_DEADLINE_COMPLETED','conversation',$2)",[t,id]);
}
