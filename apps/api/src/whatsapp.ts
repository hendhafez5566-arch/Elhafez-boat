import {nativeLocation,nativeAttachment} from './flow-native-input.js';
import {resolveConversationBot} from './bot-routing.js';
import {cancelConversationAutomation,resumeControlledConversation} from './conversation-control.js';
import {recordFlowConsent} from './flow-consent.js';
import {coexistenceEvent,eventTime} from './whatsapp-coexistence.js';
import {recordCommerceInterest} from './commerce.js';
import {consumeUsage} from './usage.js';
import {matchTrigger} from './triggers.js';
import {deliverConversation} from './channels.js';
import {findPublishedCatalogAnswer} from './catalog.js';
import {respondToFlow} from './flow-service.js';
import { registerInterest, readyForAgent } from './chatbot-leads.js';
import { findApprovedAnswer } from './knowledge.js';
/** Official Meta Cloud API; no unofficial WhatsApp libraries or browser automation. */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { allow, HttpFailure, isUuid, type Actor, type SqlClient, type SqlPool } from './services.js';

const phoneIdPattern=/^[0-9]{5,30}$/;
const customerPhonePattern=/^[0-9]{8,15}$/;
const asObject=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v:'';
const limited=(v:unknown,max:number)=>str(v).trim().slice(0,max);
const key=()=>{const encoded=process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY??'';const k=Buffer.from(encoded,'base64');if(k.length!==32)throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY must be 32-byte base64 key');return k;};
export function encryptAccessToken(token:string):string {
 if(token.length<20||token.length>2048)throw new HttpFailure(400,'Invalid access token');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 const ciphertext=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
}
export function decryptAccessToken(value:string):string {
 const pieces=value.split('.');if(pieces.length!==4||pieces[0]!=='v1')throw new Error('Unsupported token encryption');
 const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(pieces[1],'base64url'));
 decipher.setAuthTag(Buffer.from(pieces[2],'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(pieces[3],'base64url')),decipher.final()]).toString('utf8');
}
export function verifyWebhookSignature(raw:Buffer,header:unknown,secret:string):boolean {
 if(!secret||typeof header!=='string'||!/^sha256=[0-9a-f]{64}$/.test(header))return false;
 const expected=createHmac('sha256',secret).update(raw).digest();const provided=Buffer.from(header.slice(7),'hex');
 return expected.length===provided.length&&timingSafeEqual(expected,provided);
}
export function verifyChallenge(params:URLSearchParams):string|null {
 const configured=process.env.META_WEBHOOK_VERIFY_TOKEN??'';
 const actual=params.get('hub.verify_token')??'';
 if(params.get('hub.mode')!=='subscribe'||!configured||!actual)return null;
 const a=Buffer.from(configured),b=Buffer.from(actual);
 if(a.length!==b.length||!timingSafeEqual(a,b))return null;
 const challenge=params.get('hub.challenge');return challenge&&/^\d{1,64}$/.test(challenge)?challenge:null;
}
const graphVersion=()=>{const v=process.env.META_GRAPH_VERSION??'';if(!/^v\d{1,2}\.\d{1,2}$/.test(v))throw new HttpFailure(503,'Meta Graph version not configured');return v;};
/** Read-only provider verification. It never registers numbers or changes subscriptions. */
async function readWhatsAppGraph(path:string,token:string){
  try{
   const response=await fetch(`https://graph.facebook.com/${graphVersion()}/${path}`,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new Error('rejected');
   // Bound provider JSON; never include its body or credentials in an error.
   const reader=response.body?.getReader();if(!reader)throw new Error('empty');
   let size=0;const chunks:Uint8Array[]=[];
   try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>262144)throw new Error('large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
   return asObject(JSON.parse(Buffer.concat(chunks).toString()));
  }catch{throw new HttpFailure(502,'تعذر التحقق من Meta؛ راجع صلاحية الرمز وصلاحيات الحساب وأعد المحاولة');}

}
export async function verifyWhatsAppAccount(phoneNumberId:string,wabaId:string,token:string){
 const get=(path:string)=>readWhatsAppGraph(path,token);
 const phone=await get(`${phoneNumberId}?fields=id,display_phone_number`);
 if(phone.id!==phoneNumberId)throw new HttpFailure(400,'معرف رقم واتساب غير مطابق');
 // Follow only server-built cursors, never provider-supplied next URLs.
 let after='';let found=false;
 for(let page=0;page<20;page++){
  const result=await get(`${wabaId}/phone_numbers?fields=id&limit=100${after?'&after='+encodeURIComponent(after):''}`);
  if(!Array.isArray(result.data))throw new HttpFailure(502,'تعذر قراءة أرقام حساب واتساب');
  if(result.data.some((v:unknown)=>asObject(v).id===phoneNumberId)){found=true;break}
  const paging=asObject(result.paging);after=str(asObject(paging.cursors).after);if(!paging.next||!after)break;
 }
 if(!found)throw new HttpFailure(400,'الرقم لا يتبع حساب WABA المحدد أو تعذر تأكيد التبعية');
 return phone;
}
export async function diagnoseWhatsApp(db:SqlClient,actor:Actor,accountId:string){
 allow(actor,['OWNER']);if(!isUuid(accountId))throw new HttpFailure(400,'Invalid WhatsApp account ID');
 const row=(await db.query(`SELECT phone_number_id,waba_id,access_token_encrypted,status FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2`,[actor.tenantId,accountId])).rows[0];
 if(!row)throw new HttpFailure(404,'Account not found');
 if(row.status!=='CONNECTED')return {verified:false,reason:'DISABLED'};
 await verifyWhatsAppAccount(str(row.phone_number_id),str(row.waba_id),decryptAccessToken(str(row.access_token_encrypted)));
 const appId=process.env.META_APP_ID||'';let subscribed=false;
 if(/^\d{5,30}$/.test(appId)){
  try{
   const data=await readWhatsAppGraph(`${row.waba_id}/subscribed_apps?limit=100`,decryptAccessToken(str(row.access_token_encrypted)));
   subscribed=Array.isArray(data.data)&&data.data.some((v:unknown)=>asObject(asObject(v).whatsapp_business_api_data).id===appId);
  }catch{/* A failed check is never a connected badge. */}
 }
 return {verified:true,subscribed,appConfigured:/^\d{5,30}$/.test(appId),checkedAt:new Date().toISOString(),liveAcceptance:false};
}
export async function connectWhatsApp(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER']);const d=asObject(input),phoneNumberId=str(d.phoneNumberId).trim(),wabaId=str(d.wabaId).trim(),token=str(d.accessToken).trim();
 if(!phoneIdPattern.test(phoneNumberId)||!phoneIdPattern.test(wabaId)||token.length<20||token.length>2048)throw new HttpFailure(400,'Invalid Meta account configuration');
 const verified=await verifyWhatsAppAccount(phoneNumberId,wabaId,token);
 const encrypted=encryptAccessToken(token);
 const r=await db.query(`INSERT INTO whatsapp_accounts(tenant_id,phone_number_id,waba_id,access_token_encrypted,display_phone,connected_by)
  VALUES($1,$2,$3,$4,$5,$6)
  ON CONFLICT(phone_number_id) DO UPDATE SET waba_id=EXCLUDED.waba_id,
  access_token_encrypted=EXCLUDED.access_token_encrypted,display_phone=EXCLUDED.display_phone,
  connected_by=EXCLUDED.connected_by,status='CONNECTED',authorization_status='UNKNOWN',token_expires_at=NULL
  WHERE whatsapp_accounts.tenant_id=EXCLUDED.tenant_id
  RETURNING id,phone_number_id,waba_id,display_phone,status`,
  [actor.tenantId,phoneNumberId,wabaId,encrypted,limited(verified.display_phone_number,32)||null,actor.userId]);
 if(r.rowCount!==1)throw new HttpFailure(409,'Phone number is already connected');
 const route=await db.query(`INSERT INTO whatsapp_routes(phone_number_id,tenant_id,account_id,waba_id) VALUES($1,$2,$3,$4)
  ON CONFLICT(phone_number_id) DO UPDATE SET account_id=EXCLUDED.account_id,waba_id=EXCLUDED.waba_id
  WHERE whatsapp_routes.tenant_id=EXCLUDED.tenant_id RETURNING phone_number_id`,[phoneNumberId,actor.tenantId,r.rows[0].id,wabaId]);
 if(route.rowCount!==1)throw new HttpFailure(409,'Phone routing belongs to another company');
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'WHATSAPP_CONNECTED','whatsapp',$3)`,[actor.tenantId,actor.userId,phoneNumberId]);
 return r.rows[0];
}
export async function whatsappConnection(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER']);return (await db.query(`SELECT id,phone_number_id AS "phoneNumberId",waba_id AS "wabaId",display_phone AS "displayPhone",status,created_at AS "createdAt"
 FROM whatsapp_accounts WHERE tenant_id=$1 ORDER BY created_at DESC`,[actor.tenantId])).rows;
}
export async function disconnectWhatsApp(db:SqlClient,actor:Actor,accountId:string){
 allow(actor,['OWNER']);if(!isUuid(accountId))throw new HttpFailure(400,'Invalid WhatsApp account ID');
 const r=await db.query(`UPDATE whatsapp_accounts SET status='DISABLED',authorization_status='REAUTH_REQUIRED' WHERE tenant_id=$1 AND id=$2 AND status='CONNECTED' RETURNING phone_number_id`,[actor.tenantId,accountId]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Connected account not found');
 await db.query("UPDATE whatsapp_onboarding_attempts SET status='CANCELLED',token_encrypted=NULL,phone_choices=NULL,error_code='LOCAL_DISCONNECT' WHERE tenant_id=$1 AND user_id=$2 AND status IN ('PENDING','SELECT_PHONE','PROCESSING')",[actor.tenantId,actor.userId]);
 // Do not release pre-disconnect pending messages on a later reconnection.
 // In-flight/UNCERTAIN jobs retain evidence and must never be blindly retried.
 await db.query(`UPDATE whatsapp_outbox SET status='FAILED',last_error='Account disconnected before dispatch'
  WHERE tenant_id=$1 AND account_id=$2 AND status='PENDING'`,[actor.tenantId,accountId]);
 await db.query(`DELETE FROM whatsapp_routes WHERE tenant_id=$1 AND phone_number_id=$2`,[actor.tenantId,r.rows[0].phone_number_id]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'WHATSAPP_DISCONNECTED','whatsapp',$3)`,[actor.tenantId,actor.userId,accountId]);return {disconnected:true};
}
function textPayload(text:string){return {messaging_product:'whatsapp',type:'text',text:{preview_url:false,body:text.slice(0,4096)}};}
function buttonPayload(text:string,buttons:{id:string;title:string}[]){
 if(buttons.length<1||buttons.length>3)throw new Error('Invalid WhatsApp button count');
 return {messaging_product:'whatsapp',type:'interactive',interactive:{type:'button',body:{text:text.slice(0,1024)},action:{buttons:buttons.map(b=>({type:'reply',reply:{id:b.id.slice(0,256),title:b.title.slice(0,20)}}))}}};
}
function listPayload(text:string,rows:{id:string;title:string;description?:string}[]){
 if(rows.length<1||rows.length>10)throw new Error('Invalid WhatsApp list row count');
 return {messaging_product:'whatsapp',type:'interactive',interactive:{type:'list',body:{text:text.slice(0,1024)},action:{button:'اختار الخدمة',sections:[{title:'القائمة',rows:rows.map(r=>({id:r.id.slice(0,200),title:r.title.slice(0,24),description:(r.description||'').slice(0,72)}))}]}}};
}
async function queue(db:SqlClient,tenantId:string,accountId:string,conversationId:string,to:string,payload:Record<string,unknown>){
 await db.query(`INSERT INTO whatsapp_outbox(tenant_id,account_id,conversation_id,recipient_phone,payload) VALUES($1,$2,$3,$4,$5::jsonb)`,[tenantId,accountId,conversationId,to,JSON.stringify(payload)]);
}
async function scoped<T>(pool:SqlPool,tenantId:string,action:(tx:SqlClient)=>Promise<T>):Promise<T>{
 const client=await pool.connect();let started=false;try{await client.query('BEGIN');started=true;await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);const r=await action(client);await client.query('COMMIT');return r;}catch(e){if(started)await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
}
/** Meta permits one-character profile names; our contacts table requires at least two characters. */
export function whatsappContactName(value:unknown):string {
 const name=limited(value,120);
 return [...name].length>=2?name:'عميل واتساب';
}
async function incomingMessage(db:SqlClient,accountId:string,tenantId:string,message:Record<string,unknown>,profile:Record<string,unknown>){
 // Message mutations are not new customer input and must never advance the bot.
 if(['edit','revoke'].includes(str(message.type)))return;
 const messageId=limited(message.id,256),from=str(message.from);if(!messageId||!customerPhonePattern.test(from))return;
 const rec=await db.query(`INSERT INTO whatsapp_receipts(tenant_id,account_id,message_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING message_id`,[tenantId,accountId,messageId]);
 if(rec.rowCount!==1)return; // durable, idempotent event processing
 const receivedAt=eventTime(message.timestamp)||new Date();
 await db.query(`UPDATE whatsapp_accounts SET last_inbound_at=greatest(last_inbound_at,$3::timestamptz) WHERE tenant_id=$1 AND id=$2`,[tenantId,accountId,receivedAt]);
 const name=whatsappContactName(profile.name);
 const contact=await db.query(`INSERT INTO contacts(tenant_id,full_name,phone,source) VALUES($1,$2,$3,'WHATSAPP')
  ON CONFLICT(tenant_id,phone) DO UPDATE SET updated_at=now() RETURNING id,do_not_contact`,[tenantId,name,from]);
 const contactId=String(contact.rows[0].id);
 const closed=await db.query("SELECT id FROM conversations WHERE tenant_id=$1 AND contact_id=$2 AND channel='WHATSAPP' AND status='CLOSED' AND coalesce(bot_control->>'mode','')<>'STOPPED' FOR UPDATE",[tenantId,contactId]);
 if(closed.rowCount){await cancelConversationAutomation(db,tenantId,String(closed.rows[0].id));await db.query('DELETE FROM chatbot_flow_sessions WHERE tenant_id=$1 AND conversation_id=$2',[tenantId,closed.rows[0].id]);}
 const conversation=await db.query(`INSERT INTO conversations(tenant_id,contact_id,channel,last_message_at,last_customer_message_at,whatsapp_account_id) VALUES($1,$2,'WHATSAPP',$4,$4,$3)
  ON CONFLICT(tenant_id,contact_id,channel) WHERE channel='WHATSAPP'
  DO UPDATE SET last_message_at=greatest(conversations.last_message_at,$4::timestamptz),last_customer_message_at=greatest(conversations.last_customer_message_at,$4::timestamptz),whatsapp_account_id=$3,status=CASE WHEN conversations.status='CLOSED' AND coalesce(conversations.bot_control->>'mode','')<>'STOPPED' THEN 'OPEN' ELSE conversations.status END RETURNING id,status,last_customer_message_at`,[tenantId,contactId,accountId,receivedAt]);
 const conversationId=String(conversation.rows[0].id),status=str(conversation.rows[0].status);
 const interactive=asObject(message.interactive),reply=asObject(interactive.list_reply||interactive.button_reply);
 const action=limited(reply.id||asObject(message.button).payload,200);
 const nativeInput=message.type==='location'?nativeLocation(asObject(message.location).latitude,asObject(message.location).longitude):['image','video','audio','document'].includes(str(message.type))?nativeAttachment('WHATSAPP',str(message.type),asObject(message[str(message.type)]).id):undefined;
 const triggerEvent=message.type==='location'?'LOCATION' as const:['image','video','audio','document','sticker'].includes(str(message.type))?'MEDIA' as const:action?'POSTBACK' as const:'MESSAGE' as const;
 const msgType=str(message.type),body=msgType==='order'?'[اهتمام بمنتجات كتالوج Meta — يحتاج مراجعة موظف]':msgType==='text'?limited(asObject(message.text).body,4000):msgType==='button'?limited(asObject(message.button).text,4000):action?'اختيار: '+action:'[رسالة واتساب غير نصية]';
 await db.query(`INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body,whatsapp_message_id,message_source,provider_at)
  VALUES($1,$2,'INBOUND',$3,$4,'CUSTOMER',$5)`,[tenantId,conversationId,body,messageId,receivedAt]);
 await db.query(`INSERT INTO whatsapp_conversation_states(tenant_id,conversation_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[tenantId,conversationId]);
 const row=(await db.query(`SELECT * FROM whatsapp_conversation_states WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE`,[tenantId,conversationId])).rows[0];
 if(new Date(String(conversation.rows[0].last_customer_message_at)).getTime()>receivedAt.getTime())return; // Store late message, never rewind the bot.
 const respond=(payload:Record<string,unknown>)=>queue(db,tenantId,accountId,conversationId,from,payload);
 if(/^(stop|unsubscribe|إلغاء الرسائل|إيقاف الرسائل)$/i.test(body.trim())){
   await recordFlowConsent(db,tenantId,contactId,conversationId,{purpose:'SERVICE',decision:'WITHDRAW',source:'CUSTOMER_COMMAND'});
   await respond(textPayload('تم إيقاف الرسائل الآلية. تقدر تكتب START لتفعيل الردود الخدمية مرة تانية.'));
   return;
 }
 try{await consumeUsage(db,tenantId,'inbound')}catch(e){
  if(e instanceof HttpFailure&&(e.status===403||e.status===429)){await db.query(`INSERT INTO audit_events(tenant_id,action,entity_type,entity_id) VALUES($1,'BOT_USAGE_BLOCKED','conversation',$2)`,[tenantId,conversationId]);return}throw e;
 }
 if(/^(start|اشترك|تفعيل الرسائل)$/i.test(body.trim())){
   await recordFlowConsent(db,tenantId,contactId,conversationId,{purpose:'SERVICE',decision:'GRANT',source:'CUSTOMER_COMMAND'});
   if(status==='HUMAN'){
     await respond(textPayload('تم تفعيل الردود الخدمية. الموظف المسؤول هيتابع محادثتك.'));return;
   }
   const restarted=await respondToFlow(db,{tenantId,conversationId,contactId,actionId:'flow:restart',body:'ابدأ',fromWhatsApp:true,triggerEvent});
   for(const payload of restarted.payloads)await respond(payload);
   return;
 }
 if(contact.rows[0].do_not_contact)return;
 if(await recordCommerceInterest(db,tenantId,accountId,conversationId,contactId,message)){if(status!=='HUMAN')await respond(textPayload('وصل اهتمامك بالمنتجات للموظف المختص. سيراجع معك التفاصيل؛ لم يتم تأكيد طلب أو دفع.'));return;}
 if(status==='HUMAN')return; // Human takeover is always authoritative.
 const catalogInterest=/^catalog-interest:([0-9a-f-]{36})$/i.exec(action);
 if(catalogInterest){
   const result=await db.query('SELECT id FROM chatbot_catalog_items WHERE tenant_id=$1 AND id=$2 AND status=$3',
     [tenantId,catalogInterest[1],'PUBLISHED']);
   if(result.rowCount!==1){await respond(textPayload('العرض ده مش متاح دلوقتي. اكتب القائمة علشان تشوف الخدمات.'));return;}
   const leadId=await registerInterest(db,tenantId,conversationId,contactId,null);
   await db.query('UPDATE chatbot_leads SET catalog_item_id=$3 WHERE tenant_id=$1 AND id=$2',[tenantId,leadId,catalogInterest[1]]);
   await readyForAgent(db,tenantId,leadId,conversationId,null);
   await respond(textPayload('تمام، وصلت اهتماماتك للموظف المختص، وهيكمل معاك التفاصيل بنفسه.'));
   return;
 }

 // Generic published workflows take priority over old tourism-specific navigation.
 // Approved answers are permitted only when the exact company-approved question matches.
 const waiting=await db.query(`SELECT 1 FROM chatbot_flow_sessions s LEFT JOIN chatbot_bot_versions b ON b.tenant_id=s.tenant_id AND b.bot_id=s.bot_id AND b.version=s.version LEFT JOIN chatbot_flow_versions v ON v.tenant_id=s.tenant_id AND v.version=s.version AND s.bot_id IS NULL CROSS JOIN LATERAL jsonb_array_elements(coalesce(b.definition,v.definition)->'nodes') node WHERE s.tenant_id=$1 AND s.conversation_id=$2 AND node->>'id'=s.node_id AND node->>'type' IN ('INPUT','QUESTION') LIMIT 1`,[tenantId,conversationId]);
 const explicitHandoff=/^(موظف|عايز موظف|عاوز موظف|خدمة العملاء|كلموني|عايز حد|عاوز حد|human|agent)$/i.test(body.trim());
 const hasFlowSession=await db.query('SELECT bot_id FROM chatbot_flow_sessions WHERE tenant_id=$1 AND conversation_id=$2',[tenantId,conversationId]);
 const routedBot=hasFlowSession.rowCount&&!hasFlowSession.rows[0].bot_id?null:await resolveConversationBot(db,tenantId,conversationId,hasFlowSession.rows[0]?.bot_id);
 const triggered=msgType==='text'||msgType==='button'?await matchTrigger(db,tenantId,body,!hasFlowSession.rowCount,routedBot&&!routedBot.legacy_default?String(routedBot.id):undefined,{channel:'WHATSAPP',event:triggerEvent}):undefined;
 if(msgType==='text'&&!action&&!waiting.rowCount&&!explicitHandoff&&!triggered){
  const answer=await findApprovedAnswer(db,tenantId,body);
  if(answer){await respond(textPayload(answer));return;}
  const catalog=await findPublishedCatalogAnswer(db,tenantId,body);
  if(catalog){
    await respond(buttonPayload(catalog.text,[
      {id:'catalog-interest:'+catalog.id,title:'أنا مهتم'},
      {id:'flow:restart',title:'القائمة'},
      {id:'handoff',title:'موظف'}
    ]));return;
  }
 }
 const flowOutput=await respondToFlow(db,{
   tenantId,conversationId,contactId,
   actionId:action==='home'?'flow:restart':action,
   body,fromWhatsApp:true,triggerEvent,nativeInput
 });
 for(const payload of flowOutput.payloads)await respond(payload);
 return;

}

export async function handleVerifiedWebhook(pool:SqlPool&SqlClient,payload:unknown):Promise<void>{
 const root=asObject(payload);if(root.object!=='whatsapp_business_account')throw new HttpFailure(400,'Unsupported webhook object');
 const entries=Array.isArray(root.entry)?root.entry:[];
 for(const entry of entries.slice(0,20)){
  for(const item of (Array.isArray(asObject(entry).changes)?asObject(entry).changes as unknown[]:[]).slice(0,20)){
   const change=asObject(item),value=asObject(change.value),meta=asObject(value.metadata),phoneNumberId=str(meta.phone_number_id);
   if(change.field==='account_update'){
    const waba=str(asObject(entry).id),when=eventTime(asObject(entry).time),event=str(value.event);
    if(!phoneIdPattern.test(waba)||!when||!['ACCOUNT_OFFBOARDED','ACCOUNT_RECONNECTED'].includes(event))continue;
    const routes=await pool.query('SELECT tenant_id,account_id FROM whatsapp_routes WHERE waba_id=$1',[waba]);
    for(const route of routes.rows)await scoped(pool,String(route.tenant_id),async tx=>{
     const updated=await tx.query(`UPDATE whatsapp_accounts SET status='DISABLED',authorization_status='REAUTH_REQUIRED',last_account_event_at=$3 WHERE tenant_id=$1 AND id=$2 AND (last_account_event_at IS NULL OR last_account_event_at<$3) RETURNING id`,[route.tenant_id,route.account_id,when]);
     if(updated.rowCount)await tx.query(`UPDATE whatsapp_outbox SET status='FAILED',last_error='Meta account update requires reauthorization' WHERE tenant_id=$1 AND account_id=$2 AND status='PENDING'`,[route.tenant_id,route.account_id]);
    });continue;
   }
   if(!phoneIdPattern.test(phoneNumberId))continue;
   const route=await pool.query(`SELECT tenant_id,account_id FROM whatsapp_routes WHERE phone_number_id=$1`,[phoneNumberId]);
   if(route.rowCount!==1)continue;
   const {tenant_id:tenantId,account_id:accountId}=route.rows[0] as {tenant_id:string;account_id:string};
   await scoped(pool,tenantId,async tx=>{
    const account=await tx.query(`SELECT status,waba_id FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2`,[tenantId,accountId]);if(account.rows[0]?.status!=='CONNECTED')return;if(asObject(entry).id&&account.rows[0].waba_id!==asObject(entry).id)return;
    const field=str(change.field);
    if(['smb_message_echoes','history','smb_app_state_sync'].includes(field)){
     await coexistenceEvent(tx,tenantId,accountId,field,value);return;
    }
    // Never reinterpret unknown event envelopes as customer messages.
    if(field&&field!=='messages')return;
    const contacts=Array.isArray(value.contacts)?value.contacts:[];
    for(const message of (Array.isArray(value.messages)?value.messages:[]).slice(0,50)){
     const m=asObject(message),sender=str(m.from),profile=asObject(asObject(contacts.find(c=>asObject(c).wa_id===sender)).profile);
     await incomingMessage(tx,accountId,tenantId,m,profile);
    }
    for(const statusItem of (Array.isArray(value.statuses)?value.statuses:[]).slice(0,100)){
     const s=asObject(statusItem),id=limited(s.id,256),status=str(s.status);
     if(!id||!['sent','delivered','read','failed'].includes(status))continue;
     await reconcileWhatsAppReceipt(tx,tenantId,accountId,s);
    }
   });
  }
 }
}
export async function whatsappInbox(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 return (await db.query(`SELECT c.id,c.channel,c.status,c.assigned_user_id,c.last_message_at,c.last_customer_message_at,
  k.full_name AS customer_name,k.phone,k.do_not_contact,
  coalesce((SELECT count(*) FROM conversation_messages m WHERE m.tenant_id=c.tenant_id AND m.conversation_id=c.id AND m.kind='INBOUND' AND NOT EXISTS(SELECT 1 FROM chatbot_message_reads r WHERE r.tenant_id=m.tenant_id AND r.message_id=m.id AND r.user_id=$2)),0)::int AS unread_count,
  l.id AS lead_id,l.stage AS lead_stage,l.custom_fields,
  p.title AS interested_program,
  coalesce((SELECT count(*) FROM conversation_messages m
   WHERE m.tenant_id=c.tenant_id AND m.conversation_id=c.id AND m.kind='INBOUND'),0)::int AS inbound_count
  FROM conversations c
  JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id
  LEFT JOIN chatbot_leads l ON l.tenant_id=c.tenant_id AND l.conversation_id=c.id
  LEFT JOIN chatbot_catalog_items p ON p.tenant_id=c.tenant_id AND p.id=l.catalog_item_id
  WHERE c.tenant_id=$1 AND c.channel IN ('WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM')
  ORDER BY CASE WHEN l.stage='READY_FOR_AGENT' THEN 0 ELSE 1 END,
   c.last_message_at DESC NULLS LAST LIMIT 150`,[actor.tenantId,actor.userId])).rows;
}
export async function whatsappThread(db:SqlClient,actor:Actor,conversationId:string){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);if(!isUuid(conversationId))throw new HttpFailure(400,'Invalid conversation ID');
 const found=await db.query(`SELECT id FROM conversations WHERE tenant_id=$1 AND id=$2 AND channel IN ('WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM')`,[actor.tenantId,conversationId]);if(found.rowCount!==1)throw new HttpFailure(404,'Conversation not found');
 await db.query(`INSERT INTO chatbot_inbox_reads(tenant_id,conversation_id,user_id) VALUES($1,$2,$3) ON CONFLICT(tenant_id,conversation_id,user_id) DO UPDATE SET read_at=now()`,[actor.tenantId,conversationId,actor.userId]);
 const messages=(await db.query(`SELECT id,kind,body,delivery_status,created_at,message_source,provider_at,imported_history FROM conversation_messages
 WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY created_at DESC,id DESC LIMIT 150`,[actor.tenantId,conversationId])).rows.reverse();
 await db.query(`INSERT INTO chatbot_message_reads(tenant_id,message_id,user_id) SELECT tenant_id,id,$3 FROM conversation_messages WHERE tenant_id=$1 AND conversation_id=$2 AND id=ANY($4::uuid[]) AND kind='INBOUND' ON CONFLICT DO NOTHING`,[actor.tenantId,conversationId,actor.userId,messages.map(m=>m.id)]);
 return messages;
}
export async function setWhatsAppHandoff(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);
 if(!isUuid(id))throw new HttpFailure(400,'Invalid conversation');
 const d=asObject(input);
 if(d.status!=='HUMAN'&&d.status!=='OPEN'&&d.status!=='CLOSED')throw new HttpFailure(400,'Invalid handoff status');
 // The conversation lock prevents two agents from simultaneously taking ownership.
 await db.query('SELECT k.id FROM contacts k JOIN conversations c ON c.tenant_id=k.tenant_id AND c.contact_id=k.id WHERE c.tenant_id=$1 AND c.id=$2 FOR UPDATE OF k',[actor.tenantId,id]);
 const previous=await db.query(`SELECT status,assigned_user_id,bot_control FROM conversations
   WHERE tenant_id=$1 AND id=$2 AND channel IN ('WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM') FOR UPDATE`,[actor.tenantId,id]);
 if(previous.rowCount!==1)throw new HttpFailure(404,'Conversation not found');
 if(d.status==='OPEN'){const consent=await db.query('SELECT do_not_contact FROM contacts WHERE tenant_id=$1 AND id=(SELECT contact_id FROM conversations WHERE tenant_id=$1 AND id=$2)',[actor.tenantId,id]);if(consent.rows[0]?.do_not_contact||(previous.rows[0].bot_control as any)?.mode==='STOPPED')throw new HttpFailure(409,'Customer consent or explicit stopped control prevents inbox release');}
 const current=previous.rows[0],myAssignment=String(current.assigned_user_id||'')===actor.userId;
 if(actor.role==='AGENT'&&current.status==='HUMAN'&&current.assigned_user_id&&!myAssignment)
   throw new HttpFailure(409,'Conversation already assigned to another agent');
 if(actor.role==='AGENT'&&d.assignedUserId!==undefined&&d.assignedUserId!==actor.userId)
   throw new HttpFailure(403,'Agents can only assign a conversation to themselves');
 const assigned=d.status!=='HUMAN'?null:(d.assignedUserId===undefined?actor.userId:d.assignedUserId);
 if(assigned!==null){
  if(!isUuid(assigned))throw new HttpFailure(400,'Invalid assignee');
  const member=await db.query(`SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2`,[actor.tenantId,assigned]);
  if(member.rowCount!==1||member.rows[0].role==='VIEWER')throw new HttpFailure(404,'Active staff assignee not found');
 }
 if(d.status==='OPEN'&&['PAUSED','HANDOFF'].includes(String((current.bot_control as any)?.mode))){await resumeControlledConversation(db,actor.tenantId,id);await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'WHATSAPP_HANDOFF_CHANGED','conversation',$3)",[actor.tenantId,actor.userId,id]);return (await db.query('SELECT id,status,assigned_user_id FROM conversations WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id])).rows[0];}
 await cancelConversationAutomation(db,actor.tenantId,id);
 await db.query("UPDATE conversations SET bot_control='{}',bot_revision=bot_revision+1 WHERE tenant_id=$1 AND id=$2",[actor.tenantId,id]);
 if(d.status!=='OPEN')await db.query("UPDATE chatbot_delay_jobs SET status='CANCELLED' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING'",[actor.tenantId,id]);
 else await db.query('UPDATE chatbot_flow_sessions SET node_id=NULL,runtime_nodes=NULL WHERE tenant_id=$1 AND conversation_id=$2',[actor.tenantId,id]);
 const r=await db.query(`UPDATE conversations SET status=$3,assigned_user_id=$4
   WHERE tenant_id=$1 AND id=$2 AND channel IN ('WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM')
   RETURNING id,status,assigned_user_id`,[actor.tenantId,id,d.status,assigned]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Conversation not found');
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id)
 VALUES($1,$2,'WHATSAPP_HANDOFF_CHANGED','conversation',$3)`,[actor.tenantId,actor.userId,id]);
 return r.rows[0];
}
export async function replyWhatsApp(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);if(!isUuid(id))throw new HttpFailure(400,'Invalid conversation');
 const body=limited(asObject(input).body,2000);if(!body)throw new HttpFailure(400,'Empty reply');
 const web=await db.query(`SELECT status,assigned_user_id FROM conversations WHERE tenant_id=$1 AND id=$2 AND channel IN ('WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM') FOR UPDATE`,[actor.tenantId,id]);
 if(web.rowCount){const c=web.rows[0];if(c.status!=='HUMAN'||actor.role==='AGENT'&&c.assigned_user_id!==actor.userId)throw new HttpFailure(403,'Only the assigned staff member can reply');await deliverConversation(db,actor.tenantId,id,[textPayload(body)],{staff:true});return {queued:false,available:true}}
 const c=await db.query(`SELECT c.id,c.status,c.assigned_user_id,c.last_customer_message_at,k.phone,k.do_not_contact,a.id AS account_id
  FROM conversations c JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id
  JOIN whatsapp_accounts a ON a.tenant_id=c.tenant_id AND a.id=c.whatsapp_account_id AND a.status='CONNECTED'
  WHERE c.tenant_id=$1 AND c.id=$2 AND c.channel IN ('WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM') ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE OF c`,[actor.tenantId,id]);
 if(c.rowCount!==1)throw new HttpFailure(404,'Connected WhatsApp conversation not found');const row=c.rows[0];
 if(row.do_not_contact)throw new HttpFailure(409,'Contact opted out');
 if(row.status!=='HUMAN')throw new HttpFailure(409,'Take over conversation before replying');
 if(actor.role==='AGENT'&&String(row.assigned_user_id||'')!==actor.userId)
  throw new HttpFailure(403,'Only the assigned agent may reply to this conversation');
 if(!row.last_customer_message_at||Date.now()-new Date(String(row.last_customer_message_at)).getTime()>24*3600_000)
  throw new HttpFailure(409,'Outside 24-hour service window. Use an approved template.');
 await queue(db,actor.tenantId,String(row.account_id),id,String(row.phone).replace('+',''),textPayload(body));
 await db.query('UPDATE conversations SET last_message_at=now() WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'WHATSAPP_REPLY_QUEUED','conversation',$3)`,[actor.tenantId,actor.userId,id]);
 return {queued:true,notDelivered:true};
}
export async function optOutWhatsApp(db:SqlClient,actor:Actor,contactId:string,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);if(!isUuid(contactId))throw new HttpFailure(400,'Invalid customer');
 const blocked=asObject(input).doNotContact;if(typeof blocked!=='boolean')throw new HttpFailure(400,'doNotContact must be boolean');
 if(!blocked){const consent=await db.query("SELECT decision FROM contact_consent_events WHERE tenant_id=$1 AND contact_id=$2 AND purpose='SERVICE' ORDER BY occurred_at DESC,id DESC LIMIT 1",[actor.tenantId,contactId]);if(['DENY','WITHDRAW'].includes(String(consent.rows[0]?.decision)))throw new HttpFailure(409,'Only the customer can restore withdrawn service consent');}
 if(blocked){const c=await db.query('SELECT id FROM conversations WHERE tenant_id=$1 AND contact_id=$2 ORDER BY id LIMIT 1',[actor.tenantId,contactId]);if(c.rowCount){await recordFlowConsent(db,actor.tenantId,contactId,String(c.rows[0].id),{purpose:'SERVICE',decision:'WITHDRAW',source:'STAFF',actorId:actor.userId});return {id:contactId,do_not_contact:true}}}
 const r=await db.query(`UPDATE contacts SET do_not_contact=$3 WHERE tenant_id=$1 AND id=$2 RETURNING id,do_not_contact`,[actor.tenantId,contactId,blocked]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Customer not found');
 await db.query(`INSERT INTO contact_consent_events(tenant_id,contact_id,channel,granted,evidence) VALUES($1,$2,'WHATSAPP',$3,'Staff recorded opt status')`,[actor.tenantId,contactId,!blocked]);
 return r.rows[0];
}

/** Only verified provider webhooks call this account/recipient-bound reconciliation. */
export async function reconcileWhatsAppReceipt(db:SqlClient,tenantId:string,accountId:string,s:Record<string,unknown>){
 const providerId=limited(s.id,256),status=str(s.status),opaque=str(s.biz_opaque_callback_data),recipient=str(s.recipient_id);
 if(!providerId||!['sent','delivered','read','failed'].includes(status))return;
 if(isUuid(opaque)&&customerPhonePattern.test(recipient)){
  const recovered=await db.query(`UPDATE whatsapp_outbox SET status=CASE WHEN $6='failed' THEN 'FAILED' ELSE 'SENT' END,provider_message_id=$4,locked_at=NULL,dispatched_at=coalesce(dispatched_at,now()),last_error=CASE WHEN $6='failed' THEN 'Provider delivery failed' ELSE NULL END WHERE tenant_id=$1 AND account_id=$2 AND id=$3 AND recipient_phone=$5 AND status IN ('PROCESSING','UNCERTAIN') AND (provider_message_id IS NULL OR provider_message_id=$4) RETURNING conversation_id,payload`,[tenantId,accountId,opaque,providerId,recipient,status]);
  if(recovered.rowCount){const j=recovered.rows[0],payload=j.payload as {text?:{body?:string};type?:string};await db.query(`INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body,whatsapp_message_id,delivery_status) VALUES($1,$2,'OUTBOUND',$3,$4,$5) ON CONFLICT DO NOTHING`,[tenantId,j.conversation_id,payload.text?.body||'[رسالة تمت تسويتها بإيصال المزود]',providerId,status]);}
 }
 // Out-of-order/replayed receipts must never downgrade delivered/read to sent/failed.
 await db.query(`UPDATE conversation_messages m SET delivery_status=$3 FROM conversations c WHERE m.tenant_id=$1 AND m.whatsapp_message_id=$2 AND c.tenant_id=m.tenant_id AND c.id=m.conversation_id AND c.whatsapp_account_id=$4 AND CASE WHEN m.delivery_status='read' THEN false WHEN m.delivery_status='delivered' THEN $3='read' ELSE true END`,[tenantId,providerId,status,accountId]);
}
