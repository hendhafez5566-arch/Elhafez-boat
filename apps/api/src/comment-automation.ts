/** Company rules for Meta post comments. No outbound send without separate host-side opt-in. */
import {allow,HttpFailure,isUuid,type Actor,type SqlClient,type SqlPool} from './services.js';
import {publicTenant} from './public-tenant.js';
import {openIntegrationSecret} from './integration-secrets.js';
import {providerHTTP,ProviderFailure} from './provider-http.js';
import {requireActiveTenant} from './usage.js';

type Comment={channel:'MESSENGER'|'INSTAGRAM';account:string;commentId:string;text:string;commentAt:number;fromId:string};
const validId=(s:unknown)=>typeof s==='string'&&/^\d{1,40}(?:_\d{1,40})?$/.test(s);
const graphVersion=()=>{const v=process.env.META_GRAPH_VERSION||'';if(!/^v\d{1,2}\.\d{1,2}$/.test(v))throw new Error('Invalid META_GRAPH_VERSION');return v};

export function parseMetaComments(payload:any):Comment[]{
 if(!['page','instagram'].includes(payload?.object)||!Array.isArray(payload.entry))return [];
 const out:Comment[]=[];
 for(const entry of payload.entry.slice(0,50)){
  if(!validId(String(entry?.id)))continue;
  for(const change of (Array.isArray(entry.changes)?entry.changes:[]).slice(0,100)){
   const v=change?.value;
   const facebook=payload.object==='page'&&change?.field==='feed'&&v?.item==='comment'&&v?.verb==='add';
   const instagram=payload.object==='instagram'&&change?.field==='comments'&&v?.text!==undefined;
   if(!facebook&&!instagram)continue;
   const commentId=String(facebook?v.comment_id:v.id),fromId=String(facebook?v.from?.id:v.from?.id||'');
   if(!validId(commentId)||fromId===String(entry.id))continue;
   const text=facebook?v.message:v.text;
   if(typeof text!=='string'||text.length<1||text.length>2000)continue;
   const epoch=Number(facebook?v.created_time||entry.time:entry.time);
   const commentAt=epoch*1000;
   if(!Number.isFinite(commentAt)||commentAt>Date.now()+300000||commentAt<Date.now()-7*86400000)continue;
   out.push({channel:facebook?'MESSENGER':'INSTAGRAM',account:String(entry.id),commentId,text,commentAt,fromId});
  }
 }
 return out;
}
export function matchComment(text:string,rules:{id:string;keyword:string;mode:string;reply_text:string}[]){
 const q=text.normalize('NFKC').toLocaleLowerCase('ar').trim();
 return rules.find(r=>q.includes(r.keyword.normalize('NFKC').toLocaleLowerCase('ar').trim()))||null;
}
export async function listCommentRules(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER']);
 return (await db.query("SELECT r.id,r.name,r.keyword,r.reply_text AS \"replyText\",r.mode,r.enabled,r.account_id AS \"accountId\",a.channel FROM chatbot_comment_rules r JOIN chatbot_social_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id WHERE r.tenant_id=$1 ORDER BY r.created_at DESC LIMIT 100",[actor.tenantId])).rows;
}
export async function saveCommentRule(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);
 const d=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const accountId=d.accountId,name=typeof d.name==='string'?d.name.trim():'',keyword=typeof d.keyword==='string'?d.keyword.trim():'',reply=typeof d.replyText==='string'?d.replyText.trim():'';
 if(!isUuid(accountId)||name.length<2||name.length>80||keyword.length<3||keyword.length>80||reply.length<2||reply.length>1000||!['REVIEW','AUTO'].includes(String(d.mode))||typeof d.enabled!=='boolean')throw new HttpFailure(400,'Invalid comment rule');
 const account=await db.query("SELECT id FROM chatbot_social_accounts WHERE tenant_id=$1 AND id=$2 AND channel IN ('MESSENGER','INSTAGRAM')",[actor.tenantId,accountId]);
 if(!account.rowCount)throw new HttpFailure(404,'Meta account not found in company');
 const exists=d.id!==undefined;
 if(exists&&!isUuid(d.id))throw new HttpFailure(400,'Invalid rule ID');
 const r=exists?await db.query("UPDATE chatbot_comment_rules SET name=$3,keyword=$4,reply_text=$5,mode=$6,enabled=$7 WHERE tenant_id=$1 AND id=$2 AND account_id=$8 RETURNING id",[actor.tenantId,d.id,name,keyword,reply,d.mode,d.enabled,accountId]):
 await db.query("INSERT INTO chatbot_comment_rules(tenant_id,account_id,name,keyword,reply_text,mode,enabled) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",[actor.tenantId,accountId,name,keyword,reply,d.mode,d.enabled]);
 if(!r.rowCount)throw new HttpFailure(404,'Rule not found');
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'COMMENT_RULE_SAVED','comment_rule',$3)",[actor.tenantId,actor.userId,r.rows[0].id]);
 return {id:r.rows[0].id,enabled:d.enabled,mode:d.mode,externalDeliveryEnabled:process.env.ENABLE_META_PRIVATE_REPLIES==='true'};
}
export async function listCommentCandidates(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER']);
 return (await db.query("SELECT c.id,c.channel,c.comment_id AS \"commentId\",c.reply_text AS \"replyText\",c.status,c.created_at AS \"createdAt\",c.comment_at AS \"commentAt\",r.name AS \"ruleName\" FROM chatbot_comment_candidates c JOIN chatbot_comment_rules r ON r.tenant_id=c.tenant_id AND r.id=c.rule_id WHERE c.tenant_id=$1 ORDER BY c.created_at DESC LIMIT 100",[actor.tenantId])).rows;
}
export async function decideComment(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER']);const d=input as {approve?:unknown};
 if(!isUuid(id)||typeof d?.approve!=='boolean')throw new HttpFailure(400,'Invalid decision');
 const status=d.approve?'APPROVED':'SKIPPED';
 const r=await db.query("UPDATE chatbot_comment_candidates SET status=$3 WHERE tenant_id=$1 AND id=$2 AND status='REVIEW' AND comment_at>now()-interval '7 days' RETURNING id",[actor.tenantId,id,status]);
 if(!r.rowCount)throw new HttpFailure(409,'Candidate not pending or has expired');
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'COMMENT_CANDIDATE_DECIDED','comment_candidate',$3)",[actor.tenantId,actor.userId,id]);
 return {id,status,deliveryEnabled:process.env.ENABLE_META_PRIVATE_REPLIES==='true'};
}
export async function receiveMetaComments(pool:SqlClient&SqlPool,payload:unknown){
 for(const event of parseMetaComments(payload)){
  const route=await pool.query('SELECT tenant_id,account_id FROM chatbot_social_routes WHERE channel=$1 AND external_id=$2',[event.channel,event.account]);
  if(!route.rowCount)continue;
  const tenantId=String(route.rows[0].tenant_id),accountId=String(route.rows[0].account_id);
  await publicTenant(pool,tenantId,async db=>{
   const rules=await db.query("SELECT r.id,r.keyword,r.reply_text,r.mode FROM chatbot_comment_rules r JOIN chatbot_social_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id WHERE r.tenant_id=$1 AND r.account_id=$2 AND r.enabled=true AND a.enabled=true ORDER BY r.created_at",[tenantId,accountId]);
   const matched=matchComment(event.text,rules.rows as {id:string;keyword:string;mode:string;reply_text:string}[]);
   if(!matched)return;
   await db.query("INSERT INTO chatbot_comment_candidates(tenant_id,account_id,rule_id,channel,comment_id,reply_text,status,comment_at) VALUES($1,$2,$3,$4,$5,$6,$7,to_timestamp($8/1000.0)) ON CONFLICT(tenant_id,account_id,comment_id) DO NOTHING",[tenantId,accountId,matched.id,event.channel,event.commentId,matched.reply_text,matched.mode==='AUTO'?'APPROVED':'REVIEW',event.commentAt]);
  });
 }
}
/** Dispatch is opt-in at the server level, disabled by default. Claims are durable before HTTP. */
export async function processPrivateReply(pool:SqlClient&SqlPool,tenantId:string){
 if(process.env.ENABLE_META_PRIVATE_REPLIES!=='true')return;
 const tx=await pool.connect();let begun=false;
 try{
  await tx.query('BEGIN');begun=true;await tx.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  try{await requireActiveTenant(tx,tenantId)}catch(e){if(e instanceof HttpFailure&&e.status===403){await tx.query('COMMIT');begun=false;return}throw e}
  await tx.query("UPDATE chatbot_comment_candidates SET status='UNCERTAIN',last_error='Interrupted provider send; manual reconciliation required' WHERE tenant_id=$1 AND status='PROCESSING' AND locked_at<now()-interval '2 minutes'",[tenantId]);
  const r=await tx.query("SELECT c.*,a.channel,a.external_id,a.token_encrypted FROM chatbot_comment_candidates c JOIN chatbot_social_accounts a ON a.tenant_id=c.tenant_id AND a.id=c.account_id WHERE c.tenant_id=$1 AND c.status='APPROVED' AND c.comment_at>now()-interval '7 days' AND a.enabled=true ORDER BY c.created_at LIMIT 1 FOR UPDATE OF c SKIP LOCKED",[tenantId]);
  if(!r.rowCount){await tx.query('COMMIT');begun=false;return}
  const item=r.rows[0];
  await tx.query("UPDATE chatbot_comment_candidates SET status='PROCESSING',locked_at=now() WHERE tenant_id=$1 AND id=$2",[tenantId,item.id]);
  await tx.query('COMMIT');begun=false;
  let status='SENT',error='';
  try{
   const channel=String(item.channel),token=openIntegrationSecret(String(item.token_encrypted)),v=graphVersion();
   const host=channel==='INSTAGRAM'?'graph.instagram.com':'graph.facebook.com';
   const path=channel==='INSTAGRAM'?v+'/'+item.comment_id+'/private_replies':v+'/'+item.external_id+'/messages';
   const body=channel==='INSTAGRAM'?{message:item.reply_text}:{recipient:{comment_id:item.comment_id},message:{text:item.reply_text}};
   const response=await providerHTTP(new URL('https://'+host+'/'+path),[host],'POST',{'content-type':'application/json',authorization:'Bearer '+token},body);
   if(!response?.id&&!response?.message_id)throw new ProviderFailure(0,true);
  }catch(e){
   const code=e instanceof ProviderFailure?e.status:0;
   status=code===0||code>=500||code===408?'UNCERTAIN':'FAILED';
   error='Private reply provider outcome '+code+'; review account permissions / reconcile before retry';
  }
  await tx.query('BEGIN');begun=true;await tx.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  await tx.query("UPDATE chatbot_comment_candidates SET status=$3,last_error=$4,locked_at=NULL WHERE tenant_id=$1 AND id=$2",[tenantId,item.id,status,error]);
  await tx.query('COMMIT');begun=false;
 }catch(e){if(begun)await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
}
