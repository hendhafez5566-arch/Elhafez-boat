/** Version-bound author review. Optional policy; existing publication remains compatible. */
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {flowStorage} from './flow-storage.js';
import {definitionHash} from './flow-release.js';

async function snapshot(db:SqlClient,a:Actor,scope?:string){const r=await flowStorage(db,a,scope).draft();if(!r.rowCount)throw new HttpFailure(409,'احفظ المسودة أولًا.');return r.rows[0]}
async function audit(db:SqlClient,a:Actor,bot:string,action:string){await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'bot_flow',$4)",[a.tenantId,a.userId,action,bot])}
export async function assertFlowApproved(db:SqlClient,a:Actor,scope:string|undefined,revision:number,definition:unknown){
 const bot=await db.query(`SELECT id FROM chatbot_bots WHERE tenant_id=$1 AND ${scope?'id=$2':'legacy_default=true'}`,scope?[a.tenantId,scope]:[a.tenantId]);if(!bot.rowCount)return;
 const p=await db.query('SELECT required FROM chatbot_flow_review_policies WHERE tenant_id=$1 AND bot_id=$2',[a.tenantId,bot.rows[0].id]);if(!p.rows[0]?.required)return;
 const r=await db.query("SELECT r.status,r.definition_hash,r.decided_by,d.updated_by,m.user_id AS eligible_reviewer FROM chatbot_flow_reviews r LEFT JOIN memberships m ON m.tenant_id=r.tenant_id AND m.user_id=r.decided_by AND m.role IN ('OWNER','MANAGER') JOIN "+(scope?'chatbot_bot_drafts':'chatbot_flow_drafts')+" d ON d.tenant_id=r.tenant_id"+(scope?' AND d.bot_id=r.bot_id':'')+" WHERE r.tenant_id=$1 AND r.bot_id=$2 AND r.draft_revision=$3 ORDER BY r.created_at DESC,r.id DESC LIMIT 1",[a.tenantId,bot.rows[0].id,revision]);
 const row=r.rows[0];if(!row||row.status!=='APPROVED'||!row.eligible_reviewer||row.definition_hash!==definitionHash(definition)||row.decided_by===row.updated_by)throw new HttpFailure(409,'هذه المسودة تحتاج موافقة مراجع آخر قبل النشر.');
}
export async function flowReviewState(db:SqlClient,a:Actor,bot:string,scope?:string,before?:string){
 allow(a,['OWNER','MANAGER','AGENT','VIEWER']);if(before!==undefined&&!isUuid(before))throw new HttpFailure(400,'Invalid comment cursor');
 if(before){const c=await db.query('SELECT 1 FROM chatbot_flow_comments WHERE tenant_id=$1 AND bot_id=$2 AND id=$3',[a.tenantId,bot,before]);if(!c.rowCount)throw new HttpFailure(400,'Comment cursor unavailable')}
 const draft=await snapshot(db,a,scope),policy=await db.query('SELECT required FROM chatbot_flow_review_policies WHERE tenant_id=$1 AND bot_id=$2',[a.tenantId,bot]);
 const reviews=await db.query('SELECT id,draft_revision AS "draftRevision",requested_by AS "requestedBy",decided_by AS "decidedBy",status,note,created_at AS "createdAt" FROM chatbot_flow_reviews WHERE tenant_id=$1 AND bot_id=$2 ORDER BY created_at DESC,id DESC LIMIT 30',[a.tenantId,bot]);
 const comments=await db.query(`SELECT id,draft_revision AS "draftRevision",node_id AS "nodeId",parent_id AS "parentId",author_id AS "authorId",body,resolved_by AS "resolvedBy",created_at AS "createdAt" FROM chatbot_flow_comments WHERE tenant_id=$1 AND bot_id=$2${before?' AND (created_at,id)<(SELECT created_at,id FROM chatbot_flow_comments WHERE tenant_id=$1 AND bot_id=$2 AND id=$3)':''} ORDER BY created_at DESC,id DESC LIMIT 51`,before?[a.tenantId,bot,before]:[a.tenantId,bot]);
 return {required:Boolean(policy.rows[0]?.required),draftRevision:draft.draftRevision,definitionHash:definitionHash(draft.definition),reviews:reviews.rows,comments:comments.rows.slice(0,50),nextCursor:comments.rows.length>50?comments.rows[49].id:null};
}
export async function changeFlowReview(db:SqlClient,a:Actor,bot:string,scope:string|undefined,input:unknown){
 const d=input as {action?:unknown;expectedRevision?:unknown;required?:unknown;body?:unknown;nodeId?:unknown;parentId?:unknown;id?:unknown;decision?:unknown;note?:unknown;resolved?:unknown};
 if(!d||typeof d.action!=='string')throw new HttpFailure(400,'Invalid review action');
 allow(a,d.action==='POLICY'?['OWNER']:d.action==='COMMENT'?['OWNER','MANAGER','AGENT']:['OWNER','MANAGER']);
 // All authoring mutations/publication share this lock, so approval cannot race a save.
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[a.tenantId]);
 const draft=await snapshot(db,a,scope);if(!Number.isInteger(d.expectedRevision)||d.expectedRevision!==draft.draftRevision)throw new HttpFailure(409,'تغيرت المسودة؛ حدّث المراجعة أولًا.');
 let result:unknown;
 if(d.action==='POLICY'){
  if(typeof d.required!=='boolean')throw new HttpFailure(400,'Invalid policy');
  await db.query('INSERT INTO chatbot_flow_review_policies(tenant_id,bot_id,required,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,bot_id) DO UPDATE SET required=$3,updated_by=$4,updated_at=now()',[a.tenantId,bot,d.required,a.userId]);result={required:d.required};
 }else if(d.action==='COMMENT'){
  if(typeof d.body!=='string'||!d.body.trim()||d.body.length>1000||d.nodeId!==undefined&&(typeof d.nodeId!=='string'||!(draft.definition as any).nodes.some((n:any)=>n.id===d.nodeId))||d.parentId!==undefined&&!isUuid(d.parentId))throw new HttpFailure(400,'اكتب تعليقًا من 1 إلى 1000 حرف واختر خطوة موجودة.');
  if(d.parentId){const p=await db.query('SELECT node_id,draft_revision FROM chatbot_flow_comments WHERE tenant_id=$1 AND bot_id=$2 AND id=$3 AND parent_id IS NULL',[a.tenantId,bot,d.parentId]);if(!p.rowCount||p.rows[0].draft_revision!==draft.draftRevision||p.rows[0].node_id!==(d.nodeId??null))throw new HttpFailure(400,'Reply must belong to this revision and step')}
  const count=await db.query('SELECT count(*)::int n FROM chatbot_flow_comments WHERE tenant_id=$1 AND bot_id=$2',[a.tenantId,bot]);if(Number(count.rows[0].n)>=1000)throw new HttpFailure(409,'Comment history limit reached');
  result=(await db.query('INSERT INTO chatbot_flow_comments(tenant_id,bot_id,draft_revision,node_id,parent_id,author_id,body) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[a.tenantId,bot,draft.draftRevision,d.nodeId??null,d.parentId??null,a.userId,d.body.trim()])).rows[0];
 }else if(d.action==='RESOLVE'){
  if(!isUuid(d.id)||typeof d.resolved!=='boolean')throw new HttpFailure(400,'Invalid comment resolution');
  const r=await db.query('UPDATE chatbot_flow_comments SET resolved_by=$4,resolved_at=CASE WHEN $4::uuid IS NULL THEN NULL ELSE now() END WHERE tenant_id=$1 AND bot_id=$2 AND id=$3 AND parent_id IS NULL RETURNING id',[a.tenantId,bot,d.id,d.resolved?a.userId:null]);if(!r.rowCount)throw new HttpFailure(404,'Thread unavailable');result=r.rows[0];
 }else if(d.action==='REQUEST'){
  const r=await db.query("INSERT INTO chatbot_flow_reviews(tenant_id,bot_id,draft_revision,definition_hash,requested_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,bot_id,draft_revision) WHERE status='REQUESTED' DO UPDATE SET definition_hash=chatbot_flow_reviews.definition_hash RETURNING id",[a.tenantId,bot,draft.draftRevision,definitionHash(draft.definition),a.userId]);result=r.rows[0];
 }else if(d.action==='DECIDE'){
  if(!isUuid(d.id)||!['APPROVED','CHANGES_REQUESTED'].includes(String(d.decision))||typeof d.note!=='string'||d.note.length>1000||d.decision==='CHANGES_REQUESTED'&&!d.note.trim())throw new HttpFailure(400,'اختر قرارًا وأضف سبب طلب التعديلات.');
  const r=await db.query('SELECT * FROM chatbot_flow_reviews WHERE tenant_id=$1 AND bot_id=$2 AND id=$3 FOR UPDATE',[a.tenantId,bot,d.id]),row=r.rows[0];if(!row)throw new HttpFailure(404,'Review unavailable');
  const author=await db.query('SELECT updated_by FROM '+(scope?'chatbot_bot_drafts':'chatbot_flow_drafts')+' WHERE tenant_id=$1'+(scope?' AND bot_id=$2':''),scope?[a.tenantId,scope]:[a.tenantId]);
  if(row.requested_by===a.userId||author.rows[0]?.updated_by===a.userId)throw new HttpFailure(403,'لا يمكنك اعتماد تعديلاتك بنفسك.');
  if(row.draft_revision!==draft.draftRevision||row.definition_hash!==definitionHash(draft.definition))throw new HttpFailure(409,'المراجعة تخص مسودة قديمة.');
  if(row.status!=='REQUESTED'){if(row.status===d.decision&&row.decided_by===a.userId&&row.note===d.note)return {id:row.id,replayed:true};throw new HttpFailure(409,'حُسمت هذه المراجعة بالفعل.');}
  await db.query('UPDATE chatbot_flow_reviews SET status=$4,note=$5,decided_by=$6,decided_at=now() WHERE tenant_id=$1 AND bot_id=$2 AND id=$3',[a.tenantId,bot,d.id,d.decision,d.note,a.userId]);result={id:d.id};
 }else throw new HttpFailure(400,'Unknown review action');
 await audit(db,a,bot,'FLOW_REVIEW_'+d.action);return result;
}
