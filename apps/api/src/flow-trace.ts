import {botScope} from './bots.js';
import {HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
const zero='00000000-0000-0000-0000-000000000000';
export type TraceCursor={at:string;execution:string;step:number;id:string};
export function decodeTraceCursor(value:string|null):TraceCursor|null{
 if(value===null)return null;
 try{
  if(!value||value.length>400||!/^[a-zA-Z0-9_-]+$/.test(value))throw Error();
  const v=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
  if(!v||typeof v.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(v.at)||!Number.isFinite(Date.parse(v.at))||new Date(v.at).toISOString().slice(0,19)!==v.at.slice(0,19)||!(v.execution===zero||isUuid(v.execution))||!isUuid(v.id)||!Number.isInteger(v.step)||v.step< -1||v.step>10000)throw Error();
  return {at:v.at,execution:v.execution,step:v.step,id:v.id};
 }catch{throw new HttpFailure(400,'Invalid trace cursor')}
}
export function encodeTraceCursor(row:Record<string,unknown>){return Buffer.from(JSON.stringify({at:row.recordedAt,execution:row.executionId||zero,step:row.stepIndex??-1,id:row.id})).toString('base64url')}
/** Read-only diagnostics. Never select answers, names, message bodies or provider secrets. */
export async function flowTraceSessions(db:SqlClient,actor:Actor,botId:string){
 const scope=await botScope(db,actor,botId);
 const r=await db.query(`SELECT s.conversation_id AS "conversationId",s.version,s.node_id AS "nodeId",s.updated_at AS "updatedAt",c.status
 FROM chatbot_flow_sessions s JOIN conversations c ON c.tenant_id=s.tenant_id AND c.id=s.conversation_id
 WHERE s.tenant_id=$1 AND (s.bot_id=$2 OR ($3::boolean AND s.bot_id IS NULL))
 ORDER BY s.updated_at DESC,s.conversation_id DESC LIMIT 21`,[actor.tenantId,botId,scope===undefined]);
 return {scope:'actual_saved_sessions',limit:20,truncated:r.rows.length>20,rows:r.rows.slice(0,20)};
}
export async function flowConversationTrace(db:SqlClient,actor:Actor,botId:string,conversationId:string,params:URLSearchParams){
 const scope=await botScope(db,actor,botId);if(!isUuid(conversationId))throw new HttpFailure(400,'Invalid conversation');
 const limit=Number(params.get('limit')||200);if(!Number.isInteger(limit)||limit<1||limit>500)throw new HttpFailure(400,'Trace page limit must be 1–500');
 const cursor=decodeTraceCursor(params.get('before'));
 const session=await db.query(`SELECT s.version,s.node_id AS "nodeId",s.updated_at AS "updatedAt",c.status,
 s.runtime_state->'wait'->>'expiresAt' AS "waitUntil",j.status AS "jobStatus",j.node_id AS "jobNodeId",j.version AS "jobVersion",j.due_at AS "jobDueAt"
 FROM chatbot_flow_sessions s JOIN conversations c ON c.tenant_id=s.tenant_id AND c.id=s.conversation_id
 LEFT JOIN chatbot_delay_jobs j ON j.tenant_id=s.tenant_id AND j.conversation_id=s.conversation_id
 WHERE s.tenant_id=$1 AND s.conversation_id=$2 AND (s.bot_id=$3 OR ($4::boolean AND s.bot_id IS NULL))`,[actor.tenantId,conversationId,botId,scope===undefined]);
 if(!session.rowCount)throw new HttpFailure(404,'Conversation flow session not found');
 const r=await db.query(`SELECT id,node_id AS "nodeId",node_type AS "nodeType",version,outcome,elapsed_ms::float AS "elapsedMs",execution_id AS "executionId",step_index AS "stepIndex",
 to_char(coalesce(recorded_at,created_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "recordedAt",(execution_id IS NOT NULL) AS ordered
 FROM chatbot_flow_step_events WHERE tenant_id=$1 AND conversation_id=$2 AND (bot_id=$3 OR ($4::boolean AND bot_id IS NULL))
 AND ($5::timestamptz IS NULL OR (coalesce(recorded_at,created_at),coalesce(execution_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(step_index,-1),id)<($5::timestamptz,$6::uuid,$7::integer,$8::uuid))
 ORDER BY coalesce(recorded_at,created_at) DESC,coalesce(execution_id,'00000000-0000-0000-0000-000000000000'::uuid) DESC,coalesce(step_index,-1) DESC,id DESC LIMIT $9`,[actor.tenantId,conversationId,botId,scope===undefined,cursor?.at??null,cursor?.execution??null,cursor?.step??null,cursor?.id??null,limit+1]);
 const page=r.rows.slice(0,limit),next=r.rows.length>limit?encodeTraceCursor(page[page.length-1]):null;
 const snapshot={...session.rows[0],waitUntil:session.rows[0].waitUntil===null?null:Number(session.rows[0].waitUntil)};
 return {conversationId,scope:'committed_transition_events',snapshot,events:page.reverse(),nextCursor:next,description:'Ordered steps within each committed execution. Historical events without metadata have no guaranteed order. Answers and message bodies are excluded. Failed transactions may have no event.'};
}
