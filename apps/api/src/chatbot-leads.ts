/** Narrow SaaS scope: turn conversations into actionable staff leads, never reservations. */
import { allow, HttpFailure, isUuid, type Actor, type SqlClient } from './services.js';

export async function registerInterest(db:SqlClient,tenantId:string,conversationId:string,contactId:string,programId:null):Promise<string>{
 const result=await db.query(`
 INSERT INTO chatbot_leads(tenant_id,conversation_id,contact_id,program_id,stage)
 VALUES($1,$2,$3,$4,'INTERESTED')
 ON CONFLICT(tenant_id,conversation_id) DO UPDATE
 SET stage=CASE WHEN chatbot_leads.stage='CLOSED' THEN 'INTERESTED' ELSE chatbot_leads.stage END,updated_at=now()
 RETURNING id
 `,[tenantId,conversationId,contactId,programId]);
 return String(result.rows[0].id);
}
export async function readyForAgent(db:SqlClient,tenantId:string,leadId:string,conversationId:string,_legacyPreference:null){
 const result=await db.query(`UPDATE chatbot_leads SET stage='READY_FOR_AGENT',ready_at=coalesce(ready_at,now()),updated_at=now()
  WHERE tenant_id=$1 AND id=$2 AND conversation_id=$3 RETURNING id`,
  [tenantId,leadId,conversationId]);
 if(result.rowCount!==1)throw new HttpFailure(404,'Lead not found');
 await db.query(`UPDATE conversations SET status='HUMAN' WHERE tenant_id=$1 AND id=$2`,[tenantId,conversationId]);
 await db.query(`UPDATE whatsapp_conversation_states SET lead_stage='NONE' WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId]);
}
export async function listLeads(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 return (await db.query(`SELECT l.id,l.stage,l.created_at,l.updated_at,l.ready_at,
  l.conversation_id,l.custom_fields,c.full_name AS customer_name,c.phone,p.title AS catalog_title,
  v.assigned_user_id,v.status AS conversation_status,v.channel,
  (SELECT min(t.due_at) FROM chatbot_lead_tasks t WHERE t.tenant_id=l.tenant_id AND t.lead_id=l.id AND t.status='OPEN') AS next_followup_at,
  (SELECT count(*)::int FROM chatbot_lead_tasks t WHERE t.tenant_id=l.tenant_id AND t.lead_id=l.id AND t.status='OPEN') AS open_tasks
  FROM chatbot_leads l
  JOIN contacts c ON c.tenant_id=l.tenant_id AND c.id=l.contact_id
  JOIN conversations v ON v.tenant_id=l.tenant_id AND v.id=l.conversation_id
  LEFT JOIN chatbot_catalog_items p ON p.tenant_id=l.tenant_id AND p.id=l.catalog_item_id
  WHERE l.tenant_id=$1 ORDER BY
   CASE l.stage WHEN 'READY_FOR_AGENT' THEN 0 WHEN 'INTERESTED' THEN 1 WHEN 'CONTACTED' THEN 2 ELSE 3 END,
   l.updated_at DESC LIMIT 200`,[actor.tenantId])).rows.map(lead=>{
   // Transparent, rule-based prioritization; never confuse this with ML scoring.
   const fields:Record<string,unknown>=lead.custom_fields&&typeof lead.custom_fields==='object'?lead.custom_fields as Record<string,unknown>:{};
   const stage=String(lead.stage),weight:Record<string,number>={READY_FOR_AGENT:65,INTERESTED:40,CONTACTED:22,CLOSED:0};
   let score=weight[stage]??0;
   if(lead.catalog_title)score+=10;
   if(fields.customer_need)score+=12;
   if(fields.customer_name)score+=5;
   if(fields.customer_phone)score+=5;
   if(Date.now()-new Date(String(lead.updated_at)).getTime()<86400000)score+=8;
   if(lead.next_followup_at&&new Date(String(lead.next_followup_at)).getTime()<Date.now()&&stage!=='CLOSED')score+=8;
   return {...lead,priorityScore:Math.min(100,score)};
  });
}
export async function leadSummary(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 const result=await db.query(`SELECT
 count(*)::int AS total,
 count(*) FILTER(WHERE stage='INTERESTED')::int AS interested,
 count(*) FILTER(WHERE stage='READY_FOR_AGENT')::int AS ready,
 count(*) FILTER(WHERE stage='CONTACTED')::int AS contacted,
 count(*) FILTER(WHERE stage='CLOSED')::int AS closed
 FROM chatbot_leads WHERE tenant_id=$1`,[actor.tenantId]);
 return result.rows[0]??{total:0,interested:0,ready:0,contacted:0,closed:0};
}
export async function updateLeadStage(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);
 if(!isUuid(id)||!input||typeof input!=='object'||Array.isArray(input))throw new HttpFailure(400,'Invalid lead');
 const stage=(input as Record<string,unknown>).stage;
 if(stage!=='CONTACTED'&&stage!=='CLOSED'&&stage!=='READY_FOR_AGENT')throw new HttpFailure(400,'Invalid lead stage');
 const result=await db.query(`UPDATE chatbot_leads SET stage=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2
 RETURNING id,stage`,[actor.tenantId,id,stage]);
 if(result.rowCount!==1)throw new HttpFailure(404,'Lead not found');
 if(stage==='CLOSED')await db.query("UPDATE chatbot_lead_tasks SET status='DONE',completed_at=now() WHERE tenant_id=$1 AND lead_id=$2 AND status='OPEN'",[actor.tenantId,id]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id)
 VALUES($1,$2,'LEAD_STAGE_UPDATED','chatbot_lead',$3)`,[actor.tenantId,actor.userId,id]);
 return result.rows[0];
}


