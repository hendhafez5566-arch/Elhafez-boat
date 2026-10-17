import { findApprovedAnswer } from './knowledge.js';
import { makeBookingFlow, finishBookingFlow } from './flows.js';
import { hasDepartures, departurePage, hasRoomPackages, roomPage, validateDepartureChoice, validateRoomChoice, createCustomerBooking } from './booking-choice.js';
/** Official Meta Cloud API; no unofficial WhatsApp libraries or browser automation. */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { allow, HttpFailure, isUuid, type Actor, type SqlClient, type SqlPool } from './services.js';

const phoneIdPattern=/^[0-9]{5,30}$/;
const customerPhonePattern=/^[0-9]{8,15}$/;
const categories=['UMRAH','HAJJ','DOMESTIC','INTERNATIONAL'] as const;
const categoryTitles:Record<string,string>={UMRAH:'برامج العمرة',HAJJ:'برامج الحج',DOMESTIC:'السياحة الداخلية',INTERNATIONAL:'السياحة الخارجية'};
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
export async function connectWhatsApp(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER']);const d=asObject(input),phoneNumberId=str(d.phoneNumberId).trim(),wabaId=str(d.wabaId).trim(),token=str(d.accessToken).trim();
 if(!phoneIdPattern.test(phoneNumberId)||!phoneIdPattern.test(wabaId)||token.length<20||token.length>2048)throw new HttpFailure(400,'Invalid Meta account configuration');
 // Verify the supplied token can read THIS phone number before we store it.
 let response:Response;
 try{response=await fetch(`https://graph.facebook.com/${graphVersion()}/${phoneNumberId}?fields=id,display_phone_number`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});}catch{throw new HttpFailure(502,'Could not verify Meta phone account');}
 if(!response.ok)throw new HttpFailure(400,'Meta rejected the phone number credentials');
 const verified=asObject(await response.json());if(verified.id!==phoneNumberId)throw new HttpFailure(400,'Meta phone ID does not match');
 const encrypted=encryptAccessToken(token);
 const r=await db.query(`INSERT INTO whatsapp_accounts(tenant_id,phone_number_id,waba_id,access_token_encrypted,display_phone,connected_by)
  VALUES($1,$2,$3,$4,$5,$6)
  ON CONFLICT(phone_number_id) DO NOTHING RETURNING id,phone_number_id,waba_id,display_phone,status`,
  [actor.tenantId,phoneNumberId,wabaId,encrypted,limited(verified.display_phone_number,32)||null,actor.userId]);
 if(r.rowCount!==1)throw new HttpFailure(409,'Phone number is already connected');
 await db.query(`INSERT INTO whatsapp_routes(phone_number_id,tenant_id,account_id) VALUES($1,$2,$3)`,[phoneNumberId,actor.tenantId,r.rows[0].id]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'WHATSAPP_CONNECTED','whatsapp',$3)`,[actor.tenantId,actor.userId,phoneNumberId]);
 return r.rows[0];
}
export async function whatsappConnection(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER']);return (await db.query(`SELECT id,phone_number_id AS "phoneNumberId",waba_id AS "wabaId",display_phone AS "displayPhone",status,created_at AS "createdAt"
 FROM whatsapp_accounts WHERE tenant_id=$1 ORDER BY created_at DESC`,[actor.tenantId])).rows;
}
export async function disconnectWhatsApp(db:SqlClient,actor:Actor,accountId:string){
 allow(actor,['OWNER']);if(!isUuid(accountId))throw new HttpFailure(400,'Invalid WhatsApp account ID');
 const r=await db.query(`UPDATE whatsapp_accounts SET status='DISABLED' WHERE tenant_id=$1 AND id=$2 AND status='CONNECTED' RETURNING phone_number_id`,[actor.tenantId,accountId]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Connected account not found');
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
const categoryOk=(v:string):v is typeof categories[number]=>categories.includes(v as typeof categories[number]);
async function publishedConfig(db:SqlClient,tenantId:string){
 const r=await db.query(`SELECT version,config FROM tenant_bot_versions WHERE tenant_id=$1 ORDER BY version DESC LIMIT 1`,[tenantId]);
 if(r.rowCount!==1)return {version:null,enabledCategories:[...categories] as string[],welcomeText:'أهلًا بيك! اختار الخدمة اللي تناسبك:'};
 const c=asObject(r.rows[0].config);return {version:Number(r.rows[0].version),enabledCategories:Array.isArray(c.enabledCategories)?c.enabledCategories.filter(x=>typeof x==='string'&&categoryOk(x)):[],welcomeText:limited(c.welcomeText,500)||'أهلًا بيك! اختار الخدمة:'};
}
async function showMenu(db:SqlClient,tenantId:string,state:Record<string,unknown>,category:string,page:number){
 const cfg=await publishedConfig(db,tenantId);
 if(category==='HOME')return listPayload(cfg.welcomeText,[...cfg.enabledCategories.map(k=>({id:'category:'+k,title:categoryTitles[k]||k,description:'البرامج المتاحة'})),{id:'handoff',title:'موظف المبيعات',description:'التحدث مع مسؤول الحجز'}]);
 if(!categoryOk(category)||!cfg.enabledCategories.includes(category))return showMenu(db,tenantId,state,'HOME',0);
 const result=await db.query(`SELECT id,title,price_minor,currency FROM programs WHERE tenant_id=$1 AND category=$2 AND status='PUBLISHED' AND available_seats>booked_seats
  ORDER BY departure_at NULLS LAST,created_at DESC LIMIT 9 OFFSET $3`,[tenantId,category,page*8]);
 const entries=result.rows.slice(0,8).map(p=>({id:'program:'+p.id,title:String(p.title),description:`${(Number(p.price_minor)/100).toFixed(2)} ${p.currency}`}));
 if(page>0)entries.push({id:`page:${category}:${page-1}`,title:'السابق',description:'رجوع للصفحة السابقة'});
 if(result.rows.length>8)entries.push({id:`page:${category}:${page+1}`,title:'التالي',description:'المزيد من البرامج'});
 if(entries.length===0)return textPayload('لا توجد برامج متاحة حاليًا. اكتب "القائمة" للعودة أو اطلب موظف المبيعات.');
 return listPayload('اختر البرنامج المناسب لك:',entries);
}
const localTravelDate=(value:unknown)=>new Date(String(value)).toLocaleDateString('ar-EG',{timeZone:'Africa/Cairo',day:'numeric',month:'short',year:'numeric'});
async function departureMenu(db:SqlClient,tenantId:string,programId:string,page:number) {
 const result=await departurePage(db,tenantId,programId,page);
 const options=result.items.map(item=>({
  id:'departure:'+item.id,
  title:('سفر '+localTravelDate(item.depart_at)).slice(0,24),
  description:'عودة '+localTravelDate(item.return_at)+' • متاح '+(Number(item.seats_total)-Number(item.seats_booked))+' مقعد'
 }));
 if(page>0)options.push({id:'dep-page:'+(page-1),title:'السابق',description:'مواعيد سابقة'});
 if(result.next)options.push({id:'dep-page:'+(page+1),title:'التالي',description:'مواعيد أخرى'});
 options.push({id:'home',title:'الرئيسية',description:'العودة للقائمة الرئيسية'});
 return result.items.length?listPayload('اختار موعد السفر قبل تسجيل طلب الحجز:',options):textPayload('لا توجد مواعيد متاحة حاليًا للبرنامج. اكتب "القائمة" أو اطلب موظف المبيعات.');
}
const roomTitles:Record<string,string>={SINGLE:'فردي',DOUBLE:'ثنائي',TRIPLE:'ثلاثي',QUAD:'رباعي',FAMILY:'عائلي'};
async function roomMenu(db:SqlClient,tenantId:string,programId:string,departureId:string,page:number) {
 const result=await roomPage(db,tenantId,programId,departureId,page);
 const options=result.items.map(item=>({
   id:'room:'+item.id,
   title:(item.hotel_name+' '+(roomTitles[item.room_type]||item.room_type)).slice(0,24),
   description:(Number(item.price_minor)/100).toFixed(2)+' '+item.currency+' للفرد • '+(Number(item.units_total)-Number(item.units_booked))+' غرف'
 }));
 if(page>0)options.push({id:'room-page:'+(page-1),title:'السابق',description:'غرف سابقة'});
 if(result.next)options.push({id:'room-page:'+(page+1),title:'التالي',description:'أنواع غرف أخرى'});
 options.push({id:'dep-page:0',title:'تغيير موعد السفر',description:'الرجوع للمواعيد'});
 return result.items.length?listPayload('اختار الفندق ونوع الغرفة؛ السعر للفرد:',options):textPayload('لا توجد غرف متاحة حاليًا لهذا الموعد. اكتب "القائمة" أو اطلب موظف المبيعات.');
}
async function incomingMessage(db:SqlClient,accountId:string,tenantId:string,message:Record<string,unknown>,profile:Record<string,unknown>){
 const messageId=limited(message.id,256),from=str(message.from);if(!messageId||!customerPhonePattern.test(from))return;
 const rec=await db.query(`INSERT INTO whatsapp_receipts(tenant_id,account_id,message_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING message_id`,[tenantId,accountId,messageId]);
 if(rec.rowCount!==1)return; // durable, idempotent event processing
 const name=limited(profile.name,120)||'عميل واتساب';
 const contact=await db.query(`INSERT INTO contacts(tenant_id,full_name,phone,source) VALUES($1,$2,$3,'WHATSAPP')
  ON CONFLICT(tenant_id,phone) DO UPDATE SET updated_at=now() RETURNING id,do_not_contact`,[tenantId,name,from]);
 const contactId=String(contact.rows[0].id);
 const conversation=await db.query(`INSERT INTO conversations(tenant_id,contact_id,channel,last_message_at,last_customer_message_at,whatsapp_account_id) VALUES($1,$2,'WHATSAPP',now(),now(),$3)
  ON CONFLICT(tenant_id,contact_id,channel) WHERE channel='WHATSAPP'
  DO UPDATE SET last_message_at=now(),last_customer_message_at=now(),whatsapp_account_id=$3,status=CASE WHEN conversations.status='CLOSED' THEN 'OPEN' ELSE conversations.status END RETURNING id,status`,[tenantId,contactId,accountId]);
 const conversationId=String(conversation.rows[0].id),status=str(conversation.rows[0].status);
 const interactive=asObject(message.interactive),reply=asObject(interactive.list_reply||interactive.button_reply);
 const action=limited(reply.id,200);
 const msgType=str(message.type),body=msgType==='text'?limited(asObject(message.text).body,4000):action?'اختيار: '+action:'[رسالة واتساب غير نصية]';
 await db.query(`INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body,whatsapp_message_id)
  VALUES($1,$2,'INBOUND',$3,$4)`,[tenantId,conversationId,body,messageId]);
 await db.query(`INSERT INTO whatsapp_conversation_states(tenant_id,conversation_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[tenantId,conversationId]);
 const row=(await db.query(`SELECT * FROM whatsapp_conversation_states WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE`,[tenantId,conversationId])).rows[0];
 const respond=(payload:Record<string,unknown>)=>queue(db,tenantId,accountId,conversationId,from,payload);
 if(/^(stop|unsubscribe|إلغاء الرسائل|إيقاف الرسائل)$/i.test(body.trim())){
   await db.query('UPDATE contacts SET do_not_contact=true,marketing_opt_in=false,marketing_opt_in_at=NULL WHERE tenant_id=$1 AND id=$2',[tenantId,contactId]);
   await db.query(`INSERT INTO contact_consent_events(tenant_id,contact_id,channel,granted,evidence) VALUES($1,$2,'WHATSAPP',false,'Customer sent opt-out message')`,[tenantId,contactId]);
   await respond(textPayload('تم إيقاف الرسائل الآلية. تقدر تكتب START لتفعيل الردود الخدمية مرة تانية.'));
   return;
 }
 if(/^(start|اشترك|تفعيل الرسائل)$/i.test(body.trim())){
   await db.query('UPDATE contacts SET do_not_contact=false WHERE tenant_id=$1 AND id=$2',[tenantId,contactId]);
   await db.query(`INSERT INTO contact_consent_events(tenant_id,contact_id,channel,granted,evidence) VALUES($1,$2,'WHATSAPP',true,'Customer requested service-message resumption only')`,[tenantId,contactId]);
   await respond(await showMenu(db,tenantId,row,'HOME',0));return;
 }
 if(contact.rows[0].do_not_contact)return;
 if(status==='HUMAN')return; // no bot takeover while human handles thread
 const cfg=await publishedConfig(db,tenantId);
 if(interactive.type==='nfm_reply'){
   try{
     const bookingId=await finishBookingFlow(db,tenantId,accountId,conversationId,asObject(interactive.nfm_reply).response_json,from);
     await db.query(`UPDATE whatsapp_conversation_states SET awaiting='NONE',booking_program_id=NULL,
       booking_departure_id=NULL,booking_room_package_id=NULL,booking_name=NULL,page_number=0
       WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId]);
     await respond(textPayload('تم تسجيل طلب حجز مبدئي رقم '+bookingId+'. ستراجع الشركة التوافر وتتواصل معاك. الطلب غير مؤكد.'));
   }catch(error){
     if(error instanceof HttpFailure)await respond(textPayload('تعذر تسجيل النموذج: '+error.message+'. اكتب القائمة للمحاولة مرة ثانية.'));
     else throw error;
   }
   return;
 }
 if(action==='handoff'||/^(موظف|خدمة العملاء)$/i.test(body)){
  await db.query(`UPDATE conversations SET status='HUMAN' WHERE tenant_id=$1 AND id=$2`,[tenantId,conversationId]);
  await respond(textPayload('تم تحويل طلبك لفريق المبيعات. هيرد عليك موظف قريبًا.'));return;
 }
 if(action==='home'||/^(القائمة|الرئيسية|ابدأ)$/i.test(body)){
  await db.query(`UPDATE whatsapp_conversation_states SET current_menu='HOME',page_number=0,awaiting='NONE',booking_program_id=NULL,booking_departure_id=NULL,booking_room_package_id=NULL,booking_name=NULL,menu_version=$3 WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId,cfg.version]);
  await respond(await showMenu(db,tenantId,row,'HOME',0));return;
 }
 if(row.awaiting==='BOOKING_NAME'&&!action){
  if(body.length<2||body.length>120)return respond(textPayload('اكتب اسمك الكامل من فضلك (على الأقل حرفين).'));
  await db.query(`UPDATE whatsapp_conversation_states SET awaiting='BOOKING_PARTY',booking_name=$3 WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId,body]);
  await respond(textPayload('تمام، الحجز باسم '+body+'. كام فرد؟ اكتب رقم من 1 إلى 100.'));return;
 }
 if(row.awaiting==='BOOKING_PARTY'&&!action){
  if(!/^(?:[1-9]|[1-9][0-9]|100)$/.test(body.trim()))return respond(textPayload('اكتب عدد أفراد صحيح من 1 إلى 100.'));
  const partySize=Number(body.trim());
  let bookingId:string;
  try {
   bookingId=await createCustomerBooking(db,tenantId,from,String(row.booking_name||''),partySize,{
    programId:String(row.booking_program_id||''),
    departureId:row.booking_departure_id?String(row.booking_departure_id):null,
    roomPackageId:row.booking_room_package_id?String(row.booking_room_package_id):null
   });
  }catch(error) {
   if(error instanceof HttpFailure)return respond(textPayload('مش قادر أسجل العدد ده حاليًا: '+error.message+'. اكتب عدد أقل أو ارجع للقائمة وغيّر الموعد.'));
   throw error;
  }
  await db.query(`UPDATE whatsapp_conversation_states SET awaiting='NONE',booking_program_id=NULL,
   booking_departure_id=NULL,booking_room_package_id=NULL,booking_name=NULL,page_number=0
   WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId]);
  await respond(textPayload(`تم تسجيل طلب حجز مبدئي رقم ${bookingId}. فريق الشركة هيراجع التوافر ويتواصل معاك. *الطلب غير مؤكد ولسه مفيش دفع مطلوب.*`));return;
 }
 const startForm=async(programId:string,departureId:string|null,roomId:string|null)=>{
  const flow=await db.query(`SELECT flow_id,screen_id FROM whatsapp_flow_settings WHERE tenant_id=$1 AND account_id=$2 AND enabled=true`,[tenantId,accountId]);
  if(flow.rowCount===1){
    await db.query(`UPDATE whatsapp_conversation_states SET awaiting='NONE',booking_name=NULL WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId]);
    return respond(await makeBookingFlow(db,tenantId,accountId,conversationId,programId,
      String(flow.rows[0].flow_id),String(flow.rows[0].screen_id),{departureId,roomPackageId:roomId}));
  }
  await db.query(`UPDATE whatsapp_conversation_states SET awaiting='BOOKING_NAME',booking_name=NULL WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId]);
  return respond(textPayload('حاضر، اكتب الاسم الكامل لصاحب طلب الحجز.'));
 };
 if(action.startsWith('dep-page:')&&row.booking_program_id && (row.awaiting==='BOOKING_DEPARTURE'||row.awaiting==='BOOKING_ROOM')){
  const pageText=action.slice(9),page=Number(pageText);
  if(!/^(0|[1-9][0-9]{0,2})$/.test(pageText)||!Number.isSafeInteger(page))return respond(textPayload('الصفحة المطلوبة غير صحيحة. اكتب "القائمة" للعودة.'));
  await db.query(`UPDATE whatsapp_conversation_states SET awaiting='BOOKING_DEPARTURE',page_number=$3,
    booking_departure_id=NULL,booking_room_package_id=NULL WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId,page]);
  await respond(await departureMenu(db,tenantId,String(row.booking_program_id),page));return;
 }
 if(action.startsWith('room-page:')&&row.booking_program_id&&row.booking_departure_id&&row.awaiting==='BOOKING_ROOM'){
  const pageText=action.slice(10),page=Number(pageText);
  if(!/^(0|[1-9][0-9]{0,2})$/.test(pageText)||!Number.isSafeInteger(page))return respond(textPayload('الصفحة المطلوبة غير صحيحة. اكتب "القائمة" للعودة.'));
  await db.query(`UPDATE whatsapp_conversation_states SET page_number=$3 WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId,page]);
  await respond(await roomMenu(db,tenantId,String(row.booking_program_id),String(row.booking_departure_id),page));return;
 }
 if(action.startsWith('departure:')&&row.booking_program_id&&row.awaiting==='BOOKING_DEPARTURE'){
  const departureId=action.slice(10),programId=String(row.booking_program_id);
  if(!await validateDepartureChoice(db,tenantId,programId,departureId)){
    await respond(textPayload('الموعد لم يعد متاحًا. اختر موعدًا آخر من القائمة.'));return;
  }
  const hasRooms=await hasRoomPackages(db,tenantId,programId,departureId);
  await db.query(`UPDATE whatsapp_conversation_states SET booking_departure_id=$3,booking_room_package_id=NULL,
    awaiting=$4,page_number=0 WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId,departureId,hasRooms?'BOOKING_ROOM':'NONE']);
  if(hasRooms){await respond(await roomMenu(db,tenantId,programId,departureId,0));return;}
  await startForm(programId,departureId,null);return;
 }
 if(action.startsWith('room:')&&row.booking_program_id&&row.booking_departure_id&&row.awaiting==='BOOKING_ROOM'){
  const roomId=action.slice(5),programId=String(row.booking_program_id),departureId=String(row.booking_departure_id);
  if(!await validateRoomChoice(db,tenantId,programId,departureId,roomId)){
    await respond(textPayload('الغرفة لم تعد متاحة. اختار غرفة أخرى من القائمة.'));return;
  }
  await db.query(`UPDATE whatsapp_conversation_states SET booking_room_package_id=$3,
    page_number=0 WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId,roomId]);
  await startForm(programId,departureId,roomId);return;
 }
 if(action.startsWith('book:')&&isUuid(action.slice(5))){
  const programId=action.slice(5);
  const p=await db.query(`SELECT id FROM programs WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED' AND available_seats>booked_seats`,[tenantId,programId]);
  if(p.rowCount!==1)return respond(textPayload('البرنامج مش متاح دلوقتي. اكتب "القائمة" لإظهار المتاح.'));
  const needsDeparture=await hasDepartures(db,tenantId,programId);
  await db.query(`UPDATE whatsapp_conversation_states SET booking_program_id=$3,booking_departure_id=NULL,
    booking_room_package_id=NULL,booking_name=NULL,awaiting=$4,page_number=0 WHERE tenant_id=$1 AND conversation_id=$2`,
    [tenantId,conversationId,programId,needsDeparture?'BOOKING_DEPARTURE':'NONE']);
  if(needsDeparture){await respond(await departureMenu(db,tenantId,programId,0));return;}
  await startForm(programId,null,null);return;
 }
 if(action.startsWith('program:')&&isUuid(action.slice(8))){
  const r=await db.query(`SELECT id,title,summary,hotel_name,duration_days,departure_at,price_minor,currency,available_seats,booked_seats FROM programs
   WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED' AND available_seats>booked_seats`,[tenantId,action.slice(8)]);
  if(r.rowCount!==1)return respond(textPayload('البرنامج ده مش متاح. اكتب "القائمة" لعرض الخيارات.'));
  const p=r.rows[0];const desc=[String(p.title),p.summary?String(p.summary):'',p.hotel_name?'الفندق: '+p.hotel_name:'',p.duration_days?'المدة: '+p.duration_days+' يوم':'',p.departure_at?'السفر: '+String(p.departure_at).slice(0,10):'',`السعر الأساسي الاسترشادي: ${(Number(p.price_minor)/100).toFixed(2)} ${p.currency} (السعر النهائي حسب الموعد والغرفة)`].filter(Boolean).join('\n');
  await respond(buttonPayload(desc,[{id:'book:'+p.id,title:'طلب حجز'},{id:'home',title:'القائمة'},{id:'handoff',title:'موظف'}]));return;
 }
 if(action.startsWith('category:')){
  const category=action.slice(9);if(categoryOk(category)&&cfg.enabledCategories.includes(category)){
   await db.query(`UPDATE whatsapp_conversation_states SET current_menu=$3,page_number=0,awaiting='NONE',booking_program_id=NULL,booking_departure_id=NULL,booking_room_package_id=NULL,booking_name=NULL,menu_version=$4 WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId,category,cfg.version]);
   await respond(await showMenu(db,tenantId,row,category,0));return;
  }
 }
 const nav=/^page:(UMRAH|HAJJ|DOMESTIC|INTERNATIONAL):(0|[1-9][0-9]{0,3})$/.exec(action);
 if(nav&&nav[1]===row.current_menu&&categoryOk(nav[1])&&cfg.enabledCategories.includes(nav[1])){
  const page=Number(nav[2]);const count=await db.query(`SELECT count(*) AS total FROM programs WHERE tenant_id=$1 AND category=$2 AND status='PUBLISHED' AND available_seats>booked_seats`,[tenantId,nav[1]]);
  if(page*8<Number(count.rows[0].total)){
   await db.query(`UPDATE whatsapp_conversation_states SET page_number=$3 WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId,page]);
   await respond(await showMenu(db,tenantId,row,nav[1],page));return;
  }
 }
 // An EXACT match against a human-published tenant FAQ can be returned safely.
 // Unknown questions never trigger a made-up AI business answer.
 if(!action&&msgType==='text'){
   const approved=await findApprovedAnswer(db,tenantId,body);
   if(approved){await respond(textPayload(approved));return;}
 }
 await respond(await showMenu(db,tenantId,row,'HOME',0));
}
export async function handleVerifiedWebhook(pool:SqlPool&SqlClient,payload:unknown):Promise<void>{
 const root=asObject(payload);if(root.object!=='whatsapp_business_account')throw new HttpFailure(400,'Unsupported webhook object');
 const entries=Array.isArray(root.entry)?root.entry:[];
 for(const entry of entries.slice(0,20)){
  for(const item of (Array.isArray(asObject(entry).changes)?asObject(entry).changes as unknown[]:[]).slice(0,20)){
   const change=asObject(item),value=asObject(change.value),meta=asObject(value.metadata),phoneNumberId=str(meta.phone_number_id);
   if(!phoneIdPattern.test(phoneNumberId))continue;
   const route=await pool.query(`SELECT tenant_id,account_id FROM whatsapp_routes WHERE phone_number_id=$1`,[phoneNumberId]);
   if(route.rowCount!==1)continue;
   const {tenant_id:tenantId,account_id:accountId}=route.rows[0] as {tenant_id:string;account_id:string};
   await scoped(pool,tenantId,async tx=>{
    const account=await tx.query(`SELECT status FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2`,[tenantId,accountId]);if(account.rows[0]?.status!=='CONNECTED')return;
    const contacts=Array.isArray(value.contacts)?value.contacts:[];
    for(const message of (Array.isArray(value.messages)?value.messages:[]).slice(0,50)){
     const m=asObject(message),sender=str(m.from),profile=asObject(asObject(contacts.find(c=>asObject(c).wa_id===sender)).profile);
     await incomingMessage(tx,accountId,tenantId,m,profile);
    }
    for(const statusItem of (Array.isArray(value.statuses)?value.statuses:[]).slice(0,100)){
     const s=asObject(statusItem),id=limited(s.id,256),status=str(s.status);
     if(!id||!['sent','delivered','read','failed'].includes(status))continue;
     await tx.query(`UPDATE conversation_messages SET delivery_status=$3 WHERE tenant_id=$1 AND whatsapp_message_id=$2`,[tenantId,id,status]);
     await tx.query(`UPDATE whatsapp_outbox SET last_error=CASE WHEN $3='failed' THEN 'Provider delivery failed' ELSE last_error END WHERE tenant_id=$1 AND provider_message_id=$2`,[tenantId,id,status]);
    }
   });
  }
 }
}
export async function whatsappInbox(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 return (await db.query(`SELECT c.id,c.status,c.assigned_user_id,c.last_message_at,c.last_customer_message_at,
  k.full_name AS customer_name,k.phone,k.do_not_contact,coalesce((SELECT count(*) FROM conversation_messages m
   WHERE m.tenant_id=c.tenant_id AND m.conversation_id=c.id AND m.kind='INBOUND'),0)::int AS inbound_count
  FROM conversations c JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id
  WHERE c.tenant_id=$1 AND c.channel='WHATSAPP' ORDER BY c.last_message_at DESC NULLS LAST LIMIT 150`,[actor.tenantId])).rows;
}
export async function whatsappThread(db:SqlClient,actor:Actor,conversationId:string){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);if(!isUuid(conversationId))throw new HttpFailure(400,'Invalid conversation ID');
 const found=await db.query(`SELECT id FROM conversations WHERE tenant_id=$1 AND id=$2 AND channel='WHATSAPP'`,[actor.tenantId,conversationId]);if(found.rowCount!==1)throw new HttpFailure(404,'Conversation not found');
 return (await db.query(`SELECT id,kind,body,delivery_status,created_at FROM conversation_messages
 WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY created_at DESC,id DESC LIMIT 150`,[actor.tenantId,conversationId])).rows.reverse();
}
export async function setWhatsAppHandoff(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);if(!isUuid(id))throw new HttpFailure(400,'Invalid conversation');
 const d=asObject(input);if(d.status!=='HUMAN'&&d.status!=='OPEN')throw new HttpFailure(400,'Invalid handoff status');
 const assigned=d.assignedUserId===null||d.assignedUserId===undefined?actor.userId:d.assignedUserId;
 if(!isUuid(assigned))throw new HttpFailure(400,'Invalid assignee');
 const member=await db.query(`SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2`,[actor.tenantId,assigned]);if(member.rowCount!==1)throw new HttpFailure(404,'Assignee not in company');
 const r=await db.query(`UPDATE conversations SET status=$3,assigned_user_id=$4 WHERE tenant_id=$1 AND id=$2 AND channel='WHATSAPP' RETURNING id,status,assigned_user_id`,[actor.tenantId,id,d.status,assigned]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Conversation not found');
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'WHATSAPP_HANDOFF_CHANGED','conversation',$3)`,[actor.tenantId,actor.userId,id]);return r.rows[0];
}
export async function replyWhatsApp(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);if(!isUuid(id))throw new HttpFailure(400,'Invalid conversation');
 const body=limited(asObject(input).body,2000);if(!body)throw new HttpFailure(400,'Empty reply');
 const c=await db.query(`SELECT c.id,c.status,c.last_customer_message_at,k.phone,k.do_not_contact,a.id AS account_id
  FROM conversations c JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id
  JOIN whatsapp_accounts a ON a.tenant_id=c.tenant_id AND a.id=c.whatsapp_account_id AND a.status='CONNECTED'
  WHERE c.tenant_id=$1 AND c.id=$2 AND c.channel='WHATSAPP' ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE OF c`,[actor.tenantId,id]);
 if(c.rowCount!==1)throw new HttpFailure(404,'Connected WhatsApp conversation not found');const row=c.rows[0];
 if(row.do_not_contact)throw new HttpFailure(409,'Contact opted out');
 if(row.status!=='HUMAN')throw new HttpFailure(409,'Take over conversation before replying');
 if(!row.last_customer_message_at||Date.now()-new Date(String(row.last_customer_message_at)).getTime()>24*3600_000)
  throw new HttpFailure(409,'Outside 24-hour service window. Approved templates are required and not yet configured.');
 await queue(db,actor.tenantId,String(row.account_id),id,String(row.phone).replace('+',''),textPayload(body));
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'WHATSAPP_REPLY_QUEUED','conversation',$3)`,[actor.tenantId,actor.userId,id]);
 return {queued:true,notDelivered:true};
}
export async function optOutWhatsApp(db:SqlClient,actor:Actor,contactId:string,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);if(!isUuid(contactId))throw new HttpFailure(400,'Invalid customer');
 const blocked=asObject(input).doNotContact;if(typeof blocked!=='boolean')throw new HttpFailure(400,'doNotContact must be boolean');
 const r=await db.query(`UPDATE contacts SET do_not_contact=$3 WHERE tenant_id=$1 AND id=$2 RETURNING id,do_not_contact`,[actor.tenantId,contactId,blocked]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Customer not found');
 await db.query(`INSERT INTO contact_consent_events(tenant_id,contact_id,channel,granted,evidence) VALUES($1,$2,'WHATSAPP',$3,'Staff recorded opt status')`,[actor.tenantId,contactId,!blocked]);
 return r.rows[0];
}
export async function getFlowSettings(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER']);
 return (await db.query(`SELECT f.account_id AS "accountId",a.display_phone AS "displayPhone",f.flow_id AS "flowId",f.screen_id AS "screenId",f.enabled
 FROM whatsapp_flow_settings f JOIN whatsapp_accounts a ON a.tenant_id=f.tenant_id AND a.id=f.account_id WHERE f.tenant_id=$1`,[actor.tenantId])).rows;
}
export async function saveFlowSettings(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER']);const d=asObject(input),accountId=d.accountId,flowId=str(d.flowId).trim(),screenId=str(d.screenId||'BOOKING').trim(),enabled=d.enabled;
 if(!isUuid(accountId)||!phoneIdPattern.test(flowId)||!(/^[A-Z][A-Z0-9_]{1,40}$/.test(screenId))||typeof enabled!=='boolean')
  throw new HttpFailure(400,'Invalid Flow configuration');
 const a=await db.query(`SELECT waba_id,access_token_encrypted,status FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2`,[actor.tenantId,accountId]);
 if(a.rowCount!==1||a.rows[0].status!=='CONNECTED')throw new HttpFailure(404,'Connected WhatsApp account required');
 if(enabled){
   let response:Response;
   try{response=await fetch(`https://graph.facebook.com/${graphVersion()}/${flowId}?fields=id,status`,{
     headers:{Authorization:'Bearer '+decryptAccessToken(String(a.rows[0].access_token_encrypted))},signal:AbortSignal.timeout(8000)
   });}catch{throw new HttpFailure(502,'Could not verify published Meta Flow')}
   if(!response.ok)throw new HttpFailure(400,'Meta rejected the Flow identifier');
   const verified=asObject(await response.json());
   if(verified.id!==flowId||verified.status!=='PUBLISHED')throw new HttpFailure(409,'Only a published Meta Flow can be enabled');
 }
 const r=await db.query(`INSERT INTO whatsapp_flow_settings(tenant_id,account_id,flow_id,screen_id,enabled)
 VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,account_id) DO UPDATE SET flow_id=excluded.flow_id,
 screen_id=excluded.screen_id,enabled=excluded.enabled,updated_at=now()
 RETURNING account_id AS "accountId",flow_id AS "flowId",screen_id AS "screenId",enabled`,[actor.tenantId,accountId,flowId,screenId,enabled]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'WHATSAPP_FLOW_CONFIGURED','flow',$3)`,[actor.tenantId,actor.userId,flowId]);
 return r.rows[0];
}
