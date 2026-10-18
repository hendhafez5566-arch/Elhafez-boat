import {prepareCommerceTemplate} from './commerce.js';
import {validateManagedMedia} from './media.js';
import {templateComponents,type TemplateValues} from './template-components.js';
/** Official Meta-approved template registry + explicit marketing consent; no bulk send endpoint. */
import { createDecipheriv } from 'node:crypto';
import { allow, HttpFailure, isUuid, type Actor, type SqlClient } from './services.js';
const record=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
const names=/^[a-z0-9_]{2,120}$/;
const langs=/^[a-z]{2}(_[A-Z]{2})?$/;
const categories=['UTILITY','MARKETING'] as const;
const graphVersion=()=>{const v=process.env.META_GRAPH_VERSION||'';if(!/^v\d{1,2}\.\d{1,2}$/.test(v))throw new HttpFailure(503,'Meta Graph version is not configured');return v;};
export function whatsappToken(encrypted:string):string{
 const parts=encrypted.split('.');if(parts.length!==4||parts[0]!=='v1')throw new HttpFailure(500,'Token encryption format invalid');
 const k=Buffer.from(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY||'','base64');
 if(k.length!==32)throw new HttpFailure(503,'Token encryption key is not configured');
 const decipher=createDecipheriv('aes-256-gcm',k,Buffer.from(parts[1],'base64url'));
 decipher.setAuthTag(Buffer.from(parts[2],'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(parts[3],'base64url')),decipher.final()]).toString('utf8');
}
export async function listTemplates(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 return (await db.query(`SELECT t.id,t.account_id AS "accountId",t.template_name AS "name",t.language_code AS "language",t.category,t.components,t.last_provider_verification AS "lastVerifiedAt"
 FROM whatsapp_approved_templates t WHERE t.tenant_id=$1 ORDER BY t.last_provider_verification DESC LIMIT 100`,[actor.tenantId])).rows;
}
/** Re-verify a variable-free, provider-approved template for the authenticated tenant's Meta WABA. */
export async function registerApprovedTemplate(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER']);const d=record(input);const accountId=d.accountId,name=d.name,language=d.language;
 if(!isUuid(accountId)||typeof name!=='string'||!names.test(name)||typeof language!=='string'||!langs.test(language))
  throw new HttpFailure(400,'Invalid template registration');
 const account=await db.query(`SELECT waba_id,access_token_encrypted FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2 AND status='CONNECTED'`,[actor.tenantId,accountId]);
 if(account.rowCount!==1)throw new HttpFailure(404,'WhatsApp account not connected');
 const a=account.rows[0];let response:Response;
 try{response=await fetch(`https://graph.facebook.com/${graphVersion()}/${a.waba_id}/message_templates?fields=name,language,status,category,components&limit=100&name=${encodeURIComponent(name)}`,{
  headers:{Authorization:'Bearer '+whatsappToken(String(a.access_token_encrypted))},signal:AbortSignal.timeout(10000)
 });}catch{throw new HttpFailure(502,'Failed to contact Meta template API')}
 if(!response.ok)throw new HttpFailure(502,'Meta denied template verification');
 const result=record(await response.json());const items=Array.isArray(result.data)?result.data:[];
 const template=items.map(record).find(t=>t.name===name&&t.language===language&&t.status==='APPROVED');
 if(!template)throw new HttpFailure(409,'Template is not approved by Meta in this account');
 if(!categories.includes(template.category as typeof categories[number]))throw new HttpFailure(409,'Template category not supported for outreach');
 const parts=Array.isArray(template.components)?template.components.map(record):[];
 // Registration stores provider structure. Sending validates required values against it.
 if(parts.some(p=>!['BODY','HEADER','FOOTER','BUTTONS','CAROUSEL'].includes(String(p.type))))
   throw new HttpFailure(409,'Template has unsupported unsupported authentication/provider components');
 const carousel=parts.filter(p=>p.type==='CAROUSEL');
 if(carousel.length>1||carousel.length&&template.category!=='MARKETING')
   throw new HttpFailure(409,'Carousel is only supported in approved marketing templates');
 if(carousel.length){
   const cards=carousel[0].cards;
   if(!Array.isArray(cards)||cards.length<2||cards.length>10||
     cards.some(card=>!Array.isArray((card as {components?:unknown}).components)))
     throw new HttpFailure(409,'Unsupported approved carousel card metadata');
 }
 const saved=await db.query(`INSERT INTO whatsapp_approved_templates(tenant_id,account_id,template_name,language_code,category,components)
 VALUES($1,$2,$3,$4,$5,$6::jsonb)
 ON CONFLICT(tenant_id,account_id,template_name,language_code) DO UPDATE SET category=EXCLUDED.category,components=EXCLUDED.components,last_provider_verification=now()
 RETURNING id,template_name AS name,language_code AS language,category`,[actor.tenantId,accountId,name,language,template.category,JSON.stringify(parts)]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'META_TEMPLATE_REGISTERED','template',$3)`,[actor.tenantId,actor.userId,String(saved.rows[0].id)]);
 return saved.rows[0];
}
export async function recordMarketingConsent(db:SqlClient,actor:Actor,contactId:string,input:unknown){
 allow(actor,['OWNER','MANAGER']);if(!isUuid(contactId))throw new HttpFailure(400,'Invalid contact');
 const d=record(input),optIn=d.optIn,evidence=d.evidence;
 if(typeof optIn!=='boolean'||typeof evidence!=='string'||evidence.trim().length<8||evidence.trim().length>400)
  throw new HttpFailure(400,'Explicit consent status and evidence (8-400 characters) are required');
 const result=await db.query(`UPDATE contacts SET marketing_opt_in=$3,marketing_opt_in_at=CASE WHEN $3 THEN now() ELSE NULL END,
 updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING id,marketing_opt_in AS "marketingOptIn"`,[actor.tenantId,contactId,optIn]);
 if(result.rowCount!==1)throw new HttpFailure(404,'Contact not found');
 await db.query(`INSERT INTO contact_consent_events(tenant_id,contact_id,channel,granted,evidence)
 VALUES($1,$2,'WHATSAPP',$3,$4)`,[actor.tenantId,contactId,optIn,evidence.trim()]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'MARKETING_CONSENT_UPDATED','contact',$3)`,[actor.tenantId,actor.userId,contactId]);
 return result.rows[0];
}
export async function sendApprovedTemplate(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);const d=record(input);const contactId=d.contactId,templateId=d.templateId;
 let scheduledFor:Date|null=null;
 if(d.scheduleAt){if(typeof d.scheduleAt!=='string')throw new HttpFailure(400,'Invalid schedule');scheduledFor=new Date(d.scheduleAt);if(!Number.isFinite(scheduledFor.getTime())||scheduledFor.getTime()<Date.now()+60000||scheduledFor.getTime()>Date.now()+30*86400000)throw new HttpFailure(400,'Schedule must be 1 minute to 30 days ahead')}
 if(!isUuid(contactId)||!isUuid(templateId))throw new HttpFailure(400,'Invalid template recipient');
 // Serialize outgoing decisions on customer row to avoid concurrent flood and opt-out races.
 const customer=await db.query(`SELECT phone,do_not_contact,marketing_opt_in FROM contacts WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[actor.tenantId,contactId]);
 if(customer.rowCount!==1)throw new HttpFailure(404,'Customer not found');
 const t=await db.query(`SELECT t.*,a.id AS account_id,a.waba_id,a.access_token_encrypted FROM whatsapp_approved_templates t JOIN whatsapp_accounts a
 ON a.tenant_id=t.tenant_id AND a.id=t.account_id AND a.status='CONNECTED'
 WHERE t.tenant_id=$1 AND t.id=$2`,[actor.tenantId,templateId]);
 if(t.rowCount!==1)throw new HttpFailure(404,'Approved template or connection not found');
 if(!customer.rows[0].phone)throw new HttpFailure(400,'Contact has no WhatsApp phone');
 if((d.parameters as TemplateValues|undefined)?.catalog||(d.parameters as TemplateValues|undefined)?.itemId||(Array.isArray((d.parameters as TemplateValues|undefined)?.cards)&&(d.parameters as TemplateValues).cards!.some(c=>c?.itemId))||Date.now()-new Date(String(t.rows[0].last_provider_verification)).getTime()>86400000){
  const item=t.rows[0];const url=`https://graph.facebook.com/${graphVersion()}/${item.waba_id}/message_templates?fields=name,language,status,category,components&limit=100&name=${encodeURIComponent(String(item.template_name))}`;
  let response:Response;try{response=await fetch(url,{headers:{Authorization:'Bearer '+whatsappToken(String(item.access_token_encrypted))},signal:AbortSignal.timeout(10000),redirect:'error'})}catch{throw new HttpFailure(502,'Meta approval refresh unavailable')}
  if(!response.ok)throw new HttpFailure(502,'Meta approval refresh denied');const result=record(await response.json());const current=(Array.isArray(result.data)?result.data:[]).map(record).find(x=>x.name===item.template_name&&x.language===item.language_code&&x.status==='APPROVED'&&categories.includes(x.category as 'UTILITY'|'MARKETING'));
  if(!current)throw new HttpFailure(409,'Template no longer approved');item.components=current.components;item.category=current.category;
  await db.query('UPDATE whatsapp_approved_templates SET components=$3::jsonb,last_provider_verification=now() WHERE tenant_id=$1 AND id=$2',[actor.tenantId,templateId,JSON.stringify(current.components)]);
 }

 const prepared=await prepareCommerceTemplate(db,actor.tenantId,String(t.rows[0].account_id),t.rows[0].components,d.parameters as TemplateValues|undefined);
 if(prepared.refs.length&&t.rows[0].category!=='MARKETING')throw new HttpFailure(409,'Commerce templates require approved MARKETING category');
 const components=prepared.components;
 if((d.parameters as TemplateValues|undefined)?.mediaUrl){const header=(t.rows[0].components as {type:string;format?:string}[]).find(p=>p.type==='HEADER');if(header?.format)await validateManagedMedia(db,actor.tenantId,String((d.parameters as TemplateValues).mediaUrl),header.format.toLowerCase())}
 const cardValues=(d.parameters as TemplateValues|undefined)?.cards;
 if(cardValues){
   const parts=t.rows[0].components as {type:string;cards?:{components?:{type:string;format?:string}[]}[]}[];
   const carousel=parts.find(p=>p.type==='CAROUSEL');
   if(!carousel||!carousel.cards?.length)throw new HttpFailure(400,'Carousel metadata or card values mismatch');
   for(const [i,card] of cardValues.entries()){
     const header=(carousel.cards[i]||carousel.cards[0]).components?.find(p=>p.type==='HEADER');
     if(!header?.format)throw new HttpFailure(400,'Invalid approved card media');
     if(header.format!=='PRODUCT')await validateManagedMedia(db,actor.tenantId,String(card.mediaUrl),header.format.toLowerCase());
   }
 }
 if(customer.rows[0].do_not_contact)throw new HttpFailure(403,'Customer has opted out of WhatsApp messages');
 if(!customer.rows[0].marketing_opt_in)throw new HttpFailure(403,'Explicit marketing opt-in is required');
 const activity=await db.query(`SELECT count(*) AS n FROM template_message_activity WHERE tenant_id=$1 AND contact_id=$2 AND queued_at>now()-interval '24 hours'`,[actor.tenantId,contactId]);
 if(Number(activity.rows[0].n)>=1)throw new HttpFailure(429,'Only one template message per customer per 24 hours is supported');
 const accountId=String(t.rows[0].account_id),phone=String(customer.rows[0].phone).replace('+','');
 const conversation=await db.query(`INSERT INTO conversations(tenant_id,contact_id,channel,whatsapp_account_id,created_at)
 VALUES($1,$2,'WHATSAPP',$3,now()) ON CONFLICT(tenant_id,contact_id,channel) WHERE channel='WHATSAPP'
 DO UPDATE SET whatsapp_account_id=$3 RETURNING id`,[actor.tenantId,contactId,accountId]);
 const conversationId=String(conversation.rows[0].id);
 const payload={messaging_product:'whatsapp',type:'template',template:{name:t.rows[0].template_name,language:{code:t.rows[0].language_code},...(components.length?{components}:{})}};
 const outbox=await db.query(`INSERT INTO whatsapp_outbox(tenant_id,account_id,conversation_id,recipient_phone,payload,scheduled_for,next_attempt_at,commerce_refs)
 VALUES($1,$2,$3,$4,$5::jsonb,$6,coalesce($6,now()),$7::jsonb) RETURNING id`,[actor.tenantId,accountId,conversationId,phone,JSON.stringify(payload),scheduledFor?.toISOString()??null,JSON.stringify(prepared.refs)]);
 await db.query(`INSERT INTO template_message_activity(tenant_id,contact_id,template_id,conversation_id,sent_by)
 VALUES($1,$2,$3,$4,$5)`,[actor.tenantId,contactId,templateId,conversationId,actor.userId]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id)
 VALUES($1,$2,'TEMPLATE_MESSAGE_QUEUED','contact',$3)`,[actor.tenantId,actor.userId,contactId]);
 return {queued:true,outboxId:String(outbox.rows[0].id),delivered:false,scheduledFor:scheduledFor?.toISOString()??null,recipient:contactId,template:templateId};
}