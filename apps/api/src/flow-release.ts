/** One readiness contract for inspection AND publication. No network probes or secret projection. */
import {createHash} from 'node:crypto';
import {validateFlow,type FlowDefinition} from './flow-engine.js';
import {compileSubflows} from './subflows.js';
import {flowChannelIssues,type FlowIssue} from './flow-capabilities.js';
import {validateManagedMedia} from './media.js';
import {contentMedia} from './flow-content.js';
import {webhookURL} from './integrations.js';
import {type Actor,type SqlClient} from './services.js';
import {flowStorage} from './flow-storage.js';

function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value}
export function definitionHash(value:unknown){return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}
export function releaseDiff(before:FlowDefinition|null,after:FlowDefinition){
 const old=new Map((before?.nodes||[]).map(n=>[n.id,n])),fresh=new Map(after.nodes.map(n=>[n.id,n]));
 const nodes=[...new Set([...old.keys(),...fresh.keys()])].sort().flatMap(id=>{
  const a=old.get(id),b=fresh.get(id);if(definitionHash(a??null)===definitionHash(b??null))return [];
  const fields=[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>definitionHash((a as any)?.[k]??null)!==definitionHash((b as any)?.[k]??null));
  return [{nodeId:id,kind:!a?'ADDED':!b?'REMOVED':'CHANGED',type:b?.type||a?.type,fields}];
 });
 const metadata=[...new Set([...Object.keys(before||{}),...Object.keys(after)])].filter(k=>k!=='nodes'&&definitionHash((before as any)?.[k]??null)!==definitionHash((after as any)[k]??null));
 return {nodes,metadata,changed:nodes.length>0||metadata.length>0};
}
export async function flowReadiness(db:SqlClient,actor:Actor,input:unknown,botId?:string){
 const issues:FlowIssue[]=[];let source:FlowDefinition,definition:FlowDefinition;
 try{source=validateFlow(input);definition=await compileSubflows(db,actor.tenantId,source)}catch(e){return {publishable:false,issues:[{severity:'error' as const,code:'GRAPH_INVALID',message:e instanceof Error?e.message:'المسار غير صالح'}],definition:null,source:null}}
 issues.push(...flowChannelIssues(definition));
 const routes=await db.query(`SELECT r.channel,r.account_id FROM chatbot_bot_routes r JOIN chatbot_bots b ON b.tenant_id=r.tenant_id AND b.id=r.bot_id WHERE r.tenant_id=$1 AND ${botId?'r.bot_id=$2':'b.legacy_default=true'}`,botId?[actor.tenantId,botId]:[actor.tenantId]);
 for(const r of routes.rows)issues.push(...flowChannelIssues(definition,r.channel as any));
 for(const route of routes.rows)if(route.channel!=='WEBSITE'){
  const configured=route.channel==='WHATSAPP'?await db.query("SELECT 1 FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2 AND status='CONNECTED' AND authorization_status<>'REAUTH_REQUIRED' AND (token_expires_at IS NULL OR token_expires_at>now())",[actor.tenantId,route.account_id]):await db.query('SELECT 1 FROM chatbot_social_accounts WHERE tenant_id=$1 AND id=$2 AND enabled=true',[actor.tenantId,route.account_id]);
  if(!configured.rowCount)issues.push({severity:'warning',code:'CHANNEL_ACCOUNT_NOT_READY',message:'إعداد حساب '+String(route.channel)+' يحتاج مراجعة؛ النشر لا يفعّله تلقائيًا.'});
 }
 if(!routes.rowCount)issues.push({severity:'warning',code:'NO_ROUTE',message:'لم تُربط قناة بهذا البوت. النشر لا يربط حسابًا ولا يرسل رسالة.'});
 for(const n of definition.nodes){
  const fail=(code:string,message:string)=>issues.push({severity:'error',nodeId:n.id,code,message});
  if(n.type==='MEDIA'||n.type==='TEXT'||n.type==='BUTTONS'){
   const media=n.type==='MEDIA'?[{url:n.url,kind:n.mediaKind}]:[...(n.blocks||[]).filter(b=>b.type==='MEDIA').map(b=>({url:b.url,kind:b.mediaKind})),...contentMedia([{type:n.type,blocks:(n.blocks||[]).filter(b=>b.type==='CARD'||b.type==='GALLERY')}]).map(url=>({url,kind:'image' as const}))];
   for(const m of media)try{await validateManagedMedia(db,actor.tenantId,m.url,m.kind)}catch{fail('MEDIA_UNAVAILABLE','الملف غير متاح أو لم يجتز الفحص لهذه الشركة.')}
  }
  if(n.type==='CRM_ACTION'&&n.operation==='ASSIGN'){
   const r=await db.query("SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND role IN ('OWNER','MANAGER','AGENT')",[actor.tenantId,n.value]);if(!r.rowCount)fail('ASSIGNEE_UNAVAILABLE','اختر موظفًا مؤهلًا من هذه الشركة.');
  }
  if(n.type==='CATALOG'){
   const r=await db.query("SELECT 1 FROM chatbot_catalog_items WHERE tenant_id=$1 AND status='PUBLISHED' AND ($2='' OR category_label=$2) LIMIT 1",[actor.tenantId,n.category||'']);if(!r.rowCount)issues.push({severity:'warning',nodeId:n.id,code:'CATALOG_EMPTY',message:'لا توجد عناصر منشورة لهذا القسم؛ سيظهر المسار البديل الحالي.'});
  }
  if(n.type==='AI'){
   const r=await db.query('SELECT enabled FROM chatbot_ai_settings WHERE tenant_id=$1',[actor.tenantId]);if(!r.rows[0]?.enabled)issues.push({severity:'warning',nodeId:n.id,code:'AI_DISABLED',message:'المساعد الذكي غير مفعّل للشركة؛ تبقى الاستجابة المعتمدة أو التحويل للموظف وفق الإعداد الحالي.'});
  }
  if(n.type==='CONNECTOR'){
   const r=await db.query('SELECT provider,config,credentials_encrypted IS NOT NULL AS connected FROM chatbot_connectors WHERE tenant_id=$1 AND id=$2 AND enabled=true',[actor.tenantId,n.connectorId]);
   if(!r.rowCount||!r.rows[0].connected)fail('CONNECTOR_UNAVAILABLE','خدمة الربط غير مفعلة أو تحتاج تفويضًا.');
   else if(r.rows[0].provider==='GOOGLE_SHEETS'&&(!(r.rows[0].config as any)?.spreadsheetId||!(r.rows[0].config as any)?.sheet))fail('CONNECTOR_SETUP','اختر ملف Google Sheets والورقة أولًا.');
   issues.push({severity:'warning',nodeId:n.id,code:'PROVIDER_QUALIFICATION',message:'إعداد خدمة الربط محلي؛ الفحص لا يثبت صلاحية الحساب لدى المزود.'});
  }
  if(n.type==='WEBHOOK'){
   const r=await db.query('SELECT url FROM chatbot_integrations WHERE tenant_id=$1 AND id=$2 AND enabled=true',[actor.tenantId,n.integrationId]);
   try{if(!r.rowCount)throw Error();webhookURL(String(r.rows[0].url))}catch{fail('INTEGRATION_UNAVAILABLE','خدمة الطلب غير متاحة أو عنوانها غير مسموح.');}
  }
 }
 // Externally configured triggers remain supported; source triggers replace them atomically on publish.
 if(source.triggers===undefined){const r=await db.query(`SELECT target_node FROM ${botId?'chatbot_bot_triggers':'chatbot_triggers'} WHERE tenant_id=$1${botId?' AND bot_id=$2':''} AND enabled=true`,botId?[actor.tenantId,botId]:[actor.tenantId]);if(r.rows.some(t=>!definition.nodes.some(n=>n.id===t.target_node)))issues.push({severity:'error',code:'TRIGGER_TARGET',message:'هناك مشغّل محفوظ يشير إلى خطوة محذوفة.'})}
 return {publishable:!issues.some(i=>i.severity==='error'),issues,definition,source};
}
export async function flowReleaseReport(db:SqlClient,actor:Actor,definition:unknown,botId?:string){
 const ready=await flowReadiness(db,actor,definition,botId),live=await flowStorage(db,actor,botId).published();
 const draft=await flowStorage(db,actor,botId).draft();
 if(ready.source){try{const {assertFlowApproved}=await import('./flow-review.js');await assertFlowApproved(db,actor,botId,Number(draft.rows[0]?.draftRevision||0),ready.source)}catch{ready.issues.push({severity:'error',code:'APPROVAL_REQUIRED',message:'احفظ هذه المسودة واطلب موافقة مراجع آخر قبل النشر.'});ready.publishable=false}}

 return {publishable:ready.publishable,issues:ready.issues,publishedVersion:live.rows[0]?.version??null,diff:ready.source?releaseDiff(live.rows[0]?.definition as FlowDefinition||null,ready.source):null,qualification:'LOCAL_CONFIGURATION_ONLY'};
}
