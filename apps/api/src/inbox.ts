import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
export async function savedReplies(db:SqlClient,actor:Actor){allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);return (await db.query('SELECT id,title,body FROM chatbot_saved_replies WHERE tenant_id=$1 ORDER BY title LIMIT 200',[actor.tenantId])).rows}
export async function createSavedReply(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);const d=input as {title?:unknown;body?:unknown};
 if(!d||typeof d.title!=='string'||!d.title.trim()||d.title.length>100||typeof d.body!=='string'||!d.body.trim()||d.body.length>2000)throw new HttpFailure(400,'Invalid reply');
 return (await db.query('INSERT INTO chatbot_saved_replies(tenant_id,title,body) VALUES($1,$2,$3) RETURNING id,title,body',[actor.tenantId,d.title.trim(),d.body.trim()])).rows[0];
}
export async function deleteSavedReply(db:SqlClient,actor:Actor,id:string){allow(actor,['OWNER','MANAGER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid reply');await db.query('DELETE FROM chatbot_saved_replies WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id]);return {deleted:true}}
export async function inboxNote(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER','AGENT']);if(!isUuid(id))throw new HttpFailure(400,'Invalid conversation');const d=input as {body?:unknown};
 if(!d||typeof d.body!=='string'||!d.body.trim()||d.body.length>2000)throw new HttpFailure(400,'Invalid note');
 const found=await db.query('SELECT id FROM conversations WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id]);if(!found.rowCount)throw new HttpFailure(404,'Conversation not found');
 return (await db.query(`INSERT INTO conversation_messages(tenant_id,conversation_id,author_id,kind,body) VALUES($1,$2,$3,'INTERNAL_NOTE',$4) RETURNING id,body,kind`,[actor.tenantId,id,actor.userId,d.body.trim()])).rows[0];
}
