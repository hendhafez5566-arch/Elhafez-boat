import {respondToFlow} from './flow-service.js';
import {deliverConversation} from './channels.js';
import {type SqlClient} from './services.js';
export async function processDelay(db:SqlClient,tenantId:string){
 // Lock conversation before session/job, matching inbound and staff ownership order.
 const due=await db.query(`SELECT j.conversation_id FROM chatbot_delay_jobs j JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id WHERE j.tenant_id=$1 AND j.status='PENDING' AND j.due_at<=now() ORDER BY j.due_at LIMIT 1 FOR UPDATE OF c SKIP LOCKED`,[tenantId]);
 if(!due.rowCount)return false;const conversationId=String(due.rows[0].conversation_id);
 const job=await db.query(`SELECT j.version,j.node_id,c.contact_id,c.channel,c.status FROM chatbot_delay_jobs j JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id WHERE j.tenant_id=$1 AND j.conversation_id=$2 AND j.status='PENDING' AND j.due_at<=now() FOR UPDATE OF j`,[tenantId,conversationId]);if(!job.rowCount)return false;const j=job.rows[0];
 const active=await db.query(`SELECT 1 FROM tenant_subscriptions WHERE tenant_id=$1 AND status IN ('TRIAL','ACTIVE') AND current_period_ends_at>now()`,[tenantId]);
 if(!active.rowCount||j.status!=='OPEN'){await db.query(`UPDATE chatbot_delay_jobs SET status='CANCELLED',error='Subscription inactive or bot no longer owns conversation' WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId]);return true}
 await db.query('SAVEPOINT delay_work');
 try{
  await db.query(`UPDATE chatbot_delay_jobs SET status='DONE' WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId]);
  const result=await respondToFlow(db,{tenantId,conversationId,contactId:String(j.contact_id),actionId:'',body:'',fromWhatsApp:j.channel==='WHATSAPP',resume:{version:Number(j.version),nodeId:String(j.node_id)}});
  // Handoff may change status to HUMAN while still needing to deliver its final acknowledgement.
  await deliverConversation(db,tenantId,conversationId,result.payloads,{staff:result.handedOff});
  await db.query('RELEASE SAVEPOINT delay_work');
 }catch{
  await db.query('ROLLBACK TO SAVEPOINT delay_work');
  await db.query(`UPDATE chatbot_delay_jobs SET status='FAILED',error='Continuation unavailable; check window, consent, flow and account' WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId]);
 }
 return true;
}
