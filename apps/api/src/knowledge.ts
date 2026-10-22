/** Explicitly approved, tenant-scoped FAQ answers. No model may invent prices or bookings. */
import { allow, HttpFailure, isUuid, type Actor, type SqlClient } from './services.js';
const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
export function normalizeQuestion(text:string){return text.toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N} ]/gu,' ').replace(/\s+/g,' ').trim();}
export async function listKnowledge(db:SqlClient,actor:Actor){allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);return (await db.query(`SELECT id,question,answer,status,updated_at FROM tenant_knowledge_articles WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 300`,[actor.tenantId])).rows;}
export async function createKnowledge(db:SqlClient,actor:Actor,input:unknown){allow(actor,['OWNER','MANAGER']);const d=obj(input),question=typeof d.question==='string'?d.question.trim():'',answer=typeof d.answer==='string'?d.answer.trim():'';
 if(question.length<5||question.length>300||answer.length<5||answer.length>2000)throw new HttpFailure(400,'Invalid question or answer');
 const r=await db.query(`INSERT INTO tenant_knowledge_articles(tenant_id,question,answer,created_by) VALUES($1,$2,$3,$4) RETURNING id,question,answer,status`,[actor.tenantId,question,answer,actor.userId]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'FAQ_DRAFT_CREATED','faq',$3)`,[actor.tenantId,actor.userId,r.rows[0].id]);return r.rows[0];
}
export async function updateKnowledgeDraft(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER']);
 if(!isUuid(id))throw new HttpFailure(400,'Invalid FAQ id');
 const d=obj(input),question=typeof d.question==='string'?d.question.trim():'',answer=typeof d.answer==='string'?d.answer.trim():'';
 if(question.length<5||question.length>300||answer.length<5||answer.length>2000)throw new HttpFailure(400,'Invalid question or answer');
 const r=await db.query(`UPDATE tenant_knowledge_articles SET question=$3,answer=$4,updated_at=now()
 WHERE tenant_id=$1 AND id=$2 AND status='DRAFT' RETURNING id,question,answer,status`,
 [actor.tenantId,id,question,answer]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Editable draft FAQ not found');
 await db.query("INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'FAQ_DRAFT_UPDATED','faq',$3)",[actor.tenantId,actor.userId,id]);
 return r.rows[0];
}
export async function publishKnowledge(db:SqlClient,actor:Actor,id:string){allow(actor,['OWNER','MANAGER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid FAQ id');
 const r=await db.query(`UPDATE tenant_knowledge_articles SET status='PUBLISHED',published_by=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND status IN ('DRAFT','PUBLISHED') RETURNING id,status`,[actor.tenantId,id,actor.userId]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Draft FAQ not found');await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'FAQ_PUBLISHED','faq',$3)`,[actor.tenantId,actor.userId,id]);return r.rows[0];
}
export async function findApprovedAnswer(db:SqlClient,tenantId:string,incoming:string):Promise<string|null>{
 const question=normalizeQuestion(incoming);if(question.length<5||question.length>300)return null;
 const r=await db.query(`SELECT question,answer FROM tenant_knowledge_articles WHERE tenant_id=$1 AND status='PUBLISHED' ORDER BY updated_at DESC LIMIT 300`,[tenantId]);
 const exact=r.rows.find(x=>normalizeQuestion(String(x.question))===question);return exact?String(exact.answer):null;
}