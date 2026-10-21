import {cancelConversationAutomation} from './conversation-control.js';
import {nativeLocation,nativeAttachment} from './flow-native-input.js';
import {recordFlowConsent} from './flow-consent.js';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient,type SqlPool} from './services.js';
import {openIntegrationSecret,sealIntegrationSecret} from './integration-secrets.js';
import {providerHTTP,ProviderFailure} from './provider-http.js';
import {publicTenant} from './public-tenant.js';
import {respondToFlow} from './flow-service.js';
import {galleryFallback,deliverConversation,websitePayload} from './channels.js';
import {consumeUsage,requireActiveTenant} from './usage.js';
export const socialChannels=['MESSENGER','INSTAGRAM','TELEGRAM'];
const graphVersion=()=>{const v=process.env.META_GRAPH_VERSION||'';if(!/^v\d{1,2}\.\d{1,2}$/.test(v))throw new HttpFailure(503,'META_GRAPH_VERSION required');return v};
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export async function listSocialAccounts(db:SqlClient,a:Actor){allow(a,['OWNER','MANAGER']);return (await db.query('SELECT id,channel,external_id,enabled,created_at FROM chatbot_social_accounts WHERE tenant_id=$1 ORDER BY created_at DESC',[a.tenantId])).rows}
export async function connectSocial(db:SqlClient,a:Actor,input:unknown){
 allow(a,['OWNER']);const d=input as {channel:string;externalId:string;token:string};if(!d||!socialChannels.includes(d.channel)||typeof d.token!=='string'||d.token.length<12||d.token.length>4000)throw new HttpFailure(400,'Invalid channel credentials');
 let id=d.externalId;
 if(d.channel==='TELEGRAM'){
 if(!/^\d{5,16}:[\w-]{25,100}$/.test(d.token))throw new HttpFailure(400,'Invalid bot token');const me=await providerHTTP(new URL('https://api.telegram.org/bot'+d.token+'/getMe'),['api.telegram.org']);if(!me.ok||!me.result?.is_bot)throw new HttpFailure(400,'Telegram bot validation failed');id=String(me.result.id);
 }else{
 if(!/^\d{5,30}$/.test(id))throw new HttpFailure(400,'Invalid provider account ID');const host=d.channel==='INSTAGRAM'?'graph.instagram.com':'graph.facebook.com';const me=await providerHTTP(new URL(`https://${host}/${graphVersion()}/${id}?fields=id`),[host],'GET',{authorization:'Bearer '+d.token});if(String(me.id)!==id)throw new HttpFailure(400,'Account token mismatch');
 }
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[a.tenantId]);
 const existing=await db.query('SELECT id FROM chatbot_social_accounts WHERE tenant_id=$1 AND channel=$2 AND external_id=$3',[a.tenantId,d.channel,id]);
 const count=await db.query('SELECT count(*)::int AS n FROM chatbot_social_accounts WHERE tenant_id=$1',[a.tenantId]);if(!existing.rowCount&&Number(count.rows[0].n)>=20)throw new HttpFailure(409,'Channel account limit reached');
 const secret=randomBytes(32).toString('base64url');const r=existing.rowCount?await db.query('UPDATE chatbot_social_accounts SET token_encrypted=$3,webhook_secret_encrypted=$4,enabled=true WHERE tenant_id=$1 AND id=$2 RETURNING id',[a.tenantId,existing.rows[0].id,sealIntegrationSecret(d.token),sealIntegrationSecret(secret)]):await db.query('INSERT INTO chatbot_social_accounts(tenant_id,channel,external_id,token_encrypted,webhook_secret_encrypted) VALUES($1,$2,$3,$4,$5) RETURNING id',[a.tenantId,d.channel,id,sealIntegrationSecret(d.token),sealIntegrationSecret(secret)]);
 if(!existing.rowCount)await db.query('INSERT INTO chatbot_social_routes(channel,external_id,tenant_id,account_id) VALUES($1,$2,$3,$4)',[d.channel,id,a.tenantId,r.rows[0].id]);
 if(d.channel==='TELEGRAM'){
 const origin=process.env.APP_PUBLIC_ORIGIN;if(!origin||!/^https:\/\/[^/]+$/.test(origin))throw new HttpFailure(503,'APP_PUBLIC_ORIGIN required');const result=await providerHTTP(new URL('https://api.telegram.org/bot'+d.token+'/setWebhook'),['api.telegram.org'],'POST',{'content-type':'application/json'},{url:origin+'/api/v1/channels/telegram/'+id,secret_token:secret,allowed_updates:['message','callback_query'],drop_pending_updates:false});if(!result.ok)throw new HttpFailure(502,'Telegram webhook registration failed');
 }
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'SOCIAL_ACCOUNT_CONNECTED','channel',$3)`,[a.tenantId,a.userId,r.rows[0].id]);return {id:r.rows[0].id,channel:d.channel,externalId:id,configured:true,deliveryVerified:false};
}
export async function disableSocial(db:SqlClient,a:Actor,id:string){allow(a,['OWNER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid account');const r=await db.query('UPDATE chatbot_social_accounts SET enabled=false WHERE tenant_id=$1 AND id=$2 RETURNING id',[a.tenantId,id]);if(!r.rowCount)throw new HttpFailure(404,'Account not found');await db.query("UPDATE chatbot_social_outbox SET status='CANCELLED',payload='{}'::jsonb WHERE tenant_id=$1 AND account_id=$2 AND status='PENDING'",[a.tenantId,id]);await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'SOCIAL_ACCOUNT_DISABLED','channel',$3)`,[a.tenantId,a.userId,id]);return {disabled:true};}
type Incoming={nativeInput?:import('./flow-engine.js').FlowInput;triggerEvent?:import('./flow-triggers.js').TriggerEvent;sender:string;eventId:string;name:string;text:string;action:string;timestamp:number};
export function parseTelegram(payload:any):Incoming|null{
 const cb=payload?.callback_query,m=cb?.message||payload?.message;if(!m||m.chat?.type!=='private'||!Number.isSafeInteger(payload?.update_id))return null;const sender=String(m.chat.id);if(!/^\d{1,20}$/.test(sender))return null;
 const media=m.document?['document',m.document.file_id]:Array.isArray(m.photo)&&m.photo.length?['image',m.photo.at(-1)?.file_id]:m.video?['video',m.video.file_id]:m.audio||m.voice?['audio',(m.audio||m.voice).file_id]:undefined;const nativeInput=m.location?nativeLocation(m.location.latitude,m.location.longitude):media?nativeAttachment('TELEGRAM',media[0],media[1]):undefined;
 return {nativeInput,triggerEvent:cb?'POSTBACK':m.location?'LOCATION':m.photo||m.document||m.audio||m.video||m.voice?'MEDIA':'MESSAGE',sender,eventId:String(payload.update_id),name:String((cb?.from||m.from)?.first_name||'عميل Telegram').slice(0,120),text:String(cb?'':m.text||m.caption||'[وسائط واردة]').slice(0,2000),action:typeof cb?.data==='string'?cb.data:'',timestamp:Number(m.date)*1000};
}
export function parseMetaSocial(payload:any):{channel:string;account:string;message:Incoming}[]{
 if(!['page','instagram'].includes(payload?.object)||!Array.isArray(payload.entry))return [];const out:{channel:string;account:string;message:Incoming}[]=[];
 for(const entry of payload.entry.slice(0,50))for(const e of (Array.isArray(entry.messaging)?entry.messaging:[]).slice(0,100)){
 if(e.message?.is_echo||e.read||e.delivery||!/^\d{5,30}$/.test(String(e.sender?.id)))continue;
 const id=e.message?.mid||e.postback?.mid;if(typeof id!=='string'||id.length>256)continue;
 const attachments=Array.isArray(e.message?.attachments)?e.message.attachments:[];
 const channel=payload.object==='page'?'MESSENGER':'INSTAGRAM',attachment=attachments[0],nativeInput=attachment?.type==='location'?nativeLocation(attachment.payload?.coordinates?.lat,attachment.payload?.coordinates?.long):attachment?nativeAttachment(channel,attachment.type==='file'?'document':attachment.type,attachment.payload?.url):undefined;
 out.push({channel:payload.object==='page'?'MESSENGER':'INSTAGRAM',account:String(entry.id),message:{nativeInput,triggerEvent:e.postback||e.message?.quick_reply?.payload&&e.message.quick_reply.payload!==e.message.text?'POSTBACK':attachments.some((a:any)=>a?.type==='location')?'LOCATION':attachments.length?'MEDIA':'MESSAGE',sender:String(e.sender.id),eventId:id,name:payload.object==='page'?'عميل Messenger':'عميل Instagram',text:String(e.message?.text||e.postback?.title||'[وسائط واردة]').slice(0,2000),action:String(e.message?.quick_reply?.payload===e.message?.text?'':e.message?.quick_reply?.payload||e.postback?.payload||'').slice(0,200),timestamp:Number(e.timestamp)}});
 }return out;
}
export async function receiveTelegram(pool:SqlClient&SqlPool,bot:string,secret:string,payload:unknown){
 const route=await pool.query("SELECT tenant_id,account_id FROM chatbot_social_routes WHERE channel='TELEGRAM' AND external_id=$1",[bot]);if(!route.rowCount)throw new HttpFailure(404,'Bot not found');const r=route.rows[0];
 return publicTenant(pool,String(r.tenant_id),async db=>{const account=await db.query('SELECT * FROM chatbot_social_accounts WHERE tenant_id=$1 AND id=$2 AND enabled=true',[r.tenant_id,r.account_id]);if(!account.rowCount||!equal(secret,openIntegrationSecret(String(account.rows[0].webhook_secret_encrypted))))throw new HttpFailure(401,'Webhook secret rejected');const incoming=parseTelegram(payload);if(incoming)await receive(db,String(r.tenant_id),String(r.account_id),'TELEGRAM',incoming);return {received:true}});
}
export async function receiveMetaSocial(pool:SqlClient&SqlPool,payload:unknown){
 for(const e of parseMetaSocial(payload)){const r=await pool.query('SELECT tenant_id,account_id FROM chatbot_social_routes WHERE channel=$1 AND external_id=$2',[e.channel,e.account]);if(r.rowCount)await publicTenant(pool,String(r.rows[0].tenant_id),db=>receive(db,String(r.rows[0].tenant_id),String(r.rows[0].account_id),e.channel,e.message));}
 return {received:true};
}
async function receive(db:SqlClient,t:string,account:string,channel:string,m:Incoming){
 if(!Number.isFinite(m.timestamp)||m.timestamp<Date.now()-172800000||m.timestamp>Date.now()+300000)return;
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[t]);const enabled=await db.query('SELECT 1 FROM chatbot_social_accounts WHERE tenant_id=$1 AND id=$2 AND enabled=true',[t,account]);if(!enabled.rowCount)return;
 const receipt=await db.query('INSERT INTO chatbot_social_receipts(tenant_id,account_id,event_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id',[t,account,m.eventId]);if(!receipt.rowCount)return;
 const existing=await db.query('SELECT contact_id FROM conversations WHERE tenant_id=$1 AND social_account_id=$2 AND external_sender_id=$3',[t,account,m.sender]);if(existing.rowCount)await db.query('SELECT id FROM contacts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[t,existing.rows[0].contact_id]);
 let conv=await db.query('SELECT * FROM conversations WHERE tenant_id=$1 AND social_account_id=$2 AND external_sender_id=$3 FOR UPDATE',[t,account,m.sender]);
 if(!conv.rowCount){const contact=await db.query("INSERT INTO contacts(tenant_id,full_name,phone,source) VALUES($1,$2,NULL,'IMPORT') RETURNING id",[t,m.name.length>1?m.name:'عميل']);conv=await db.query(`INSERT INTO conversations(tenant_id,contact_id,channel,social_account_id,external_sender_id,last_customer_message_at,last_message_at) VALUES($1,$2,$3,$4,$5,to_timestamp($6/1000.0),now()) RETURNING *`,[t,contact.rows[0].id,channel,account,m.sender,m.timestamp]);}
 const c=conv.rows[0],cid=String(c.id);await db.query('UPDATE conversations SET last_customer_message_at=greatest(last_customer_message_at,to_timestamp($3/1000.0)),last_message_at=now() WHERE tenant_id=$1 AND id=$2',[t,cid,m.timestamp]);
 const inbound=await db.query("INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body) VALUES($1,$2,'INBOUND',$3) RETURNING id",[t,cid,m.text||'[اختيار تفاعلي]']);
 if(/^(stop|\/stop|إلغاء|الغاء|توقف)$/i.test(m.text.trim())){await recordFlowConsent(db,t,String(c.contact_id),cid,{purpose:'SERVICE',decision:'WITHDRAW',source:'CUSTOMER_COMMAND'});await db.query("UPDATE chatbot_delay_jobs SET status='CANCELLED' WHERE tenant_id=$1 AND conversation_id=$2",[t,cid]);await db.query("UPDATE chatbot_social_outbox SET status='CANCELLED' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING'",[t,cid]);return;}
 if(/^(start|\/start|ابدأ)$/i.test(m.text.trim()))await recordFlowConsent(db,t,String(c.contact_id),cid,{purpose:'SERVICE',decision:'GRANT',source:'CUSTOMER_COMMAND'});
 const contact=await db.query('SELECT do_not_contact FROM contacts WHERE tenant_id=$1 AND id=$2',[t,c.contact_id]);if(contact.rows[0]?.do_not_contact)return;
 await db.query('SAVEPOINT social_budget');try{await consumeUsage(db,t,'inbound')}catch{await db.query('ROLLBACK TO SAVEPOINT social_budget');return;}
 if(c.status==='HUMAN')return;
 if(c.status==='CLOSED'&&(c.bot_control as any)?.mode!=='STOPPED'){await cancelConversationAutomation(db,t,cid);await db.query("UPDATE conversations SET status='OPEN',assigned_user_id=NULL WHERE tenant_id=$1 AND id=$2",[t,cid]);await db.query('DELETE FROM chatbot_flow_sessions WHERE tenant_id=$1 AND conversation_id=$2',[t,cid]);}
 let action='';if(m.action){const found=await db.query('SELECT action_id FROM chatbot_social_actions WHERE tenant_id=$1 AND conversation_id=$2 AND token=$3 AND created_at>now()-interval \'7 days\'',[t,cid,m.action]);if(found.rowCount)action=String(found.rows[0].action_id);}
 if(m.action&&!action)return; // Unknown/expired callback is never reclassified as a message event.
 const result=await respondToFlow(db,{tenantId:t,conversationId:cid,contactId:String(c.contact_id),actionId:action,body:m.text,inboundMessageId:String(inbound.rows[0].id),fromWhatsApp:false,nativeInput:m.nativeInput,triggerEvent:m.triggerEvent==='POSTBACK'&&!action?undefined:m.triggerEvent});await deliverConversation(db,t,cid,result.payloads,{staff:result.handedOff});
}
/** Convert internal neutral messages to provider-supported formats. Large Telegram callbacks
 * use opaque 24-byte action references rather than exceeding its 64-byte limit. */
