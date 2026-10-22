import {allow,HttpFailure,type Actor,type SqlClient} from './services.js';
export async function requireActiveTenant(db:SqlClient,tenantId:string){
 const r=await db.query(`SELECT 1 FROM tenant_subscriptions WHERE tenant_id=$1 AND status IN ('ACTIVE','TRIAL') AND current_period_ends_at>now()`,[tenantId]);if(!r.rowCount)throw new HttpFailure(403,'Company subscription inactive');
}
export async function consumeUsage(db:SqlClient,tenantId:string,kind:'inbound'|'templates'){
 await requireActiveTenant(db,tenantId);
 const limit=await db.query(`SELECT daily_inbound,daily_templates FROM chatbot_usage_limits WHERE tenant_id=$1`,[tenantId]);
 const cap=Number(limit.rows[0]?.[kind==='inbound'?'daily_inbound':'daily_templates']??(kind==='inbound'?10000:500));
 const r=await db.query(`INSERT INTO chatbot_usage(tenant_id,day,${kind}) VALUES($1,CURRENT_DATE,1) ON CONFLICT(tenant_id,day) DO UPDATE SET ${kind}=chatbot_usage.${kind}+1 WHERE chatbot_usage.${kind}<$2 RETURNING ${kind}`,[tenantId,cap]);
 if(!r.rowCount)throw new HttpFailure(429,'Company daily usage limit reached');
}
export async function usageSummary(db:SqlClient,actor:Actor){allow(actor,['OWNER','MANAGER']);const r=await db.query(`SELECT coalesce(l.daily_inbound,10000) AS daily_inbound,coalesce(l.daily_templates,500) AS daily_templates,coalesce(l.media_bytes,52428800)::text AS media_bytes,coalesce(u.inbound,0) AS inbound,coalesce(u.templates,0) AS templates,(SELECT coalesce(sum(bytes),0)::text FROM chatbot_media WHERE tenant_id=$1 AND status='ACTIVE') AS stored_bytes FROM tenants t LEFT JOIN chatbot_usage_limits l ON l.tenant_id=t.id LEFT JOIN chatbot_usage u ON u.tenant_id=t.id AND u.day=CURRENT_DATE WHERE t.id=$1`,[actor.tenantId]);return r.rows[0]}
