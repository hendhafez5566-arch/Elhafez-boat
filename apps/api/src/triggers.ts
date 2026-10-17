import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {normalizeQuestion} from './knowledge.js';
export async function listTriggers(db:SqlClient,actor:Actor){allow(actor,['OWNER','MANAGER']);return (await db.query('SELECT * FROM chatbot_triggers WHERE tenant_id=$1 ORDER BY priority DESC,id LIMIT 100',[actor.tenantId])).rows}
export async function createTrigger(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);const d=input as {kind?:unknown;phrase?:unknown;matchMode?:unknown;targetNode?:unknown;priority?:unknown};
 if(!d||!['KEYWORD','FIRST_MESSAGE'].includes(String(d.kind))||typeof d.targetNode!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(d.targetNode)||typeof d.phrase!=='string'||d.phrase.length>80||(d.kind==='KEYWORD'&&!normalizeQuestion(d.phrase))||!['EXACT','CONTAINS'].includes(String(d.matchMode)))throw new HttpFailure(400,'Invalid trigger');
 const priority=Number(d.priority??0);if(!Number.isInteger(priority)||Math.abs(priority)>100)throw new HttpFailure(400,'Invalid priority');
 const published=await db.query('SELECT definition FROM chatbot_flow_versions WHERE tenant_id=$1 ORDER BY version DESC LIMIT 1',[actor.tenantId]);
 const def=published.rows[0]?.definition as {nodes?:{id:string}[]}|undefined;if(!def?.nodes?.some(n=>n.id===d.targetNode))throw new HttpFailure(409,'Publish the target node before creating its trigger');
 return (await db.query('INSERT INTO chatbot_triggers(tenant_id,kind,phrase,match_mode,target_node,priority) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[actor.tenantId,d.kind,d.phrase,d.matchMode,d.targetNode,priority])).rows[0];
}
export async function deleteTrigger(db:SqlClient,actor:Actor,id:string){allow(actor,['OWNER','MANAGER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid trigger');await db.query('DELETE FROM chatbot_triggers WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id]);return {deleted:true}}
export async function matchTrigger(db:SqlClient,tenantId:string,body:string,first:boolean){
 const rows=await db.query('SELECT kind,phrase,match_mode,target_node FROM chatbot_triggers WHERE tenant_id=$1 AND enabled=true ORDER BY priority DESC,id LIMIT 100',[tenantId]);const q=normalizeQuestion(body);
 return rows.rows.find(t=>t.kind==='FIRST_MESSAGE'?first:t.match_mode==='EXACT'?q===normalizeQuestion(String(t.phrase)):q.includes(normalizeQuestion(String(t.phrase))))?.target_node as string|undefined;
}
