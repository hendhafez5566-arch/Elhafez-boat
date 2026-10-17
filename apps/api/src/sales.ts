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
export async function listOffers(db:SqlClient,actor:Actor) {
  allow(actor,staff);
  return (await db.query(`SELECT o.id,o.program_id,p.title AS program_title,o.title,o.details,o.starts_at,o.ends_at,o.status
    FROM offers o JOIN programs p ON p.tenant_id=o.tenant_id AND p.id=o.program_id
    WHERE o.tenant_id=$1 ORDER BY o.created_at DESC LIMIT 200`,[actor.tenantId])).rows;
}
export async function addOffer(db:SqlClient,actor:Actor,input:unknown) {
  allow(actor,managers);
  const d=plain(input);
  if(!isUuid(d.programId))throw new HttpFailure(400,'Invalid program ID');
  const title=field(d.title,2,160,'offer title');
  const details=d.details===undefined||d.details===''?'':field(d.details,1,2000,'details');
  const start=day(d.startsAt,'offer start');
  const end=day(d.endsAt,'offer end');
  if(end<=start)throw new HttpFailure(400,'Offer end must follow start');
  const p=await db.query(`SELECT id FROM programs WHERE tenant_id=$1 AND id=$2 AND status!='ARCHIVED'`,[actor.tenantId,d.programId]);
  if(p.rowCount!==1)throw new HttpFailure(404,'Program not found');
  const r=await db.query(`INSERT INTO offers(tenant_id,program_id,title,details,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6)
    RETURNING id,program_id,title,details,starts_at,ends_at,status`,[actor.tenantId,d.programId,title,details,start.toISOString(),end.toISOString()]);
  await audit(db,actor,'OFFER_CREATED','offer',String(r.rows[0].id));
  return r.rows[0];
}
export async function publishOffer(db:SqlClient,actor:Actor,id:string) {
  allow(actor,managers);
  if(!isUuid(id))throw new HttpFailure(400,'Invalid offer ID');
  const r=await db.query(`UPDATE offers o SET status='PUBLISHED' FROM programs p
    WHERE o.tenant_id=$1 AND o.id=$2 AND o.status IN ('DRAFT','PUBLISHED')
      AND p.tenant_id=o.tenant_id AND p.id=o.program_id AND p.status='PUBLISHED'
      AND o.ends_at>now() RETURNING o.id,o.status`,[actor.tenantId,id]);
  if(r.rowCount!==1)throw new HttpFailure(409,'Offer or program not publishable');
  await audit(db,actor,'OFFER_PUBLISHED','offer',id);
  return r.rows[0];
}
export async function listFollowups(db:SqlClient,actor:Actor) {
  allow(actor,staff);
  return (await db.query(`SELECT f.id,f.title,f.due_at,f.status,f.contact_id,c.full_name AS customer_name
    FROM followup_tasks f JOIN contacts c ON c.tenant_id=f.tenant_id AND c.id=f.contact_id
    WHERE f.tenant_id=$1 ORDER BY CASE WHEN f.status='OPEN' THEN 0 ELSE 1 END,f.due_at ASC LIMIT 200`,[actor.tenantId])).rows;
}
export async function addFollowup(db:SqlClient,actor:Actor,input:unknown) {
  allow(actor,editors);
  const d=plain(input);
  if(!isUuid(d.contactId))throw new HttpFailure(400,'Invalid contact ID');
  const title=field(d.title,2,160,'task title');
  const due=day(d.dueAt,'due date');
  const r=await db.query(`INSERT INTO followup_tasks(tenant_id,contact_id,assigned_user_id,title,due_at)
    VALUES($1,$2,$3,$4,$5) RETURNING id,contact_id,title,due_at,status`,[actor.tenantId,d.contactId,actor.userId,title,due.toISOString()]);
  await audit(db,actor,'FOLLOWUP_CREATED','followup',String(r.rows[0].id));
  return r.rows[0];
}
export async function completeFollowup(db:SqlClient,actor:Actor,id:string) {
  allow(actor,editors);
  if(!isUuid(id))throw new HttpFailure(400,'Invalid task ID');
  const r=await db.query(`UPDATE followup_tasks SET status='DONE'
    WHERE tenant_id=$1 AND id=$2 AND status='OPEN' AND (assigned_user_id=$3 OR $4::boolean)
    RETURNING id,status`,[actor.tenantId,id,actor.userId,actor.role==='OWNER'||actor.role==='MANAGER']);
  if(r.rowCount!==1)throw new HttpFailure(404,'Open task not found or not assigned');
  await audit(db,actor,'FOLLOWUP_COMPLETED','followup',id);
  return r.rows[0];
}
/** Staff-only internal thread; never sends a WhatsApp message. */
export async function listConversations(db:SqlClient,actor:Actor) {
  allow(actor,staff);
  return (await db.query(`SELECT v.id,v.contact_id,c.full_name,c.phone,v.channel,v.status,v.assigned_user_id,v.last_message_at
    FROM conversations v JOIN contacts c ON c.tenant_id=v.tenant_id AND c.id=v.contact_id
    WHERE v.tenant_id=$1 ORDER BY COALESCE(v.last_message_at,v.created_at) DESC LIMIT 200`,[actor.tenantId])).rows;
}
export async function createInternalConversation(db:SqlClient,actor:Actor,input:unknown) {
  allow(actor,editors);
  const contactId=plain(input).contactId;
  if(!isUuid(contactId))throw new HttpFailure(400,'Invalid contact ID');
  const c=await db.query(`SELECT id FROM contacts WHERE tenant_id=$1 AND id=$2`,[actor.tenantId,contactId]);
  if(c.rowCount!==1)throw new HttpFailure(404,'Contact not found');
  const r=await db.query(`INSERT INTO conversations(tenant_id,contact_id,assigned_user_id,channel,status)
    VALUES($1,$2,$3,'INTERNAL','HUMAN') RETURNING id,contact_id,channel,status`,[actor.tenantId,contactId,actor.userId]);
  await audit(db,actor,'THREAD_CREATED','conversation',String(r.rows[0].id));
  return r.rows[0];
}
export async function listInternalMessages(db:SqlClient,actor:Actor,id:string) {
  allow(actor,staff);
  if(!isUuid(id))throw new HttpFailure(400,'Invalid conversation ID');
  const v=await db.query(`SELECT id,channel FROM conversations WHERE tenant_id=$1 AND id=$2`,[actor.tenantId,id]);
  if(v.rowCount!==1)throw new HttpFailure(404,'Conversation not found');
  return (await db.query(`SELECT m.id,m.kind,m.body,m.created_at,u.email AS author
    FROM conversation_messages m LEFT JOIN users u ON u.id=m.author_id
    WHERE m.tenant_id=$1 AND m.conversation_id=$2 ORDER BY m.created_at ASC LIMIT 300`,[actor.tenantId,id])).rows;
}
export async function addInternalMessage(db:SqlClient,actor:Actor,id:string,input:unknown) {
  allow(actor,editors);
  if(!isUuid(id))throw new HttpFailure(400,'Invalid conversation ID');
  const body=field(plain(input).body,1,4000,'internal note');
  const r=await db.query(`WITH updated AS (
    UPDATE conversations SET last_message_at=now() WHERE tenant_id=$1 AND id=$2 AND channel='INTERNAL' AND status!='CLOSED'
    RETURNING id)
    INSERT INTO conversation_messages(tenant_id,conversation_id,author_id,kind,body)
    SELECT $1,id,$3,'INTERNAL_NOTE',$4 FROM updated RETURNING id,kind,body,created_at`,
    [actor.tenantId,id,actor.userId,body]);
  if(r.rowCount!==1)throw new HttpFailure(404,'Open internal conversation not found');
  await audit(db,actor,'INTERNAL_NOTE_ADDED','conversation',id);
  return r.rows[0];
}
export async function getSummary(db:SqlClient,actor:Actor) {
  allow(actor,staff);
  const r=await db.query(`SELECT
    (SELECT count(*)::int FROM programs WHERE tenant_id=$1 AND status='PUBLISHED') AS published_programs,
    (SELECT count(*)::int FROM programs WHERE tenant_id=$1 AND status='DRAFT') AS draft_programs,
    (SELECT count(*)::int FROM booking_requests WHERE tenant_id=$1 AND status='PENDING_REVIEW') AS pending_bookings,
    (SELECT count(*)::int FROM booking_requests WHERE tenant_id=$1 AND status='CONFIRMED') AS confirmed_bookings,
    (SELECT count(*)::int FROM contacts WHERE tenant_id=$1) AS contacts,
    (SELECT count(*)::int FROM followup_tasks WHERE tenant_id=$1 AND status='OPEN') AS open_tasks,
    (SELECT count(*)::int FROM offers WHERE tenant_id=$1 AND status='PUBLISHED' AND now() BETWEEN starts_at AND ends_at) AS active_offers,
    (SELECT count(*)::int FROM conversations WHERE tenant_id=$1 AND status!='CLOSED') AS open_conversations`,[actor.tenantId]);
  return r.rows[0];
}