/** Additional sales workspace services. Every handler must run inside a tenant transaction. */
import { allow, HttpFailure, isUuid, type Actor, type SqlClient } from './services.js';

const staff = ['OWNER','MANAGER','AGENT','VIEWER'] as const;
const editors = ['OWNER','MANAGER','AGENT'] as const;
const managers = ['OWNER','MANAGER'] as const;
const phonePattern = /^\+?[0-9]{8,15}$/;
const contactStatuses = new Set(['NEW','QUALIFIED','CUSTOMER','ARCHIVED']);
const plain = (obj: unknown): Record<string,unknown> => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new HttpFailure(400,'Invalid data');
  return obj as Record<string,unknown>;
};
const field = (val: unknown, min: number, max: number, name: string): string => {
  if (typeof val !== 'string' || val.trim().length<min || val.trim().length>max) throw new HttpFailure(400,'Invalid '+name);
  return val.trim();
};
const day = (val: unknown, name: string): Date => {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(val)) throw new HttpFailure(400,'Invalid '+name);
  const date = new Date(val);
  if (!Number.isFinite(date.getTime())) throw new HttpFailure(400,'Invalid '+name);
  return date;
};
async function audit(db:SqlClient, actor:Actor, action:string, entity:string, id:string):Promise<void> {
  await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4,$5)`,
    [actor.tenantId,actor.userId,action,entity,id]);
}

export async function listContacts(db:SqlClient,actor:Actor) {
  allow(actor,staff);
  return (await db.query(`SELECT id,full_name,phone,email,source,status,created_at FROM contacts WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200`,[actor.tenantId])).rows;
}
export async function addContact(db:SqlClient,actor:Actor,input:unknown) {
  allow(actor,editors);
  const d=plain(input);
  const name=field(d.fullName,2,120,'customer name');
  const phone=field(d.phone,8,16,'phone');
  if (!phonePattern.test(phone)) throw new HttpFailure(400,'Invalid phone');
  const email=d.email===undefined||d.email===''?null:field(d.email,5,254,'email');
  if (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpFailure(400,'Invalid email');
  const r=await db.query(`INSERT INTO contacts(tenant_id,full_name,phone,email) VALUES($1,$2,$3,$4)
    RETURNING id,full_name,phone,email,source,status,created_at`,[actor.tenantId,name,phone,email]);
  await audit(db,actor,'CONTACT_CREATED','contact',String(r.rows[0].id));
  return r.rows[0];
}
export async function setContactStatus(db:SqlClient,actor:Actor,id:string,input:unknown) {
  allow(actor,editors);
  if(!isUuid(id))throw new HttpFailure(400,'Invalid contact ID');
  const status=plain(input).status;
  if(!contactStatuses.has(status as string))throw new HttpFailure(400,'Invalid contact status');
  const r=await db.query(`UPDATE contacts SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING id,status`,[actor.tenantId,id,status]);
  if(r.rowCount!==1)throw new HttpFailure(404,'Contact not found');
  await audit(db,actor,'CONTACT_STATUS_CHANGED','contact',id);
  return r.rows[0];
}
export async function listContactNotes(db:SqlClient,actor:Actor,contactId:string) {
  allow(actor,staff);
  if(!isUuid(contactId))throw new HttpFailure(400,'Invalid contact ID');
  const c=await db.query(`SELECT id FROM contacts WHERE tenant_id=$1 AND id=$2`,[actor.tenantId,contactId]);
  if(c.rowCount!==1)throw new HttpFailure(404,'Contact not found');
  return (await db.query(`SELECT n.id,n.body,n.created_at,u.email AS author FROM contact_notes n JOIN users u ON u.id=n.author_id
    WHERE n.tenant_id=$1 AND n.contact_id=$2 ORDER BY n.created_at DESC LIMIT 100`,[actor.tenantId,contactId])).rows;
}
export async function addContactNote(db:SqlClient,actor:Actor,contactId:string,input:unknown) {
  allow(actor,editors);
  if(!isUuid(contactId))throw new HttpFailure(400,'Invalid contact ID');
  const body=field(plain(input).body,1,2000,'note');
  const r=await db.query(`INSERT INTO contact_notes(tenant_id,contact_id,author_id,body)
    VALUES($1,$2,$3,$4) RETURNING id,body,created_at`,[actor.tenantId,contactId,actor.userId,body]);
  await audit(db,actor,'CONTACT_NOTE_ADDED','contact',contactId);
  return r.rows[0];
}
export async function getSummary(db:SqlClient,actor:Actor) {
 allow(actor,staff);
 return (await db.query(`SELECT
 (SELECT count(*)::int FROM chatbot_catalog_items WHERE tenant_id=$1 AND status='PUBLISHED') AS published_items,
 (SELECT count(*)::int FROM contacts WHERE tenant_id=$1) AS contacts,
 (SELECT count(*)::int FROM conversations WHERE tenant_id=$1 AND status!='CLOSED') AS open_conversations,
 (SELECT count(*)::int FROM chatbot_leads WHERE tenant_id=$1 AND stage='READY_FOR_AGENT') AS ready_leads`,[actor.tenantId])).rows[0];
}
