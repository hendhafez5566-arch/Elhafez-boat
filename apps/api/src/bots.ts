import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {getFlowConfig,saveFlowDraft,publishFlowDraft,listFlowVersions,rollbackFlow} from './flow-service.js';
import {botTemplate,botTemplates} from './bot-templates.js';

/** Resolve ownership before accessing a bot; legacy defaults retain their original storage. */
export async function botScope(db:SqlClient,actor:Actor,id:string,write=false,allowArchived=false):Promise<string|undefined>{
 allow(actor,write?['OWNER','MANAGER']:['OWNER','MANAGER','AGENT','VIEWER']);
 if(!isUuid(id))throw new HttpFailure(400,'Invalid bot');
 if(write)await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const found=await db.query(`SELECT legacy_default,archived_at FROM chatbot_bots WHERE tenant_id=$1 AND id=$2${write?' FOR UPDATE':''}`,[actor.tenantId,id]);
 if(!found.rowCount)throw new HttpFailure(404,'Bot not found');
 if(write&&!allowArchived&&found.rows[0].archived_at)throw new HttpFailure(409,'Archived bot is read only');
 return found.rows[0].legacy_default?undefined:id;
}
export async function listBots(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 return (await db.query(`SELECT b.id,b.name,b.created_by AS "createdBy",b.legacy_default AS "legacyDefault",b.archived_at AS "archivedAt",b.updated_at AS "updatedAt",
 coalesce((SELECT jsonb_agg(jsonb_build_object('channel',r.channel,'accountId',r.account_id)) FROM chatbot_bot_routes r WHERE r.tenant_id=b.tenant_id AND r.bot_id=b.id),'[]'::jsonb) AS routes,
 CASE WHEN b.legacy_default THEN (SELECT max(version) FROM chatbot_flow_versions WHERE tenant_id=b.tenant_id)
 ELSE (SELECT max(version) FROM chatbot_bot_versions WHERE tenant_id=b.tenant_id AND bot_id=b.id) END AS "publishedVersion"
 FROM chatbot_bots b WHERE b.tenant_id=$1 ORDER BY b.created_at,b.id`,[actor.tenantId])).rows;
}
export async function createBot(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);
 const name=botName(input);
 const r=await db.query('INSERT INTO chatbot_bots(tenant_id,name,created_by) VALUES($1,$2,$3) RETURNING id,name',[actor.tenantId,name,actor.userId]);
 const bot=r.rows[0];
 // A new bot starts with one Start node; nothing is published or connected implicitly.
 const templateId=(input as {templateId?:unknown}).templateId??'blank';
 if(!botTemplates.some(t=>t.id===templateId))throw new HttpFailure(400,'Unknown bot template');
 const definition=botTemplate(String(templateId),name.length<2?'بوت '+name:name);
 await db.query('INSERT INTO chatbot_bot_drafts(tenant_id,bot_id,definition,draft_revision,updated_by) VALUES($1,$2,$3::jsonb,1,$4)',[actor.tenantId,bot.id,JSON.stringify(definition),actor.userId]);
 return bot;
}
function botName(input:unknown){const name=(input as {name?:unknown})?.name;if(typeof name!=='string'||!name.trim()||name.trim().length>100)throw new HttpFailure(400,'Bot name must contain 1–100 characters');return name.trim()}
export async function updateBot(db:SqlClient,actor:Actor,id:string,input:unknown){
 const d=input as {name?:unknown;archive?:unknown};
 await botScope(db,actor,id,true,d?.archive===false);
 if(d?.archive===false){await db.query('UPDATE chatbot_bots SET archived_at=NULL,updated_at=now() WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id]);return {restored:true};}
 if(d?.archive===true){
 const routes=await db.query('SELECT 1 FROM chatbot_bot_routes WHERE tenant_id=$1 AND bot_id=$2',[actor.tenantId,id]);if(routes.rowCount)throw new HttpFailure(409,'Remove channel routes before archiving');
 const r=await db.query('UPDATE chatbot_bots SET archived_at=now(),updated_at=now() WHERE tenant_id=$1 AND id=$2 AND legacy_default=false RETURNING id',[actor.tenantId,id]);
 if(!r.rowCount)throw new HttpFailure(409,'The legacy bot cannot be archived while old channels use it');
 }else await db.query('UPDATE chatbot_bots SET name=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id,botName(input)]);
 return {updated:true};
}
export async function botFlow(db:SqlClient,actor:Actor,id:string,operation:string,input?:unknown){
 const scope=await botScope(db,actor,id,!['get','versions'].includes(operation));
 if(operation==='get')return getFlowConfig(db,actor,scope);
 if(operation==='draft'){const saved=await saveFlowDraft(db,actor,input,false,scope);await db.query('UPDATE chatbot_bots SET updated_at=now() WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id]);return saved;}
 if(operation==='publish')return publishFlowDraft(db,actor,scope);
 if(operation==='versions')return listFlowVersions(db,actor,scope);
 if(operation.startsWith('rollback:'))return rollbackFlow(db,actor,operation.slice(9),scope);
 throw new HttpFailure(404,'Unknown bot operation');
}

/** Metrics describe saved runtime sessions, not unique people or provider delivery. */
export async function botInsights(db:SqlClient,actor:Actor,id:string){
 const scope=await botScope(db,actor,id);
 const r=await db.query(`SELECT count(*)::int AS sessions,
 count(*) FILTER(WHERE c.status='HUMAN')::int AS "humanSessions",
 count(*) FILTER(WHERE s.answers<>'{}'::jsonb)::int AS "capturedSessions",
 max(s.updated_at) AS "lastActivityAt"
 FROM chatbot_flow_sessions s JOIN conversations c ON c.tenant_id=s.tenant_id AND c.id=s.conversation_id
 WHERE s.tenant_id=$1 AND ${scope?'s.bot_id=$2':'(s.bot_id=$2 OR s.bot_id IS NULL)'}`,[actor.tenantId,id]);
 const fields=await db.query(`SELECT field,count(*)::int AS sessions FROM chatbot_flow_sessions s,
 LATERAL jsonb_object_keys(s.answers) AS field
 WHERE s.tenant_id=$1 AND ${scope?'s.bot_id=$2':'(s.bot_id=$2 OR s.bot_id IS NULL)'} GROUP BY field ORDER BY count(*) DESC,field LIMIT 50`,[actor.tenantId,id]);
 return {...r.rows[0],fields:fields.rows,scope:'saved_sessions'};
}
