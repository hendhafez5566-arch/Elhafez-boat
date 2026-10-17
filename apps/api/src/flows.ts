/** Stateless WhatsApp Flow message creation + one-time, tenant-bound reply verification. */
import { createHash, randomBytes } from 'node:crypto';
import { HttpFailure, type SqlClient } from './services.js';
import { createCustomerBooking, type BookingChoice } from './booking-choice.js';
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export async function makeBookingFlow(db:SqlClient,tenantId:string,accountId:string,conversationId:string,programId:string,flowId:string,screenId:string,choice?:Pick<BookingChoice,'departureId'|'roomPackageId'>){
 const token=randomBytes(32).toString('base64url');
 await db.query(`INSERT INTO whatsapp_flow_sessions(token_hash,tenant_id,account_id,conversation_id,program_id,departure_id,room_package_id,expires_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '30 minutes')`,[digest(token),tenantId,accountId,conversationId,programId,choice?.departureId??null,choice?.roomPackageId??null]);
 return {messaging_product:'whatsapp',type:'interactive',interactive:{type:'flow',body:{text:'سجّل بيانات طلب الحجز المبدئي من النموذج التالي. تأكيد الحجز يتم بعد مراجعة الشركة.'},action:{name:'flow',parameters:{flow_message_version:'3',flow_token:token,flow_id:flowId,flow_cta:'فتح نموذج الحجز',flow_action:'navigate',flow_action_payload:{screen:screenId}}}}};
}
export async function finishBookingFlow(db:SqlClient,tenantId:string,accountId:string,conversationId:string,responseJson:unknown,customerPhone:string):Promise<string>{
 if(typeof responseJson!=='string'||responseJson.length>10000)throw new HttpFailure(400,'Invalid Flow response');
 let raw:unknown;try{raw=JSON.parse(responseJson);}catch{throw new HttpFailure(400,'Malformed Flow response')}
 const d=record(raw),token=d.flow_token,name=typeof d.customer_name==='string'?d.customer_name.trim():'',size=typeof d.party_size==='string'?Number(d.party_size):d.party_size;
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||name.length<2||name.length>120||!Number.isSafeInteger(size)||(size as number)<1||(size as number)>100)throw new HttpFailure(400,'Invalid Flow fields');
 const found=await db.query(`SELECT program_id,departure_id,room_package_id,consumed_at FROM whatsapp_flow_sessions WHERE tenant_id=$1 AND account_id=$2 AND conversation_id=$3
 AND token_hash=$4 AND expires_at>now() AND consumed_at IS NULL FOR UPDATE`,[tenantId,accountId,conversationId,digest(token)]);
 if(found.rowCount!==1)throw new HttpFailure(409,'Form expired or already submitted');
 // Program, departure, room, current prices and capacities are verified against the
 // database inside this transaction, not read from the WhatsApp Flow response.
 const bookedId=await createCustomerBooking(db,tenantId,customerPhone,name,Number(size),{
   programId:String(found.rows[0].program_id),
   departureId:found.rows[0].departure_id ? String(found.rows[0].departure_id) : null,
   roomPackageId:found.rows[0].room_package_id ? String(found.rows[0].room_package_id) : null
 });
 await db.query(`UPDATE whatsapp_flow_sessions SET consumed_at=now() WHERE tenant_id=$1 AND token_hash=$2`,[tenantId,digest(token)]);
 return bookedId;
}