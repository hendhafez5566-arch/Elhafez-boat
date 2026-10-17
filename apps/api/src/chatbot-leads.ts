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
  v.assigned_user_id,v.status AS conversation_status
  FROM chatbot_leads l
  JOIN contacts c ON c.tenant_id=l.tenant_id AND c.id=l.contact_id
  JOIN conversations v ON v.tenant_id=l.tenant_id AND v.id=l.conversation_id
  LEFT JOIN chatbot_catalog_items p ON p.tenant_id=l.tenant_id AND p.id=l.catalog_item_id
  WHERE l.tenant_id=$1 ORDER BY
   CASE l.stage WHEN 'READY_FOR_AGENT' THEN 0 WHEN 'INTERESTED' THEN 1 WHEN 'CONTACTED' THEN 2 ELSE 3 END,
   l.updated_at DESC LIMIT 200`,[actor.tenantId])).rows;
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
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id)
 VALUES($1,$2,'LEAD_STAGE_UPDATED','chatbot_lead',$3)`,[actor.tenantId,actor.userId,id]);
 return result.rows[0];
}
