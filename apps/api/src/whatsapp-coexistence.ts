/** Official webhook field adapter. Historical/app outbound events NEVER execute the bot. */
import {createHash} from 'node:crypto';
import type {SqlClient} from './services.js';
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
const arr=(v:unknown):any[]=>Array.isArray(v)?v:[];
const phone=(v:unknown):v is string=>typeof v==='string'&&/^\d{8,15}$/.test(v);
const text=(v:unknown,max=4000)=>typeof v==='string'?v.slice(0,max):'';
export function eventTime(value:unknown):Date|null{
 const n=Number(value);if(!Number.isFinite(n)||n<=0||n*1000>Date.now()+300000)return null;
 const d=new Date(n*1000);return Number.isFinite(d.getTime())?d:null;
}
export function normalizeAppMessage(message:unknown,businessPhone:string,history=false,threadId?:string){
 const m=obj(message),at=eventTime(m.timestamp),id=text(m.id,256);
 if(!id||!at)return null;
 const outgoing=m.from===businessPhone||(!history&&phone(m.to));
 const recipient=outgoing?m.to:phone(m.from)?m.from:threadId;
 if(!phone(recipient))return null;
 const body=m.type==='text'?text(obj(m.text).body):'[رسالة '+text(m.type,30)+' من تطبيق واتساب بيزنس]';
 return {id,at,phone:recipient,kind:outgoing?'OUTBOUND':'INBOUND',body,source:history?'HISTORY':'BUSINESS_APP'};
}
async function record(db:SqlClient,tenantId:string,accountId:string,key:string,field:string){
 const r=await db.query(`INSERT INTO whatsapp_sync_receipts(tenant_id,account_id,event_key,field) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING event_key`,[tenantId,accountId,key,field]);return r.rowCount===1;
}
async function importMessage(db:SqlClient,tenantId:string,accountId:string,m:NonNullable<ReturnType<typeof normalizeAppMessage>>,history:boolean){
 if(!await record(db,tenantId,accountId,(history?'history:':'echo:')+m.id,'APP_MESSAGE'))return;
 await db.query(`INSERT INTO whatsapp_receipts(tenant_id,account_id,message_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[tenantId,accountId,m.id]);
 const contact=(await db.query(`INSERT INTO contacts(tenant_id,phone,full_name,source) VALUES($1,$2,'عميل واتساب','WHATSAPP') ON CONFLICT(tenant_id,phone) DO UPDATE SET updated_at=contacts.updated_at RETURNING id`,[tenantId,m.phone])).rows[0];
 const conversation=(await db.query(`INSERT INTO conversations(tenant_id,contact_id,channel,whatsapp_account_id,status,last_message_at) VALUES($1,$2,'WHATSAPP',$3,$5,$4)
 ON CONFLICT(tenant_id,contact_id,channel) WHERE channel='WHATSAPP' DO UPDATE SET last_message_at=greatest(conversations.last_message_at,EXCLUDED.last_message_at),status=CASE WHEN $6 OR conversations.last_message_at>EXCLUDED.last_message_at THEN conversations.status ELSE 'HUMAN' END
 WHERE conversations.whatsapp_account_id=EXCLUDED.whatsapp_account_id RETURNING id`,[tenantId,contact.id,accountId,m.at,history?'CLOSED':'HUMAN',history])).rows[0];
 if(!conversation)return; // Never merge another connected number's thread.
 await db.query(`INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body,whatsapp_message_id,message_source,provider_at,imported_history,created_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$7) ON CONFLICT DO NOTHING`,[tenantId,conversation.id,m.kind,m.body,m.id,m.source,m.at,history]);
 if(!history){
  await db.query(`UPDATE conversation_messages SET message_source='BUSINESS_APP',imported_history=false WHERE tenant_id=$1 AND whatsapp_message_id=$2 AND imported_history=true`,[tenantId,m.id]);
  await db.query(`UPDATE chatbot_delay_jobs SET status='CANCELLED' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING'`,[tenantId,conversation.id]);
  await db.query(`UPDATE whatsapp_accounts SET last_echo_at=greatest(last_echo_at,$3::timestamptz) WHERE tenant_id=$1 AND id=$2`,[tenantId,accountId,m.at]);
  // A phone-app reply means a human is active: suppress still-pending bot replies.
  await db.query(`UPDATE whatsapp_outbox SET status='FAILED',last_error='Business app human reply superseded pending response' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING' AND created_at<=$3`,[tenantId,conversation.id,m.at]);
 }
}
export async function coexistenceEvent(db:SqlClient,tenantId:string,accountId:string,field:string,value:unknown){
 const v=obj(value),account=(await db.query(`SELECT connection_mode,history_consent,contacts_consent,display_phone FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2`,[tenantId,accountId])).rows[0];
 if(account?.connection_mode!=='COEXISTENCE')return;
 const own=String(account.display_phone||obj(v.metadata).display_phone_number||'').replace(/\D/g,'');
 if(field==='smb_message_echoes'){
  for(const raw of arr(v.message_echoes).slice(0,100)){const m=normalizeAppMessage(raw,own);if(m)await importMessage(db,tenantId,accountId,m,false)}
 }else if(field==='history'&&account.history_consent===true){
  for(const chunk of arr(v.history).slice(0,100)){
   if(arr(chunk.errors).length){await db.query("UPDATE whatsapp_accounts SET sync_status='HISTORY_UNAVAILABLE' WHERE tenant_id=$1 AND id=$2",[tenantId,accountId]);continue}
   for(const thread of arr(chunk.threads).slice(0,100))for(const raw of arr(thread.messages).slice(0,200)){const m=normalizeAppMessage(raw,own,true,thread.id);if(m)await importMessage(db,tenantId,accountId,m,true)}
   // Do not mark sync complete solely from an out-of-order partial chunk.
   await db.query("UPDATE whatsapp_accounts SET sync_status=CASE WHEN sync_status='HISTORY_COMPLETE' THEN sync_status ELSE $3 END WHERE tenant_id=$1 AND id=$2",[tenantId,accountId,Number(obj(chunk.metadata).progress)===100?'HISTORY_COMPLETE':'HISTORY_RECEIVING']);
  }
 }else if(field==='smb_app_state_sync'&&account.contacts_consent===true){
  for(const raw of arr(v.state_sync).slice(0,200)){
   const c=obj(raw.contact),at=eventTime(obj(raw.metadata).timestamp);if(raw.type!=='contact'||!phone(c.phone_number)||!at||!['add','remove'].includes(raw.action))continue;
   const key=createHash('sha256').update(JSON.stringify([raw.type,c.phone_number,raw.action,at.toISOString(),c.full_name,c.first_name])).digest('hex');if(!await record(db,tenantId,accountId,key,field))continue;
   // Deletion in the phone address book is NOT authorization to erase CRM history.
   if(raw.action==='remove')continue;
   await db.query(`INSERT INTO contacts(tenant_id,phone,full_name,source,updated_at) VALUES($1,$2,$3,'WHATSAPP',$4)
    ON CONFLICT(tenant_id,phone) DO UPDATE SET full_name=EXCLUDED.full_name,updated_at=EXCLUDED.updated_at WHERE contacts.updated_at<EXCLUDED.updated_at`,[tenantId,c.phone_number,text(c.full_name||c.first_name,120)||'عميل واتساب',at]);
  }
 }
}
