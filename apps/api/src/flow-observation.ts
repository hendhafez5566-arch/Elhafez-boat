/** Transaction-local metadata only. Persist after rollback without retaining exception text. */
import type {SqlClient} from './services.js';
export type FlowObservation={tenantId:string;executionId:string;conversationId:string;botId:string|null;version:number;nodeId:string;nodeType:string};
const observations=new WeakMap<SqlClient,FlowObservation>();
export function observeFlow(db:SqlClient,observation:FlowObservation){observations.set(db,observation)}
export function forgetFlow(db:SqlClient){observations.delete(db)}
export async function recordFlowFailure(db:SqlClient,error:unknown){
 const o=observations.get(db);if(!o)return;
 const raw=(error as {code?:unknown})?.code,code=typeof raw==='string'&&/^[0-9A-Z]{5}$/.test(raw)?raw:'EXECUTION_ERROR';
 await db.query("INSERT INTO audit_events(tenant_id,action,entity_type,entity_id,flow_context) SELECT $1,'FLOW_EXECUTION_FAILED','flow_execution',$2,$3::jsonb WHERE NOT EXISTS(SELECT 1 FROM audit_events WHERE tenant_id=$1 AND action='FLOW_EXECUTION_FAILED' AND entity_id=$2)",[o.tenantId,o.executionId,JSON.stringify({...o,code})]);
}
export async function persistFlowFailure(db:SqlClient,error:unknown){
 const o=observations.get(db);if(!o)return;
 try{await db.query('BEGIN');await db.query("SELECT set_config('app.tenant_id',$1,true)",[o.tenantId]);await recordFlowFailure(db,error);await db.query('COMMIT')}catch{await db.query('ROLLBACK').catch(()=>{});}finally{forgetFlow(db)}
}
