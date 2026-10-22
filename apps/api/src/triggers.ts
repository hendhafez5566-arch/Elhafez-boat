import {triggerConflicts,triggerEvents,triggerMatches,type TriggerContext} from './flow-triggers.js';
import type {DraftTrigger} from './flow-engine.js';
import {flowStorage} from './flow-storage.js';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {normalizeQuestion} from './knowledge.js';
export async function listTriggers(db:SqlClient,actor:Actor,botId?:string){allow(actor,['OWNER','MANAGER']);return (await db.query(`SELECT * FROM ${botId?'chatbot_bot_triggers':'chatbot_triggers'} WHERE tenant_id=$1${botId?' AND bot_id=$2':''} ORDER BY priority DESC,id LIMIT 100`,botId?[actor.tenantId,botId]:[actor.tenantId])).rows}
export async function createTrigger(db:SqlClient,actor:Actor,input:unknown,botId?:string){
 allow(actor,['OWNER','MANAGER']);const d=input as {kind?:unknown;phrase?:unknown;matchMode?:unknown;targetNode?:unknown;priority?:unknown;channel?:unknown};
 if(!d||!['KEYWORD','FIRST_MESSAGE','EVENT'].includes(String(d.kind))||typeof d.targetNode!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(d.targetNode)||typeof d.phrase!=='string'||d.phrase.length>80||(d.kind==='KEYWORD'&&!normalizeQuestion(d.phrase))||!['EXACT','CONTAINS'].includes(String(d.matchMode)))throw new HttpFailure(400,'Invalid trigger');
 const priority=Number(d.priority??0);if(!Number.isInteger(priority)||Math.abs(priority)>100)throw new HttpFailure(400,'Invalid priority');
 if(d.channel!==undefined&&!['WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM'].includes(String(d.channel))||d.kind==='EVENT'&&!triggerEvents.includes(d.phrase as typeof triggerEvents[number]))throw new HttpFailure(400,'Invalid channel event');
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const published=await flowStorage(db,actor,botId).published();
 const def=published.rows[0]?.definition as {nodes?:{id:string}[]}|undefined;if(!def?.nodes?.some(n=>n.id===d.targetNode))throw new HttpFailure(409,'Publish the target node before creating its trigger');
 const incoming={...d,priority,enabled:true} as DraftTrigger,existing=await listTriggers(db,actor,botId);if(triggerConflicts([...existing.map(r=>({kind:r.kind,phrase:r.phrase,matchMode:r.match_mode,targetNode:r.target_node,priority:r.priority,enabled:r.enabled,...(r.channel?{channel:r.channel}:{})}) as DraftTrigger),incoming]).length)throw new HttpFailure(409,'Overlapping triggers need distinct priorities');
 return (await db.query(`INSERT INTO ${botId?'chatbot_bot_triggers':'chatbot_triggers'}(tenant_id,kind,phrase,match_mode,target_node,priority,channel${botId?',bot_id':''}) VALUES($1,$2,$3,$4,$5,$6,$7${botId?',$8':''}) RETURNING *`,[actor.tenantId,d.kind,d.phrase,d.matchMode,d.targetNode,priority,d.channel??null,...(botId?[botId]:[])])).rows[0];
}
export async function deleteTrigger(db:SqlClient,actor:Actor,id:string,botId?:string){allow(actor,['OWNER','MANAGER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid trigger');await db.query(`DELETE FROM ${botId?'chatbot_bot_triggers':'chatbot_triggers'} WHERE tenant_id=$1 AND id=$2${botId?' AND bot_id=$3':''}`,[actor.tenantId,id,...(botId?[botId]:[])]);return {deleted:true}}
export async function matchTrigger(db:SqlClient,tenantId:string,body:string,first:boolean,botId?:string,context:TriggerContext={}){
 const rows=await db.query(`SELECT kind,phrase,match_mode,target_node,channel,priority FROM ${botId?'chatbot_bot_triggers':'chatbot_triggers'} WHERE tenant_id=$1${botId?' AND bot_id=$2':''} AND enabled=true ORDER BY priority DESC,id LIMIT 100`,botId?[tenantId,botId]:[tenantId]);return rows.rows.find(t=>triggerMatches({kind:t.kind,phrase:String(t.phrase),matchMode:t.match_mode,targetNode:String(t.target_node),priority:Number(t.priority),enabled:true,...(t.channel?{channel:t.channel}:{})} as DraftTrigger,body,first,context))?.target_node as string|undefined;
}
