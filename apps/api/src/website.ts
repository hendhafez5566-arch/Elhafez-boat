import {recordFlowConsent} from './flow-consent.js';
import {randomBytes} from 'node:crypto';
import {tokenDigest} from './auth.js';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient,type SqlPool} from './services.js';
import {publicTenant} from './public-tenant.js';
import {consumeUsage,requireActiveTenant} from './usage.js';
import {respondToFlow} from './flow-service.js';
import {deliverConversation} from './channels.js';
function validOrigin(value:string){try{const u=new URL(value);return u.origin===value&&(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))}catch{return false}}
export async function widgetSettings(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER']);const existing=await db.query('SELECT widget_key AS "widgetKey",enabled,title,origins FROM chatbot_widget_settings WHERE tenant_id=$1',[actor.tenantId]);if(existing.rowCount)return existing.rows[0];
 const key=randomBytes(24).toString('base64url');
 const r=await db.query(`INSERT INTO chatbot_widget_settings(tenant_id,widget_key) VALUES($1,$2) ON CONFLICT(tenant_id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id RETURNING widget_key AS "widgetKey",enabled,title,origins`,[actor.tenantId,key]);
 await db.query('INSERT INTO chatbot_widget_routes(widget_key,tenant_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[r.rows[0].widgetKey,actor.tenantId]);return r.rows[0];
}
export async function saveWidgetSettings(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);const d=input as {enabled?:unknown;title?:unknown;origins?:unknown};if(!d||typeof d.enabled!=='boolean'||typeof d.title!=='string'||d.title.trim().length<2||d.title.length>80||!Array.isArray(d.origins)||d.origins.length>20||d.origins.some(o=>typeof o!=='string'||!validOrigin(o))||(d.enabled&&!d.origins.length))throw new HttpFailure(400,'Provide a title and exact allowed website origins');
 await widgetSettings(db,actor);await db.query('UPDATE chatbot_widget_settings SET enabled=$2,title=$3,origins=$4::jsonb WHERE tenant_id=$1',[actor.tenantId,d.enabled,d.title.trim(),JSON.stringify([...new Set(d.origins)])]);return widgetSettings(db,actor);
}
export async function startWebsiteSession(pool:SqlClient&SqlPool,input:unknown,origin:string){
 const d=input as {widgetKey?:unknown;name?:unknown};if(!d||typeof d.widgetKey!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(d.widgetKey)||!validOrigin(origin))throw new HttpFailure(403,'Widget origin or key rejected');
 const route=await pool.query('SELECT tenant_id FROM chatbot_widget_routes WHERE widget_key=$1',[d.widgetKey]);if(!route.rowCount)throw new HttpFailure(404,'Widget not found');const tenantId=String(route.rows[0].tenant_id);
 return publicTenant(pool,tenantId,async db=>{
  const config=await db.query('SELECT enabled,title,origins FROM chatbot_widget_settings WHERE tenant_id=$1',[tenantId]);const settings=config.rows[0];
  if(!settings?.enabled||!Array.isArray(settings.origins)||!settings.origins.includes(origin))throw new HttpFailure(403,'Website not enabled for this widget');
  await consumeUsage(db,tenantId,'inbound');
  const name=typeof d.name==='string'?d.name.trim():'زائر الموقع';if(name.length<2||name.length>120)throw new HttpFailure(400,'Invalid visitor name');
  const contact=await db.query(`INSERT INTO contacts(tenant_id,full_name,phone,source) VALUES($1,$2,NULL,'WEBSITE') RETURNING id`,[tenantId,name]);
  const conv=await db.query(`INSERT INTO conversations(tenant_id,contact_id,channel,last_customer_message_at,last_message_at) VALUES($1,$2,'WEBSITE',now(),now()) RETURNING id`,[tenantId,contact.rows[0].id]);
  const token=randomBytes(32).toString('base64url'),hash=tokenDigest(token);
  const session=await db.query('INSERT INTO chatbot_web_sessions(tenant_id,token_hash,conversation_id,origin) VALUES($1,$2,$3,$4) RETURNING id',[tenantId,hash,conv.rows[0].id,origin]);
  await db.query('INSERT INTO chatbot_web_routes(token_hash,tenant_id,session_id) VALUES($1,$2,$3)',[hash,tenantId,session.rows[0].id]);
  const out=await respondToFlow(db,{tenantId,conversationId:String(conv.rows[0].id),contactId:String(contact.rows[0].id),actionId:'flow:restart',body:'',fromWhatsApp:false});
  await deliverConversation(db,tenantId,String(conv.rows[0].id),out.payloads,{staff:out.handedOff});return {token,title:settings.title};
 });
}
async function withSession<T>(pool:SqlClient&SqlPool,bearer:string,origin:string,task:(db:SqlClient,tenantId:string,session:Record<string,unknown>)=>Promise<T>){
 const token=bearer.replace(/^Bearer /,'');if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new HttpFailure(401,'Invalid visitor token');
 const hash=tokenDigest(token),route=await pool.query('SELECT tenant_id,session_id FROM chatbot_web_routes WHERE token_hash=$1',[hash]);if(!route.rowCount)throw new HttpFailure(401,'Session expired');const tenantId=String(route.rows[0].tenant_id);
 return publicTenant(pool,tenantId,async db=>{
  // Consistent contact-before-conversation locking prevents a website message from
  // resurrecting erased personal data during concurrent privacy anonymization.
  // Lock only the contact, not the whole tenant, to preserve chat concurrency.
  const ref=await db.query('SELECT c.contact_id FROM chatbot_web_sessions s JOIN conversations c ON c.tenant_id=s.tenant_id AND c.id=s.conversation_id WHERE s.tenant_id=$1 AND s.id=$2 AND s.token_hash=$3 AND s.origin=$4 AND s.expires_at>now()',[tenantId,route.rows[0].session_id,hash,origin]);
  if(!ref.rowCount)throw new HttpFailure(401,'Visitor session unavailable');
  const contact=await db.query('SELECT status FROM contacts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,ref.rows[0].contact_id]);
  if(!contact.rowCount||contact.rows[0].status==='ARCHIVED')throw new HttpFailure(401,'Visitor session expired after privacy erasure');
  const session=await db.query(`SELECT s.id,s.conversation_id,c.contact_id,c.status,c.bot_control FROM chatbot_web_sessions s JOIN conversations c ON c.tenant_id=s.tenant_id AND c.id=s.conversation_id JOIN chatbot_widget_settings w ON w.tenant_id=s.tenant_id WHERE s.tenant_id=$1 AND s.id=$2 AND s.token_hash=$3 AND s.origin=$4 AND s.expires_at>now() AND w.enabled=true AND w.origins ? $4 FOR UPDATE OF c`,[tenantId,route.rows[0].session_id,hash,origin]);
  if(!session.rowCount)throw new HttpFailure(401,'Visitor session unavailable');return task(db,tenantId,session.rows[0]);
 });
}
export async function websiteMessages(pool:SqlClient&SqlPool,bearer:string,origin:string){return withSession(pool,bearer,origin,async(db,tenantId,s)=>({status:s.status,messages:(await db.query(`SELECT id,body,payload,kind,created_at FROM (SELECT id,body,payload,kind,created_at FROM conversation_messages WHERE tenant_id=$1 AND conversation_id=$2 AND kind IN ('INBOUND','OUTBOUND') ORDER BY created_at DESC,id DESC LIMIT 200) m ORDER BY created_at,id`,[tenantId,s.conversation_id])).rows}))}
export async function websiteSend(pool:SqlClient&SqlPool,bearer:string,origin:string,input:unknown){
 const d=input as {messageId?:unknown;text?:unknown;actionId?:unknown};if(!d||!isUuid(d.messageId)||typeof d.text!=='string'||d.text.length>2000||typeof d.actionId!=='string'||d.actionId.length>200||!d.text.trim()&&!d.actionId)throw new HttpFailure(400,'Invalid visitor message');
 const text=d.text,actionId=d.actionId,messageId=d.messageId;
 return withSession(pool,bearer,origin,async(db,tenantId,s)=>{
  const previous=await db.query('SELECT 1 FROM chatbot_web_receipts WHERE tenant_id=$1 AND session_id=$2 AND message_id=$3',[tenantId,s.id,messageId]);if(previous.rowCount)return {received:true,duplicate:true};
  const recent=await db.query(`SELECT count(*)::int AS n FROM chatbot_web_receipts WHERE tenant_id=$1 AND session_id=$2 AND created_at>now()-interval '1 minute'`,[tenantId,s.id]);if(Number(recent.rows[0]?.n)>=30&&!/^(stop|unsubscribe|إيقاف الرسائل|إلغاء الرسائل)$/i.test(text.trim()))throw new HttpFailure(429,'Please wait before sending more messages');
  await db.query('INSERT INTO chatbot_web_receipts(tenant_id,session_id,message_id) VALUES($1,$2,$3)',[tenantId,s.id,messageId]);
  await db.query(`INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body) VALUES($1,$2,'INBOUND',$3)`,[tenantId,s.conversation_id,text.trim()||'اختيار: '+actionId]);
  await db.query(`UPDATE conversations SET last_message_at=now(),last_customer_message_at=now(),status=CASE WHEN status='CLOSED' AND coalesce(bot_control->>'mode','')<>'STOPPED' THEN 'OPEN' ELSE status END WHERE tenant_id=$1 AND id=$2`,[tenantId,s.conversation_id]);
  if(/^(stop|unsubscribe|إيقاف الرسائل|إلغاء الرسائل)$/i.test(text.trim())){
   await recordFlowConsent(db,tenantId,String(s.contact_id),String(s.conversation_id),{purpose:'SERVICE',decision:'WITHDRAW',source:'CUSTOMER_COMMAND'});await db.query("UPDATE chatbot_delay_jobs SET status='CANCELLED' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING'",[tenantId,s.conversation_id]);
   await db.query(`INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body) VALUES($1,$2,'OUTBOUND','تم إيقاف الردود الآلية. اكتب START لاستئناف الخدمة.')`,[tenantId,s.conversation_id]);return {received:true};
  }
  try{await consumeUsage(db,tenantId,'inbound')}catch(e){if(e instanceof HttpFailure&&(e.status===403||e.status===429))return {received:true,paused:true};throw e}
  if(/^(start|ابدأ)$/i.test(text.trim()))await recordFlowConsent(db,tenantId,String(s.contact_id),String(s.conversation_id),{purpose:'SERVICE',decision:'GRANT',source:'CUSTOMER_COMMAND'});
  const consent=await db.query('SELECT do_not_contact FROM contacts WHERE tenant_id=$1 AND id=$2',[tenantId,s.contact_id]);if(consent.rows[0]?.do_not_contact)return {received:true};
  if(s.status==='CLOSED'&&(s.bot_control as any)?.mode!=='STOPPED')await db.query('DELETE FROM chatbot_flow_sessions WHERE tenant_id=$1 AND conversation_id=$2',[tenantId,s.conversation_id]);
  if(s.status!=='HUMAN'){
   const result=await respondToFlow(db,{tenantId,conversationId:String(s.conversation_id),contactId:String(s.contact_id),actionId:actionId,body:text,fromWhatsApp:false});await deliverConversation(db,tenantId,String(s.conversation_id),result.payloads,{staff:result.handedOff});
  }return {received:true};
 });
}
