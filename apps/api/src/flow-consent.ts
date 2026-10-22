import {createHash} from 'node:crypto';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {cancelConversationAutomation} from './conversation-control.js';
export type ConsentDecision='GRANT'|'DENY'|'WITHDRAW';
export async function recordFlowConsent(db:SqlClient,t:string,contact:string,cid:string,input:{purpose:'SERVICE'|'MARKETING';decision:ConsentDecision;source:'FLOW'|'CUSTOMER_COMMAND'|'STAFF';nodeId?:string;policyVersion?:string;notice?:string;flowVersion?:number;actorId?:string}){
 const k=await db.query('SELECT id FROM contacts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[t,contact]);if(!k.rowCount)throw new HttpFailure(404,'Contact unavailable');
 const c=await db.query('SELECT channel FROM conversations WHERE tenant_id=$1 AND id=$2 AND contact_id=$3 FOR UPDATE',[t,cid,contact]);if(!c.rowCount)throw new HttpFailure(404,'Consent conversation unavailable');
 const granted=input.decision==='GRANT';
 if(input.purpose==='MARKETING')await db.query('UPDATE contacts SET marketing_opt_in=$3,marketing_opt_in_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE tenant_id=$1 AND id=$2',[t,contact,granted]);
 else await db.query('UPDATE contacts SET do_not_contact=$3,marketing_opt_in=CASE WHEN $3 THEN false ELSE marketing_opt_in END,marketing_opt_in_at=CASE WHEN $3 THEN NULL ELSE marketing_opt_in_at END WHERE tenant_id=$1 AND id=$2',[t,contact,!granted]);
 if(!granted){
  await db.query("UPDATE chatbot_campaign_jobs SET status='SKIPPED',error='CONSENT_REVOKED' WHERE tenant_id=$1 AND contact_id=$2 AND status='PENDING'",[t,contact]);
  if(input.purpose==='SERVICE'){
   const convs=await db.query('SELECT id FROM conversations WHERE tenant_id=$1 AND contact_id=$2 ORDER BY id FOR UPDATE',[t,contact]);for(const row of convs.rows)await cancelConversationAutomation(db,t,String(row.id));
   await db.query("UPDATE chatbot_connector_jobs SET status=CASE WHEN status='PROCESSING' THEN 'UNCERTAIN' ELSE 'CANCELLED' END,completion_pending=false,last_error='CONSENT_REVOKED' WHERE tenant_id=$1 AND contact_id=$2 AND status IN ('PENDING','PROCESSING')",[t,contact]);
  }else await db.query("UPDATE whatsapp_outbox SET status='FAILED',last_error='MARKETING_CONSENT_REVOKED' WHERE tenant_id=$1 AND conversation_id IN (SELECT id FROM conversations WHERE tenant_id=$1 AND contact_id=$2) AND status='PENDING' AND payload->>'type'='template'",[t,contact]);
 }
 const hash=input.notice?createHash('sha256').update(input.notice).digest('hex'):null;
 await db.query('INSERT INTO contact_consent_events(tenant_id,contact_id,channel,granted,evidence,purpose,decision,source,policy_version,node_id,conversation_id,actor_id,notice_hash,flow_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[t,contact,c.rows[0].channel,granted,('Explicit '+input.source+' '+input.purpose+' '+input.decision+(input.policyVersion?' policy '+input.policyVersion:'')).slice(0,400),input.purpose,input.decision,input.source,input.policyVersion??null,input.nodeId??null,cid,input.actorId??null,hash,input.flowVersion??null]);
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'contact',$4)",[t,input.actorId??null,'CONSENT_'+input.purpose+'_'+input.decision,contact]);
 return {granted,serviceBlocked:input.purpose==='SERVICE'&&!granted};
}
export async function consentHistory(db:SqlClient,a:Actor,cid:string){
 allow(a,['OWNER','MANAGER','AGENT']);if(!isUuid(cid))throw new HttpFailure(400,'Invalid conversation');const c=await db.query('SELECT contact_id FROM conversations WHERE tenant_id=$1 AND id=$2',[a.tenantId,cid]);if(!c.rowCount)throw new HttpFailure(404,'Conversation unavailable');
 const contact=await db.query('SELECT do_not_contact,marketing_opt_in FROM contacts WHERE tenant_id=$1 AND id=$2',[a.tenantId,c.rows[0].contact_id]);
 return {flags:contact.rows[0],events:(await db.query('SELECT id,channel,purpose,decision,source,granted,policy_version AS "policyVersion",node_id AS "nodeId",notice_hash AS "noticeHash",flow_version AS "flowVersion",occurred_at AS "occurredAt" FROM contact_consent_events WHERE tenant_id=$1 AND contact_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 100',[a.tenantId,c.rows[0].contact_id])).rows};
}
export async function revokeConsent(db:SqlClient,a:Actor,cid:string,input:unknown){
 allow(a,['OWNER','MANAGER','AGENT']);const d=input as {purpose?:unknown;acknowledged?:unknown;action?:unknown};if(!isUuid(cid)||!d||!['SERVICE','MARKETING'].includes(String(d.purpose))||d.acknowledged!==true||d.action!==undefined&&d.action!=='WITHDRAW')throw new HttpFailure(400,'Only explicitly acknowledged withdrawal is allowed; staff cannot grant customer consent');
 const c=await db.query('SELECT contact_id,assigned_user_id FROM conversations WHERE tenant_id=$1 AND id=$2',[a.tenantId,cid]);if(!c.rowCount)throw new HttpFailure(404,'Conversation unavailable');if(a.role==='AGENT'&&c.rows[0].assigned_user_id&&c.rows[0].assigned_user_id!==a.userId)throw new HttpFailure(403,'Conversation assigned to another agent');
 return recordFlowConsent(db,a.tenantId,String(c.rows[0].contact_id),cid,{purpose:d.purpose as 'SERVICE'|'MARKETING',decision:'WITHDRAW',source:'STAFF',actorId:a.userId});
}
