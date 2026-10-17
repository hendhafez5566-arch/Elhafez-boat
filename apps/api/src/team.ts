import { randomBytes } from 'node:crypto';
import { allow, HttpFailure, isUuid, type Actor, type SqlClient, type SqlPool } from './services.js';
import { tokenDigest, passwordHash, verifyPassword } from './auth.js';
const roles=['MANAGER','AGENT','VIEWER'];
const mailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const obj=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};

export async function createTeamInvite(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);const d=obj(input),email=typeof d.email==='string'?d.email.trim().toLowerCase():'',role=d.role;
 if(email.length>254||!mailPattern.test(email)||!roles.includes(role as string))throw new HttpFailure(400,'Invalid invitation');
 if(actor.role==='MANAGER'&&role==='MANAGER')throw new HttpFailure(403,'Only owner invites managers');
 const seats=await db.query(`SELECT coalesce(p.max_staff,3) AS max_staff FROM tenants t
 LEFT JOIN tenant_subscriptions s ON s.tenant_id=t.id
 LEFT JOIN subscription_plans p ON p.code=s.plan_code WHERE t.id=$1`,[actor.tenantId]);
 const limit=Number(seats.rows[0]?.max_staff??3);
 const count=await db.query(`SELECT count(*) AS total FROM memberships WHERE tenant_id=$1`,[actor.tenantId]);
 const pending=await db.query(`SELECT count(*) AS total FROM team_invitations WHERE tenant_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()`,[actor.tenantId]);
 if(Number(count.rows[0].total)+Number(pending.rows[0].total)>=limit)throw new HttpFailure(409,'Staff seats limit reached');
 const exists=await db.query(`SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=$1 AND lower(u.email)=$2`,[actor.tenantId,email]);
 if(exists.rowCount)throw new HttpFailure(409,'This email is already a company member');
 const token=randomBytes(32).toString('base64url'),digest=tokenDigest(token);
 const r=await db.query(`INSERT INTO team_invitations(tenant_id,invited_email,role,token_hash,expires_at,created_by)
 VALUES($1,$2,$3,$4,now()+interval '48 hours',$5) RETURNING id,invited_email,role,expires_at`,[actor.tenantId,email,role,digest,actor.userId]);
 await db.query(`INSERT INTO invitation_lookup(token_hash,tenant_id,invitation_id) VALUES($1,$2,$3)`,[digest,actor.tenantId,r.rows[0].id]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'TEAM_INVITED','invitation',$3)`,[actor.tenantId,actor.userId,r.rows[0].id]);
 // Token returned ONCE. Email delivery intentionally not claimed: owner shares invitation out of band.
 return {...r.rows[0],inviteToken:token,delivery:'MANUAL_SECURE_SHARE'};
}
export async function listTeamInvitations(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER']);return (await db.query(`SELECT id,invited_email AS email,role,expires_at AS "expiresAt",created_at AS "createdAt",
  CASE WHEN accepted_at IS NOT NULL THEN 'ACCEPTED' WHEN revoked_at IS NOT NULL THEN 'REVOKED' WHEN expires_at<=now() THEN 'EXPIRED' ELSE 'PENDING' END AS status
 FROM team_invitations WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100`,[actor.tenantId])).rows;
}
export async function revokeTeamInvite(db:SqlClient,actor:Actor,id:string){
 allow(actor,['OWNER','MANAGER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid invitation ID');
 const r=await db.query(`UPDATE team_invitations SET revoked_at=now() WHERE tenant_id=$1 AND id=$2 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id`,[actor.tenantId,id]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Active invitation not found');
 await db.query(`DELETE FROM invitation_lookup WHERE tenant_id=$1 AND invitation_id=$2`,[actor.tenantId,id]);
 return {revoked:true};
}
export async function updateTeamRole(db:SqlClient,actor:Actor,userId:string,input:unknown){
 allow(actor,['OWNER']);if(!isUuid(userId)||userId===actor.userId)throw new HttpFailure(400,'Cannot modify own role');
 const role=obj(input).role;if(!roles.includes(role as string))throw new HttpFailure(400,'Invalid role');
 const r=await db.query(`UPDATE memberships SET role=$3 WHERE tenant_id=$1 AND user_id=$2 AND role!='OWNER' RETURNING user_id,role`,[actor.tenantId,userId,role]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Editable team member not found');
 await db.query(`DELETE FROM sessions WHERE tenant_id=$1 AND user_id=$2`,[actor.tenantId,userId]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'TEAM_ROLE_UPDATED','user',$3)`,[actor.tenantId,actor.userId,userId]);return r.rows[0];
}
export async function acceptTeamInvite(pool:SqlPool&SqlClient,input:unknown){
 const d=obj(input),token=d.token,email=typeof d.email==='string'?d.email.trim().toLowerCase():'',password=d.password;
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||!mailPattern.test(email)||typeof password!=='string'||password.length<12||password.length>256)
  throw new HttpFailure(400,'Invalid invitation credentials');
 const digest=tokenDigest(token);
 // The unprotected routing table exposes only HMAC-like token digests and tenant IDs, never PII.
 const lookup=await pool.query(`SELECT tenant_id,invitation_id FROM invitation_lookup WHERE token_hash=$1`,[digest]);
 if(lookup.rowCount!==1)throw new HttpFailure(404,'Invitation not found');
 const tenantId=String(lookup.rows[0].tenant_id);
 const tx=await pool.connect();let began=false;
 try{
  await tx.query('BEGIN');began=true;await tx.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]);
  const row=await tx.query(`SELECT * FROM team_invitations WHERE tenant_id=$1 AND id=$2 AND token_hash=$3 AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at>now() FOR UPDATE`,[tenantId,lookup.rows[0].invitation_id,digest]);
  if(row.rowCount!==1||row.rows[0].invited_email!==email)throw new HttpFailure(404,'Invalid or expired invitation');
  const user=await tx.query(`SELECT id,password_hash FROM users WHERE lower(email)=$1`,[email]);let userId:string;
  if(user.rowCount){if(!await verifyPassword(password,String(user.rows[0].password_hash)))throw new HttpFailure(401,'Existing account password is incorrect');userId=String(user.rows[0].id);}
  else{const hash=await passwordHash(password);const created=await tx.query(`INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id`,[email,hash]);userId=String(created.rows[0].id);}
  const m=await tx.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id`,[tenantId,userId,row.rows[0].role]);
  if(m.rowCount!==1)throw new HttpFailure(409,'User already has membership');
  await tx.query(`UPDATE team_invitations SET accepted_at=now() WHERE tenant_id=$1 AND id=$2`,[tenantId,row.rows[0].id]);
  await tx.query(`DELETE FROM invitation_lookup WHERE tenant_id=$1 AND invitation_id=$2`,[tenantId,row.rows[0].id]);
  await tx.query('COMMIT');return {accepted:true,loginRequired:true};
 }catch(e){if(began)await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
}