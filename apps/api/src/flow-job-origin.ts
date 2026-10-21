import {HttpFailure,isUuid,type SqlClient} from './services.js';
export type FlowJobOrigin={conversationId:string;contactId:string;version:number;nodeId:string};
/** Origin is supplied only by the internal interpreter, never inferred from old job payloads. */
export async function validateJobOrigin(db:SqlClient,t:string,origin:FlowJobOrigin){
 if(!isUuid(origin.conversationId)||!isUuid(origin.contactId)||!Number.isInteger(origin.version)||origin.version<1||typeof origin.nodeId!=='string'||!origin.nodeId.length||origin.nodeId.length>180)throw new HttpFailure(400,'Invalid flow job origin');
 const c=await db.query('SELECT 1 FROM conversations WHERE tenant_id=$1 AND id=$2 AND contact_id=$3',[t,origin.conversationId,origin.contactId]);if(!c.rowCount)throw new HttpFailure(409,'Flow job conversation/contact mismatch');
}
/** Same contact -> conversation ordering as inbound/control/privacy, before taking a job lock. */
export async function lockJobOrigin(db:SqlClient,t:string,job:Record<string,unknown>):Promise<boolean>{
 if(!job.conversation_id)return true; // Historical attribution is unknown. Never guess from a contact ID.
 await db.query('SELECT k.id FROM contacts k JOIN conversations c ON c.tenant_id=k.tenant_id AND c.contact_id=k.id WHERE c.tenant_id=$1 AND c.id=$2 FOR UPDATE OF k',[t,job.conversation_id]);
 const r=await db.query(`SELECT c.status,c.contact_id,c.bot_control,k.do_not_contact,s.version FROM conversations c JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id LEFT JOIN chatbot_flow_sessions s ON s.tenant_id=c.tenant_id AND s.conversation_id=c.id WHERE c.tenant_id=$1 AND c.id=$2 FOR UPDATE OF c`,[t,job.conversation_id]);
 const c=r.rows[0],mode=(c?.bot_control as {mode?:string}|undefined)?.mode;
 return Boolean(c&&c.status==='OPEN'&&(!mode||mode==='RUNNING')&&!c.do_not_contact&&c.contact_id===job.contact_id&&Number(c.version)===Number(job.flow_version));
}