export function socialPayload(channel:string,recipient:string,message:ReturnType<typeof websitePayload>,actions:{id:string;title:string;url?:string}[]=[]):{method:string;body:Record<string,unknown>}[]{
 if(message.type==='INPUT_REQUEST'){if(channel==='TELEGRAM'&&message.inputKind==='LOCATION')return [{method:'sendMessage',body:{chat_id:recipient,text:message.text,reply_markup:{keyboard:[[{text:'مشاركة موقعي',request_location:true}]],resize_keyboard:true,one_time_keyboard:true}}}];if(channel==='MESSENGER'&&['PHONE','EMAIL'].includes(String(message.inputKind)))return [{method:'messages',body:{recipient:{id:recipient},messaging_type:'RESPONSE',message:{text:message.text,quick_replies:[{content_type:message.inputKind==='PHONE'?'user_phone_number':'user_email'}]}}}];return socialPayload(channel,recipient,{type:'TEXT',text:String(message.text||'')});}
 if(message.type==='GALLERY'){if(channel==='TELEGRAM')return galleryFallback(message.cards||[]).flatMap(p=>socialPayload(channel,recipient,websitePayload(p)));return [{method:'messages',body:{recipient:{id:recipient},...(channel==='MESSENGER'?{messaging_type:'RESPONSE'}:{}),message:{attachment:{type:'template',payload:{template_type:'generic',elements:(message.cards||[]).map(c=>({title:c.title,...(c.subtitle?{subtitle:c.subtitle}:{}),...(c.imageUrl?{image_url:c.imageUrl}:{}),...(c.actions?.length?{buttons:c.actions.map(a=>({type:'web_url',title:a.title,url:a.url}))}:{})}))}}}}}]}
 if(channel==='TELEGRAM'){
 if(message.type==='MEDIA'){const kind=String(message.kind),method=({image:'sendPhoto',video:'sendVideo',audio:'sendAudio',document:'sendDocument'} as Record<string,string>)[kind],field=kind==='image'?'photo':kind;return [{method,body:{chat_id:recipient,[field]:message.url,...(message.caption?{caption:message.caption}:{})}}]}
 return [{method:'sendMessage',body:{chat_id:recipient,text:message.text,...(actions.length?{reply_markup:{inline_keyboard:actions.map(a=>[{text:a.title,...(a.url?{url:a.url}:{callback_data:a.id})}])}}:{})}}];
 }
 if(message.type==='MEDIA'){
 if(channel==='INSTAGRAM'&&message.kind!=='image')return [{method:'messages',body:{recipient:{id:recipient},message:{text:([message.caption,message.url].filter(Boolean).join('\n')).slice(0,1000)}}}];
 return [{method:'messages',body:{recipient:{id:recipient},...(channel==='MESSENGER'?{messaging_type:'RESPONSE'}:{}),message:{attachment:{type:message.kind==='document'?'file':message.kind,payload:{url:message.url}}}}}];}
 if(channel==='MESSENGER'&&actions.some(a=>a.url))return [{method:'messages',body:{recipient:{id:recipient},messaging_type:'RESPONSE',message:{attachment:{type:'template',payload:{template_type:'button',text:message.text,buttons:actions.map(a=>a.url?{type:'web_url',title:a.title,url:a.url}:{type:'postback',title:a.title,payload:a.id})}}}}}];
 const text=String(message.text||''),limit=channel==='INSTAGRAM'?1000:2000,out=[];for(let i=0;i<text.length;i+=limit){const last=i+limit>=text.length;out.push({method:'messages',body:{recipient:{id:recipient},...(channel==='MESSENGER'?{messaging_type:'RESPONSE'}:{}),message:{text:text.slice(i,i+limit),...(last&&actions.length?{quick_replies:actions.map(a=>({content_type:'text',title:a.title.slice(0,20),payload:a.id}))}:{})}}})}return out;
}
export async function enqueueSocial(db:SqlClient,t:string,cid:string,account:string,channel:string,recipient:string,payloads:Record<string,unknown>[]){
 const count=await db.query("SELECT count(*)::int AS n FROM chatbot_social_outbox WHERE tenant_id=$1 AND status='PENDING'",[t]);if(Number(count.rows[0].n)+payloads.length>1000)throw new HttpFailure(429,'Channel queue limit reached');
 for(const p of payloads){const message=websitePayload(p),actions=[];for(const choice of message.type==='CHOICES'?(message.choices||[]):[]){if('url'in choice&&choice.url){actions.push({id:'',title:choice.title,url:choice.url});continue}const token=randomBytes(18).toString('base64url');await db.query('INSERT INTO chatbot_social_actions(tenant_id,conversation_id,token,action_id) VALUES($1,$2,$3,$4)',[t,cid,token,choice.id]);actions.push({id:token,title:choice.title})}
 for(const item of socialPayload(channel,recipient,message,actions))await db.query('INSERT INTO chatbot_social_outbox(tenant_id,account_id,conversation_id,payload) VALUES($1,$2,$3,$4::jsonb)',[t,account,cid,JSON.stringify(item)]);
 }
}
/** Claim commits before HTTP. Unknown results are quarantined, never automatically resent. */
export async function processSocial(pool:SqlClient&SqlPool,t:string){
 const tx=await pool.connect();let active=false;try{
 await tx.query('BEGIN');active=true;await tx.query("SELECT set_config('app.tenant_id',$1,true)",[t]);try{await requireActiveTenant(tx,t)}catch(e){if(e instanceof HttpFailure&&e.status===403){await tx.query('COMMIT');active=false;return;}throw e}
 await tx.query("UPDATE chatbot_social_outbox SET status='UNCERTAIN',last_error='Interrupted dispatch; reconcile provider before resend' WHERE tenant_id=$1 AND status='PROCESSING' AND locked_at<now()-interval '2 minutes'",[t]);
 const r=await tx.query(`SELECT j.*,a.channel,a.external_id,a.token_encrypted,c.external_sender_id,c.last_customer_message_at,k.do_not_contact FROM chatbot_social_outbox j JOIN chatbot_social_accounts a ON a.tenant_id=j.tenant_id AND a.id=j.account_id JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id JOIN contacts k ON k.tenant_id=c.tenant_id AND k.id=c.contact_id WHERE j.tenant_id=$1 AND j.status='PENDING' AND j.next_attempt_at<=now() AND a.enabled=true ORDER BY j.created_at LIMIT 1 FOR UPDATE OF j,k SKIP LOCKED`,[t]);if(!r.rowCount){await tx.query('COMMIT');active=false;return;}
 const j=r.rows[0];if(j.do_not_contact||!j.external_sender_id||j.channel!=='TELEGRAM'&&Date.now()-new Date(String(j.last_customer_message_at)).getTime()>86400000){await tx.query("UPDATE chatbot_social_outbox SET status='FAILED',last_error='Opt-out or service window expired' WHERE tenant_id=$1 AND id=$2",[t,j.id]);await tx.query('COMMIT');active=false;return;}
 await tx.query("UPDATE chatbot_social_outbox SET status='PROCESSING',locked_at=now(),attempts=attempts+1 WHERE tenant_id=$1 AND id=$2",[t,j.id]);await tx.query('COMMIT');active=false;
 let status='SENT',error='';try{const token=openIntegrationSecret(String(j.token_encrypted)),item=j.payload as {method:string;body:Record<string,unknown>};const host=j.channel==='TELEGRAM'?'api.telegram.org':j.channel==='INSTAGRAM'?'graph.instagram.com':'graph.facebook.com';const url=j.channel==='TELEGRAM'?`https://${host}/bot${token}/${item.method}`:`https://${host}/${graphVersion()}/${j.external_id}/messages`;const result=await providerHTTP(new URL(url),[host],'POST',{'content-type':'application/json',...(j.channel==='TELEGRAM'?{}:{authorization:'Bearer '+token})},item.body);if(j.channel==='TELEGRAM'&&!result.ok){if(result.error_code===429)throw new ProviderFailure(429);throw new ProviderFailure(result.error_code||400)}if(j.channel!=='TELEGRAM'&&!result.message_id)throw new ProviderFailure(0,true);
 }catch(e){const code=e instanceof ProviderFailure?e.status:0;status=code===0||e instanceof ProviderFailure&&e.ambiguous?'UNCERTAIN':code===429&&Number(j.attempts)<7?'PENDING':'FAILED';error='Provider send failed ('+code+'); reconcile uncertain messages'}
 await tx.query('BEGIN');active=true;await tx.query("SELECT set_config('app.tenant_id',$1,true)",[t]);await tx.query("UPDATE chatbot_social_outbox SET status=$3,last_error=$4,next_attempt_at=now()+interval '1 minute' WHERE tenant_id=$1 AND id=$2",[t,j.id,status,error]);
 if(status==='SENT'){const item=j.payload as {body:{text?:string;message?:{text?:string}}};await tx.query("INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body,delivery_status,execution_id) VALUES($1,$2,'OUTBOUND',$3,'sent',$4)",[t,j.conversation_id,item.body.text||item.body.message?.text||'[وسائط]',j.execution_id]);await tx.query('UPDATE conversations SET last_message_at=now() WHERE tenant_id=$1 AND id=$2',[t,j.conversation_id]);}
 await tx.query('COMMIT');active=false;
 }catch(e){if(active)await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
}
