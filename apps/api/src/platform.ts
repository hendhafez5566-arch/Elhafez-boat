/** Strictly isolated platform-owner management, not tenant dashboard authorization. */
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { passwordHash, tokenDigest, verifyPassword } from './auth.js';
import { HttpFailure, type SqlClient } from './services.js';
const require=createRequire(import.meta.url);
type Pool=SqlClient&{on(event:string,listener:(error:{code?:string})=>void):void;connect():Promise<SqlClient&{release():void}>};
let ownedPool:Pool|undefined;
function adminPool():Pool {
 if(ownedPool)return ownedPool;
 const url=process.env.PLATFORM_DATABASE_URL;
 if(!url)throw new HttpFailure(503,'Platform admin database is not configured');
 const {Pool}=require('pg') as {Pool:new(o:{connectionString:string;max:number})=>Pool};
 ownedPool=new Pool({connectionString:url,max:3});
 ownedPool.on('error',error=>console.error('Platform database connection lost',{code:error.code||'DB_CONNECTION_LOST'}));
 return ownedPool;
}
const object=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function platformLogin(input:unknown){
 const d=object(input),email=typeof d.email==='string'?d.email.trim().toLowerCase():'',password=d.password;
 if(!emailPattern.test(email)||email.length>254||typeof password!=='string'||password.length>256)throw new HttpFailure(400,'Invalid login');
 const db=adminPool(),r=await db.query(`SELECT id,password_hash FROM platform_owners WHERE lower(email)=$1`,[email]);
 if(r.rowCount!==1||!await verifyPassword(password,String(r.rows[0].password_hash)))throw new HttpFailure(401,'Invalid login');
 const token=randomBytes(32).toString('base64url');await db.query(`INSERT INTO platform_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '8 hours')`,[tokenDigest(token),r.rows[0].id]);
 return {token,role:'PLATFORM_OWNER',expiresInHours:8};
}
export async function platformAuth(authorization:unknown):Promise<string>{
 if(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))throw new HttpFailure(401,'Platform authentication required');
 const db=adminPool(),r=await db.query(`SELECT owner_id FROM platform_sessions WHERE token_hash=$1 AND expires_at>now()`,[tokenDigest(authorization.slice(7))]);
 if(r.rowCount!==1)throw new HttpFailure(401,'Invalid platform session');return String(r.rows[0].owner_id);
}
export async function platformLogout(auth:unknown){if(typeof auth==='string'&&/^Bearer [A-Za-z0-9_-]{43}$/.test(auth))await adminPool().query(`DELETE FROM platform_sessions WHERE token_hash=$1`,[tokenDigest(auth.slice(7))]);return {ok:true};}
export async function platformTenants(ownerId:string){
 const r=await adminPool().query(`SELECT t.id,t.slug,t.name,t.created_at,s.plan_code,s.status AS subscription_status,s.current_period_ends_at,
 (SELECT count(*) FROM memberships m WHERE m.tenant_id=t.id)::integer AS staff_count,
 (SELECT daily_inbound FROM chatbot_usage_limits l WHERE l.tenant_id=t.id) AS daily_inbound_limit,
 (SELECT daily_templates FROM chatbot_usage_limits l WHERE l.tenant_id=t.id) AS daily_template_limit,
 (SELECT media_bytes::text FROM chatbot_usage_limits l WHERE l.tenant_id=t.id) AS media_limit,
 (SELECT count(*) FROM chatbot_catalog_items p WHERE p.tenant_id=t.id)::integer AS catalog_count,
 (SELECT coalesce(inbound,0) FROM chatbot_usage u WHERE u.tenant_id=t.id AND day=CURRENT_DATE) AS daily_inbound_used,
 (SELECT coalesce(templates,0) FROM chatbot_usage u WHERE u.tenant_id=t.id AND day=CURRENT_DATE) AS daily_templates_used
 FROM tenants t LEFT JOIN tenant_subscriptions s ON s.tenant_id=t.id ORDER BY t.created_at DESC LIMIT 500`);
 return r.rows;
}
export async function platformPlans(ownerId:string){return (await adminPool().query(`SELECT code,title,monthly_price_minor::text AS price_minor,currency,max_staff,max_programs,active FROM subscription_plans ORDER BY max_staff`)).rows;}
export async function createTenant(ownerId:string,input:unknown){
 const d=object(input),name=typeof d.name==='string'?d.name.trim():'',slug=typeof d.slug==='string'?d.slug.trim().toLowerCase():'',email=typeof d.ownerEmail==='string'?d.ownerEmail.trim().toLowerCase():'',plan=typeof d.planCode==='string'?d.planCode:'STARTER';
 if(name.length<2||name.length>120||!/^[a-z0-9][a-z0-9-]{2,60}$/.test(slug)||!emailPattern.test(email)||email.length>254||!/^[A-Z0-9_]{3,30}$/.test(plan))throw new HttpFailure(400,'Invalid company');
 const db=adminPool(),tx=await db.connect();let begun=false;
 try{
  await tx.query('BEGIN');begun=true;
  const t=await tx.query(`INSERT INTO tenants(slug,name) VALUES($1,$2) RETURNING id,slug,name`,[slug,name]);const tenant=t.rows[0];
  await tx.query(`INSERT INTO tenant_subscriptions(tenant_id,plan_code,status,current_period_ends_at) VALUES($1,$2,'TRIAL',now()+interval '14 days')`,[tenant.id,plan]);
  // Provision an owner invitation, never a plaintext password chosen by platform admin.
  const digestToken=randomBytes(32).toString('base64url'),digest=tokenDigest(digestToken);
  // Platform admin role is a dedicated database connection with narrowly privileged BYPASSRLS access.
  await tx.query(`INSERT INTO tenant_owner_invites(tenant_id,invited_email,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '7 days')`,[tenant.id,email,digest]);
  await tx.query(`INSERT INTO platform_audit_events(owner_id,action,tenant_id) VALUES($1,'TENANT_CREATED',$2)`,[ownerId,tenant.id]);
  await tx.query('COMMIT');return {...tenant,planCode:plan,ownerInviteToken:digestToken,manualDelivery:true};
 }catch(e){if(begun)await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
}
export async function updateSubscription(ownerId:string,id:string,input:unknown){
 const d=object(input),status=d.status,plan=d.planCode,ends=d.endsAt;
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)||!['TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED'].includes(status as string)||typeof plan!=='string'||!/^[A-Z0-9_]{3,30}$/.test(plan)||typeof ends!=='string'||!Number.isFinite(Date.parse(ends)))throw new HttpFailure(400,'Invalid subscription');
 const db=adminPool(),tx=await db.connect();let begun=false;
 try{await tx.query('BEGIN');begun=true;
 const r=await tx.query(`INSERT INTO tenant_subscriptions(tenant_id,plan_code,status,current_period_ends_at) VALUES($1,$2,$3,$4)
 ON CONFLICT(tenant_id) DO UPDATE SET plan_code=EXCLUDED.plan_code,status=EXCLUDED.status,current_period_ends_at=EXCLUDED.current_period_ends_at,updated_at=now() RETURNING tenant_id,plan_code,status,current_period_ends_at`,[id,plan,status,new Date(ends).toISOString()]);
 if(!['TRIAL','ACTIVE'].includes(String(status)) || new Date(ends).getTime()<=Date.now()){
   // Paid account suspension must not silently send already queued outbound messages on later reactivation.
   await tx.query("UPDATE chatbot_delay_jobs SET status='CANCELLED' WHERE tenant_id=$1 AND status='PENDING'",[id]);
   await tx.query("UPDATE chatbot_campaigns SET status='CANCELLED' WHERE tenant_id=$1 AND status='ACTIVE'",[id]);
   await tx.query(`UPDATE whatsapp_outbox SET status='FAILED',last_error='Subscription is not active'
     WHERE tenant_id=$1 AND status='PENDING'`,[id]);
 }
 await tx.query(`INSERT INTO platform_audit_events(owner_id,action,tenant_id) VALUES($1,'SUBSCRIPTION_UPDATED',$2)`,[ownerId,id]);
 await tx.query('COMMIT');return r.rows[0];
 }catch(e){if(begun)await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
}
export async function acceptFirstOwner(input:unknown){
 const d=object(input),token=d.token,email=typeof d.email==='string'?d.email.trim().toLowerCase():'',password=d.password;
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||!emailPattern.test(email)||typeof password!=='string'||password.length<12||password.length>256)throw new HttpFailure(400,'Invalid owner invitation');
 const db=adminPool(),tx=await db.connect();let began=false;
 try{await tx.query('BEGIN');began=true;
 const row=await tx.query(`SELECT tenant_id,invited_email FROM tenant_owner_invites WHERE token_hash=$1 AND expires_at>now() AND accepted_at IS NULL FOR UPDATE`,[tokenDigest(token)]);
 if(row.rowCount!==1||row.rows[0].invited_email!==email)throw new HttpFailure(404,'Owner invitation is expired or invalid');
 const tenantId=String(row.rows[0].tenant_id);
 const prev=await tx.query(`SELECT id,password_hash FROM users WHERE lower(email)=$1`,[email]);let userId:string;
 if(prev.rowCount){if(!await verifyPassword(password,String(prev.rows[0].password_hash)))throw new HttpFailure(401,'Existing password incorrect');userId=String(prev.rows[0].id);}
 else{const hash=await passwordHash(password);userId=String((await tx.query(`INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id`,[email,hash])).rows[0].id);}
 await tx.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')`,[tenantId,userId]);
 await tx.query(`UPDATE tenant_owner_invites SET accepted_at=now() WHERE token_hash=$1`,[tokenDigest(token)]);
 await tx.query('COMMIT');return {accepted:true,loginRequired:true};
 }catch(e){if(began)await tx.query('ROLLBACK').catch(()=>{});throw e;}finally{tx.release();}
}
export async function platformUsageLimits(ownerId:string,id:string,input:unknown){
 const d=object(input);if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isInteger(d.dailyInbound)||Number(d.dailyInbound)<1||Number(d.dailyInbound)>1000000||!Number.isInteger(d.dailyTemplates)||Number(d.dailyTemplates)<1||Number(d.dailyTemplates)>100000||!Number.isInteger(d.mediaBytes)||Number(d.mediaBytes)<1||Number(d.mediaBytes)>10737418240)throw new HttpFailure(400,'Invalid usage limits');
 const tx=await adminPool().connect();try{await tx.query('BEGIN');await tx.query(`INSERT INTO chatbot_usage_limits(tenant_id,daily_inbound,daily_templates,media_bytes) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id) DO UPDATE SET daily_inbound=$2,daily_templates=$3,media_bytes=$4`,[id,d.dailyInbound,d.dailyTemplates,d.mediaBytes]);await tx.query(`INSERT INTO platform_audit_events(owner_id,action,tenant_id) VALUES($1,'USAGE_LIMITS_UPDATED',$2)`,[ownerId,id]);await tx.query('COMMIT');return {updated:true}}catch(e){await tx.query('ROLLBACK');throw e}finally{tx.release()}
}
