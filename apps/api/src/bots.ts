import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {getFlowConfig,saveFlowDraft,publishFlowDraft,listFlowVersions,rollbackFlow} from './flow-service.js';
import {exampleFlow} from './flow-engine.js';

/** Reuse the complete existing validation/publish pipeline with a bot-bound SQL view.
 * The identifier and table names are server controlled; values remain parameters.
 * Legacy defaults deliberately use their original tables to preserve old adapters.
 */
export async function botDatabase(db:SqlClient,actor:Actor,id:string,write=false):Promise<SqlClient>{
 allow(actor,write?['OWNER','MANAGER']:['OWNER','MANAGER','AGENT','VIEWER']);
 if(!isUuid(id))throw new HttpFailure(400,'Invalid bot');
 const found=await db.query('SELECT legacy_default,archived_at FROM chatbot_bots WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[actor.tenantId,id]);
 if(!found.rowCount)throw new HttpFailure(404,'Bot not found');
 if(write&&found.rows[0].archived_at)throw new HttpFailure(409,'Archived bot is read only');
 if(found.rows[0].legacy_default)return db;
 return {async query(sql,params=[]){
  if(!/chatbot_flow_(drafts|versions)|chatbot_triggers/.test(sql))return db.query(sql,params);
  // Tenant-level triggers belong exclusively to the legacy adapter until explicitly migrated.
  if(sql.includes('chatbot_triggers'))return {rows:[],rowCount:0};
  const bind='$'+(params.length+1);
  sql=sql.replaceAll('chatbot_flow_drafts','chatbot_bot_drafts').replaceAll('chatbot_flow_versions','chatbot_bot_versions');
  sql=sql.replaceAll('WHERE tenant_id=$1','WHERE tenant_id=$1 AND bot_id='+bind);
  sql=sql.replace('ON CONFLICT(tenant_id)','ON CONFLICT(tenant_id,bot_id)');
  if(sql.includes('INSERT INTO chatbot_bot_drafts'))sql=sql.replace('(tenant_id,definition,updated_by)','(tenant_id,definition,updated_by,bot_id)').replace('VALUES($1,$2::jsonb,$3)',`VALUES($1,$2::jsonb,$3,${bind})`);
  if(sql.includes('INSERT INTO chatbot_bot_versions'))sql=sql.replace('published_by,source_definition)','published_by,source_definition,bot_id)').replace('$4,$5::jsonb FROM',`$4,$5::jsonb,${bind} FROM`);
  return db.query(sql,[...params,id]);
 }};
}
export async function listBots(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 return (await db.query(`SELECT b.id,b.name,b.legacy_default AS "legacyDefault",b.archived_at AS "archivedAt",b.updated_at AS "updatedAt",
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
 const definition={...exampleFlow(),name,startId:'start',nodes:[{id:'start',type:'START',next:null}]};
 await db.query('INSERT INTO chatbot_bot_drafts(tenant_id,bot_id,definition,draft_revision,updated_by) VALUES($1,$2,$3::jsonb,1,$4)',[actor.tenantId,bot.id,JSON.stringify(definition),actor.userId]);
 return bot;
}
function botName(input:unknown){const name=(input as {name?:unknown})?.name;if(typeof name!=='string'||!name.trim()||name.trim().length>100)throw new HttpFailure(400,'Bot name must contain 1–100 characters');return name.trim()}
export async function updateBot(db:SqlClient,actor:Actor,id:string,input:unknown){
 await botDatabase(db,actor,id,true);
 const d=input as {name?:unknown;archive?:unknown};
 if(d?.archive===true){
 const r=await db.query('UPDATE chatbot_bots SET archived_at=now(),updated_at=now() WHERE tenant_id=$1 AND id=$2 AND legacy_default=false RETURNING id',[actor.tenantId,id]);
 if(!r.rowCount)throw new HttpFailure(409,'The legacy bot cannot be archived while old channels use it');
 }else await db.query('UPDATE chatbot_bots SET name=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id,botName(input)]);
 return {updated:true};
}
export async function botFlow(db:SqlClient,actor:Actor,id:string,operation:string,input?:unknown){
 const scoped=await botDatabase(db,actor,id,!['get','versions'].includes(operation));
 if(operation==='get')return getFlowConfig(scoped,actor);
 if(operation==='draft')return saveFlowDraft(scoped,actor,input);
 if(operation==='publish')return publishFlowDraft(scoped,actor);
 if(operation==='versions')return listFlowVersions(scoped,actor);
 if(operation.startsWith('rollback:'))return rollbackFlow(scoped,actor,operation.slice(9));
 throw new HttpFailure(404,'Unknown bot operation');
}
