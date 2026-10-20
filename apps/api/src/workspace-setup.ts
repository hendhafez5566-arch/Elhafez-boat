import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {createBot} from './bots.js';
import {prepareBotTemplate} from './bot-templates.js';
export async function workspaceSummary(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER']);
 const company=await db.query(`SELECT t.name,t.slug,s.status,s.plan_code AS "planCode",s.current_period_ends_at AS "endsAt",p.title AS "planTitle",p.max_staff AS "maxStaff",
 (SELECT count(*)::int FROM memberships WHERE tenant_id=t.id) AS members,
 (SELECT count(*)::int FROM team_invitations WHERE tenant_id=t.id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()) AS "pendingInvites",
 (SELECT count(*)::int FROM chatbot_bots WHERE tenant_id=t.id AND archived_at IS NULL) AS bots,
 (SELECT count(*)::int FROM chatbot_catalog_items WHERE tenant_id=t.id) AS "catalogItems"
 FROM tenants t LEFT JOIN tenant_subscriptions s ON s.tenant_id=t.id LEFT JOIN subscription_plans p ON p.code=s.plan_code WHERE t.id=$1`,[actor.tenantId]);
 return company.rows[0];
}
export async function completeWorkspaceSetup(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER']);const payload=input as {requestId?:unknown;setup?:{businessName?:unknown}};
 if(!isUuid(payload?.requestId))throw new HttpFailure(400,'Setup request ID required');
 const prepared=prepareBotTemplate(input),business=payload.setup?.businessName;
 if(typeof business!=='string'||!business.trim()||business.length>80)throw new HttpFailure(400,'Business name required');
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const prior=await db.query('SELECT id,name,created_by FROM chatbot_bots WHERE tenant_id=$1 AND id=$2',[actor.tenantId,payload.requestId]);
 if(prior.rowCount){if(prior.rows[0].created_by!==actor.userId)throw new HttpFailure(409,'Setup request already used');return {id:prior.rows[0].id,name:prior.rows[0].name,replayed:true}}
 const bot=await createBot(db,actor,input,payload.requestId);
 await db.query('UPDATE tenants SET name=$2 WHERE id=$1',[actor.tenantId,business.trim()]);
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'WORKSPACE_SETUP','bot',$3)",[actor.tenantId,actor.userId,bot.id]);
 return {...bot,publishable:prepared.definition.nodes.length>1};
}