/** Staff follow-ups: actionable tasks, not automatic WhatsApp outreach. */
export async function listLeadTasks(db:SqlClient,actor:Actor,leadId:string){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 if(!isUuid(leadId))throw new HttpFailure(400,'Invalid lead');
 const exists=await db.query('SELECT id FROM chatbot_leads WHERE tenant_id=$1 AND id=$2',[actor.tenantId,leadId]);
 if(!exists.rowCount)throw new HttpFailure(404,'Lead not found');
 return (await db.query("SELECT id,description,due_at AS \"dueAt\",status,created_at AS \"createdAt\",completed_at AS \"completedAt\" FROM chatbot_lead_tasks WHERE tenant_id=$1 AND lead_id=$2 ORDER BY CASE WHEN status='OPEN' THEN 0 ELSE 1 END,due_at LIMIT 100",[actor.tenantId,leadId])).rows;
}
export async function addLeadTask(db:SqlClient,actor:Actor,leadId:string,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);
 if(!isUuid(leadId)||!input||typeof input!=='object'||Array.isArray(input))throw new HttpFailure(400,'Invalid follow-up task');
 const d=input as Record<string,unknown>;
 const description=typeof d.description==='string'?d.description.trim():'';
 const date=typeof d.dueAt==='string'?new Date(d.dueAt):new Date(NaN);
 if(description.length<2||description.length>500||!Number.isFinite(date.getTime())||date.getTime()<Date.now()-60000||date.getTime()>Date.now()+366*86400000)throw new HttpFailure(400,'Description and future due date required');
 const exists=await db.query("SELECT id FROM chatbot_leads WHERE tenant_id=$1 AND id=$2 AND stage!='CLOSED'",[actor.tenantId,leadId]);
 if(!exists.rowCount)throw new HttpFailure(404,'Active lead not found');
 const r=await db.query("INSERT INTO chatbot_lead_tasks(tenant_id,lead_id,description,due_at,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id,description,due_at AS \"dueAt\",status",[actor.tenantId,leadId,description,date.toISOString(),actor.userId]);
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'LEAD_FOLLOWUP_CREATED','chatbot_lead_task',$3)",[actor.tenantId,actor.userId,r.rows[0].id]);
 return r.rows[0];
}
export async function completeLeadTask(db:SqlClient,actor:Actor,leadId:string,taskId:string){
 allow(actor,['OWNER','MANAGER','AGENT']);
 if(!isUuid(leadId)||!isUuid(taskId))throw new HttpFailure(400,'Invalid task');
 const r=await db.query("UPDATE chatbot_lead_tasks SET status='DONE',completed_at=now() WHERE tenant_id=$1 AND lead_id=$2 AND id=$3 AND status='OPEN' RETURNING id,status",[actor.tenantId,leadId,taskId]);
 if(!r.rowCount)throw new HttpFailure(404,'Open task not found');
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'LEAD_FOLLOWUP_COMPLETED','chatbot_lead_task',$3)",[actor.tenantId,actor.userId,taskId]);
 return r.rows[0];
}
