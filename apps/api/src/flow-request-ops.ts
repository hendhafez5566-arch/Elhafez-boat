/** Value-free operations on existing flow requests. Reconciliation never dispatches or resumes a flow. */
import {botScope} from './bots.js';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
const errorCodes=new Set(['FLOW_NOT_OWNED_OR_WINDOW_CLOSED','DISPATCH_INTERRUPTED_NO_RESEND','FLOW_DEADLINE','INTEGRATION_DISABLED','SAFE_GET_RETRY','CONTINUATION_FAILED_NO_HTTP_RESEND','TYPED_RESPONSE_INVALID',...['TIMEOUT','DNS_REJECTED','REQUEST_SIZE','QUERY_SIZE','RESPONSE_SIZE','RESPONSE_JSON','HTTP','TRANSPORT','MAPPING','MAPPING_OR_TRANSPORT'].map(code=>'REQUEST_'+code)]);
const statuses=['PENDING','PROCESSING','SENT','FAILED','UNCERTAIN','CANCELLED'];
export async function flowRequestJobs(db:SqlClient,actor:Actor,botId:string,input:{status?:string;before?:string}={}){
 allow(actor,['OWNER','MANAGER']);const legacy=(await botScope(db,actor,botId))===undefined;
 const status=input.status||'ALL';if(status!=='ALL'&&!statuses.includes(status)||input.before!==undefined&&!isUuid(input.before))throw new HttpFailure(400,'Invalid request job filter');
 let cursor:Record<string,unknown>|undefined;
 if(input.before){cursor=(await db.query(`SELECT j.created_at,j.id FROM chatbot_integration_jobs j JOIN chatbot_flow_sessions s ON s.tenant_id=j.tenant_id AND s.conversation_id=j.conversation_id WHERE j.tenant_id=$1 AND j.id=$2 AND j.flow_request IS NOT NULL AND (s.bot_id=$3 OR ($4::boolean AND s.bot_id IS NULL))`,[actor.tenantId,input.before,botId,legacy])).rows[0];if(!cursor)throw new HttpFailure(400,'Invalid request job cursor')}
 const result=await db.query(`SELECT j.id,j.conversation_id AS "conversationId",j.flow_version AS version,j.flow_node_id AS "nodeId",j.flow_request->>'method' AS method,j.status,j.attempts,j.result_outcome AS outcome,j.response_status AS "responseStatus",j.completion_pending AS "completionPending",j.continuation_attempts AS "continuationAttempts",j.created_at AS "createdAt",j.deadline_at AS "deadlineAt",j.last_error AS "errorCode",j.reconciliation_decision AS decision,j.reconciled_at AS "reconciledAt"
 FROM chatbot_integration_jobs j JOIN chatbot_flow_sessions s ON s.tenant_id=j.tenant_id AND s.conversation_id=j.conversation_id
 WHERE j.tenant_id=$1 AND j.flow_request IS NOT NULL AND (s.bot_id=$2 OR ($3::boolean AND s.bot_id IS NULL)) AND ($4='ALL' OR j.status=$4)
 AND ($5::uuid IS NULL OR (j.created_at,j.id)<(SELECT mark.created_at,mark.id FROM chatbot_integration_jobs mark WHERE mark.tenant_id=$1 AND mark.id=$5)) ORDER BY j.created_at DESC,j.id DESC LIMIT 21`,[actor.tenantId,botId,legacy,status,input.before??null]);
 const rows=result.rows.slice(0,20).map(row=>({...row,errorCode:typeof row.errorCode==='string'&&errorCodes.has(row.errorCode)?row.errorCode:row.errorCode?'REQUEST_FAILED':null,canReconcile:row.status==='UNCERTAIN'&&!row.completionPending&&!row.decision}));
 return {rows,nextCursor:result.rows.length>20?result.rows[19].id:null,scope:'flow_request_metadata_only'};
}
export async function reconcileFlowRequest(db:SqlClient,actor:Actor,botId:string,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER']);const legacy=(await botScope(db,actor,botId))===undefined;
 const d=input as {decision?:unknown;acknowledged?:unknown;expectedAttempts?:unknown};
 if(!isUuid(id)||!d||typeof d.decision!=='string'||!['DELIVERED','NOT_DELIVERED'].includes(d.decision)||d.acknowledged!==true||!Number.isInteger(d.expectedAttempts)||Number(d.expectedAttempts)<1)throw new HttpFailure(400,'Explicit verified request outcome required');
 // No contact/conversation mutation or network call: a queue row lock alone serializes operators/privacy.
 const job=(await db.query(`SELECT j.id,j.status,j.attempts,j.completion_pending,j.reconciliation_decision FROM chatbot_integration_jobs j JOIN chatbot_flow_sessions s ON s.tenant_id=j.tenant_id AND s.conversation_id=j.conversation_id WHERE j.tenant_id=$1 AND j.id=$2 AND j.flow_request IS NOT NULL AND (s.bot_id=$3 OR ($4::boolean AND s.bot_id IS NULL)) FOR UPDATE OF j`,[actor.tenantId,id,botId,legacy])).rows[0];
 if(!job)throw new HttpFailure(404,'Flow request job not found');
 if(Number(job.attempts)!==d.expectedAttempts)throw new HttpFailure(409,'Request attempt changed; refresh before reconciliation');
 if(job.reconciliation_decision){if(job.reconciliation_decision!==d.decision)throw new HttpFailure(409,'Request already reconciled with a different outcome');return {id,status:job.status,decision:d.decision,replayed:true,queued:0,resumed:false}}
 if(job.status!=='UNCERTAIN'||job.completion_pending)throw new HttpFailure(409,'Request is not ready for reconciliation');
 const status=d.decision==='DELIVERED'?'SENT':'FAILED';
 await db.query('UPDATE chatbot_integration_jobs SET status=$3,reconciliation_decision=$4,reconciled_by=$5,reconciled_at=now() WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id,status,d.decision,actor.userId]);
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'integration_job',$4)",[actor.tenantId,actor.userId,'FLOW_REQUEST_RECONCILED_'+d.decision,id]);
 return {id,status,decision:d.decision,replayed:false,queued:0,resumed:false};
}
