import {persistFlowFailure,forgetFlow} from './flow-observation.js';
import type {SqlClient,SqlPool} from './services.js';
export async function publicTenant<T>(pool:SqlPool,tenantId:string,task:(db:SqlClient)=>Promise<T>){
 const db=await pool.connect();try{await db.query('BEGIN');await db.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);const result=await task(db);await db.query('COMMIT');forgetFlow(db);return result}catch(e){await db.query('ROLLBACK').catch(()=>{});await persistFlowFailure(db,e);throw e}finally{db.release()}
}
