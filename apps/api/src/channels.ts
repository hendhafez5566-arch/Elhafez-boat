import {galleryFallback,type FlowCard} from './flow-content.js';
import {enqueueSocial} from './social.js';
/** Channel adapter boundary. Payloads are generated internally, never accepted from visitors. */
import {HttpFailure,type SqlClient} from './services.js';
export function websitePayload(payload:Record<string,unknown>){
 if(payload.type==='elhafez_gallery')return {type:'GALLERY' as const,cards:payload.cards as FlowCard[]};
 const interactive=payload.interactive as {body?:{text?:string};action?:{parameters?:{display_text:string;url:string};buttons?:{reply?:{id:string;title:string};type?:string;url?:string;title?:string}[];sections?:{rows:{id:string;title:string;description?:string}[]}[]}}|undefined;
 if(payload.type==='text')return {type:'TEXT',text:(payload.text as {body:string}).body};
 if(payload.type==='interactive'&&interactive?.action?.parameters)return {type:'CHOICES',text:interactive.body?.text||'',choices:[{id:'',title:interactive.action.parameters.display_text,url:interactive.action.parameters.url}]};
 if(payload.type==='interactive')return {type:'CHOICES',text:interactive?.body?.text||'',choices:interactive?.action?.buttons?.map(x=>x.reply||{id:'',title:x.title||'فتح الرابط',url:x.url})||interactive?.action?.sections?.flatMap(x=>x.rows)||[]};
 const media=payload[String(payload.type)] as {link?:string;caption?:string}|undefined;
 if(['image','video','audio','document'].includes(String(payload.type)))return {type:'MEDIA',kind:payload.type,url:media?.link,caption:media?.caption};
 throw new HttpFailure(400,'Unsupported website payload');
}
export async function deliverConversation(db:SqlClient,tenantId:string,conversationId:string,payloads:Record<string,unknown>[],options:{staff?:boolean}={}){
 const r=await db.query(`SELECT c.channel,c.status,c.social_account_id,c.external_sender_id,c.whatsapp_account_id,c.last_customer_message_at,k.phone,k.do_not_contact FROM conversations c JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id WHERE c.tenant_id=$1 AND c.id=$2 FOR UPDATE OF c`,[tenantId,conversationId]);
 if(!r.rowCount)throw new HttpFailure(404,'Conversation not found');const c=r.rows[0];
 if(c.do_not_contact)throw new HttpFailure(409,'Contact opted out');
 if(!options.staff&&c.status!=='OPEN')throw new HttpFailure(409,'Conversation is not owned by the bot');
 if(c.channel==='WHATSAPP'){
  if(!c.last_customer_message_at||Date.now()-new Date(String(c.last_customer_message_at)).getTime()>86400000)throw new HttpFailure(409,'Service window expired; flow continuation cannot send unapproved outreach');
  const account=await db.query(`SELECT id FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2 AND status='CONNECTED'`,[tenantId,c.whatsapp_account_id]);if(!account.rowCount)throw new HttpFailure(409,'Account disconnected');
  for(const p of payloads.flatMap(p=>p.type==='elhafez_gallery'?galleryFallback(p.cards as FlowCard[]):[p]))await db.query(`INSERT INTO whatsapp_outbox(tenant_id,account_id,conversation_id,recipient_phone,payload) VALUES($1,$2,$3,$4,$5::jsonb)`,[tenantId,c.whatsapp_account_id,conversationId,String(c.phone).replace('+',''),JSON.stringify(p)]);
 }else if(c.channel==='WEBSITE'){
  for(const p of payloads){const message=websitePayload(p);await db.query(`INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body,payload,delivery_status,created_at) VALUES($1,$2,'OUTBOUND',$3,$4::jsonb,'available',greatest(clock_timestamp(),coalesce((SELECT max(created_at)+interval '1 microsecond' FROM conversation_messages WHERE tenant_id=$1 AND conversation_id=$2),clock_timestamp())))`,[tenantId,conversationId,String('text'in message?message.text:'caption'in message?message.caption||'[وسائط]':'[رسالة]').slice(0,4000)||'[رسالة]',JSON.stringify(message)])}
 }else if(['MESSENGER','INSTAGRAM','TELEGRAM'].includes(String(c.channel))){
 if(c.channel!=='TELEGRAM'&&(!c.last_customer_message_at||Date.now()-new Date(String(c.last_customer_message_at)).getTime()>86400000))throw new HttpFailure(409,'Channel service window expired');
 await enqueueSocial(db,tenantId,conversationId,String(c.social_account_id),String(c.channel),String(c.external_sender_id),payloads);
 }else throw new HttpFailure(400,'Channel adapter unavailable');
}


export {galleryFallback} from './flow-content.js';
