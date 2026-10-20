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
interface LeadPageOptions {page:number;search:string;stage:string;order:string}
export async function listLeads(db:SqlClient,actor:Actor,options?:LeadPageOptions){
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
  WHERE l.tenant_id=$1 ${options?`AND ($2='' OR strpos(lower(concat_ws(' ',c.full_name,c.phone,l.custom_fields::text)),lower($2))>0) AND ($3='ALL' OR l.stage=$3)`:''} ORDER BY
   ${options?.order==='priority'?`LEAST(100,
    CASE l.stage WHEN 'READY_FOR_AGENT' THEN 65 WHEN 'INTERESTED' THEN 40 WHEN 'CONTACTED' THEN 22 ELSE 0 END
    +CASE WHEN p.title IS NOT NULL THEN 10 ELSE 0 END
    +CASE WHEN coalesce(l.custom_fields->>'customer_need','')<>'' THEN 12 ELSE 0 END
    +CASE WHEN coalesce(l.custom_fields->>'customer_name','')<>'' THEN 5 ELSE 0 END
    +CASE WHEN coalesce(l.custom_fields->>'customer_phone','')<>'' THEN 5 ELSE 0 END
    +CASE WHEN l.updated_at>now()-interval '24 hours' THEN 8 ELSE 0 END
    +CASE WHEN l.stage<>'CLOSED' AND EXISTS(SELECT 1 FROM chatbot_lead_tasks t WHERE t.tenant_id=l.tenant_id AND t.lead_id=l.id AND t.status='OPEN' AND t.due_at<now()) THEN 8 ELSE 0 END) DESC,`:''}
   ${options?.order==='recent'?'l.updated_at DESC,':options?.order==='due'?`(SELECT min(t.due_at) FROM chatbot_lead_tasks t WHERE t.tenant_id=l.tenant_id AND t.lead_id=l.id AND t.status='OPEN') ASC NULLS LAST,`:''}
   CASE l.stage WHEN 'READY_FOR_AGENT' THEN 0 WHEN 'INTERESTED' THEN 1 WHEN 'CONTACTED' THEN 2 ELSE 3 END,
   l.updated_at DESC,l.id ${options?'LIMIT 20 OFFSET $4':'LIMIT 200'}`,[actor.tenantId,...(options?[options.search,options.stage,(options.page-1)*20]:[])])).rows.map(lead=>{
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

// Internal CRM assignment: only active leads to an existing company staff member.
// Does not send a message or change the bot/human handoff state.
export async function assignLead(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER']);
 const d=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const userId=d.userId;
 if(!isUuid(id)||!isUuid(userId))throw new HttpFailure(400,'Valid lead and staff IDs required');
 const member=await db.query("SELECT user_id FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND role IN ('OWNER','MANAGER','AGENT')",[actor.tenantId,userId]);
 if(!member.rowCount)throw new HttpFailure(404,'Staff member not found in company');
 const updated=await db.query("UPDATE conversations SET assigned_user_id=$3 WHERE tenant_id=$1 AND id=(SELECT conversation_id FROM chatbot_leads WHERE tenant_id=$1 AND id=$2 AND stage!='CLOSED') RETURNING id",[actor.tenantId,id,userId]);
 if(!updated.rowCount)throw new HttpFailure(404,'Active lead not found');
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'LEAD_ASSIGNED','chatbot_lead',$3)",[actor.tenantId,actor.userId,id]);
 return {leadId:id,assignedUserId:userId};
}

/** Search and pagination execute in PostgreSQL across the full company directory. */
export async function leadPage(db:SqlClient,actor:Actor,input:URLSearchParams){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 const page=Number(input.get('page')||1),search=(input.get('search')||'').trim(),stage=input.get('stage')||'ALL',order=input.get('order')||'priority';
 if(!Number.isInteger(page)||page<1||page>100000||search.length>150||!['ALL','INTERESTED','READY_FOR_AGENT','CONTACTED','CLOSED'].includes(stage)||!['priority','recent','due'].includes(order))throw new HttpFailure(400,'Invalid lead filters');
 const count=await db.query(`SELECT count(*)::int AS total FROM chatbot_leads l JOIN contacts c ON c.tenant_id=l.tenant_id AND c.id=l.contact_id WHERE l.tenant_id=$1 AND ($2='' OR strpos(lower(concat_ws(' ',c.full_name,c.phone,l.custom_fields::text)),lower($2))>0) AND ($3='ALL' OR l.stage=$3)`,[actor.tenantId,search,stage]);
 const total=Number(count.rows[0].total),pages=Math.max(1,Math.ceil(total/20));
 return {items:await listLeads(db,actor,{page:Math.min(page,pages),search,stage,order}),page:Math.min(page,pages),total,pages};
}

/** One contact profile linked to the selected lead and its real conversation. */
export async function leadProfile(db:SqlClient,actor:Actor,id:string,conversationPage=1){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);if(!Number.isInteger(conversationPage)||conversationPage<1||conversationPage>100000)throw new HttpFailure(400,'Invalid conversation page');if(!isUuid(id))throw new HttpFailure(400,'Invalid lead');
 const r=await db.query(`SELECT l.id,l.stage,l.custom_fields,l.created_at,l.updated_at,l.conversation_id,
 c.id AS contact_id,c.full_name,c.phone,c.do_not_contact,v.channel,v.status,v.assigned_user_id,s.bot_id,b.name AS bot_name
 FROM chatbot_leads l JOIN contacts c ON c.tenant_id=l.tenant_id AND c.id=l.contact_id
 JOIN conversations v ON v.tenant_id=l.tenant_id AND v.id=l.conversation_id
 LEFT JOIN chatbot_flow_sessions s ON s.tenant_id=l.tenant_id AND s.conversation_id=l.conversation_id
 LEFT JOIN chatbot_bots b ON b.tenant_id=s.tenant_id AND b.id=s.bot_id
 WHERE l.tenant_id=$1 AND l.id=$2`,[actor.tenantId,id]);
 if(!r.rowCount)throw new HttpFailure(404,'Lead not found');
 const profile=r.rows[0];
 const messages=await db.query(`SELECT id,kind,body,created_at FROM (SELECT id,kind,body,created_at FROM conversation_messages
 WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY created_at DESC,id DESC LIMIT 30) recent ORDER BY created_at,id`,[actor.tenantId,profile.conversation_id]);
 const count=await db.query('SELECT count(*)::int AS total FROM conversations WHERE tenant_id=$1 AND contact_id=$2',[actor.tenantId,profile.contact_id]);
 const total=Number(count.rows[0].total),pages=Math.max(1,Math.ceil(total/20)),page=Math.min(conversationPage,pages);
 const conversations=await db.query(`SELECT v.id,v.channel,v.status,v.assigned_user_id,v.last_message_at,
  m.body AS last_message,m.created_at AS last_activity_at FROM conversations v LEFT JOIN LATERAL
  (SELECT body,created_at FROM conversation_messages WHERE tenant_id=v.tenant_id AND conversation_id=v.id AND kind IN ('INBOUND','OUTBOUND','INTERNAL_NOTE') ORDER BY created_at DESC,id DESC LIMIT 1) m ON true
  WHERE v.tenant_id=$1 AND v.contact_id=$2 ORDER BY v.last_message_at DESC NULLS LAST,v.id LIMIT 20 OFFSET $3`,[actor.tenantId,profile.contact_id,(page-1)*20]);
 return {...profile,messages:messages.rows,conversations:conversations.rows,conversationPage:page,conversationPages:pages,conversationTotal:total};
}

/** All-or-nothing company CRM batch. No outbound operations or consent changes. */
export async function bulkLeadStage(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);const d=input as {ids?:unknown;stage?:unknown};
 if(!d||!Array.isArray(d.ids)||d.ids.length<1||d.ids.length>50||!d.ids.every(isUuid)||new Set(d.ids).size!==d.ids.length)throw new HttpFailure(400,'Select 1–50 unique leads');
 if(!['READY_FOR_AGENT','CONTACTED','CLOSED'].includes(String(d.stage)))throw new HttpFailure(400,'Invalid lead stage');
 const rows=await db.query('SELECT id FROM chatbot_leads WHERE tenant_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[actor.tenantId,d.ids]);
 if(rows.rows.length!==d.ids.length)throw new HttpFailure(404,'One or more leads unavailable in company');
 for(const id of d.ids)await updateLeadStage(db,actor,id,{stage:d.stage});
 return {updated:d.ids.length,stage:d.stage};
}
