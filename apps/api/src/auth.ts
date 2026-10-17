import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Actor, SqlClient, Role } from './services.js';
import { HttpFailure } from './services.js';
const scrypt=promisify(scryptCallback);
const MAX_TOKEN_AGE_HOURS=12;
export async function passwordHash(password:string):Promise<string>{
  if(typeof password!=='string'||password.length<12||password.length>256)throw new HttpFailure(400,'Password must be 12-256 characters');
  const salt=randomBytes(16).toString('hex');
  const digest=await scrypt(password,salt,64) as Buffer;
  return 'scrypt:'+salt+':'+digest.toString('hex');
}
export async function verifyPassword(password:string,stored:string):Promise<boolean>{
  if(typeof password!=='string'||password.length>256||typeof stored!=='string')return false;
  const parts=stored.split(':');
  if(parts.length!==3||parts[0]!=='scrypt'||!/^[a-f0-9]{32}$/.test(parts[1])||!/^[a-f0-9]{128}$/.test(parts[2]))return false;
  const actual=await scrypt(password,parts[1],64) as Buffer;
  const expected=Buffer.from(parts[2],'hex');
  return timingSafeEqual(actual,expected);
}
export function tokenDigest(token:string):string{return createHash('sha256').update(token).digest('hex')}
export async function login(db:SqlClient,input:unknown):Promise<{token:string;role:Role;expiresAt:string}>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new HttpFailure(400,'Invalid credentials');
  const d=input as Record<string,unknown>;
  if(typeof d.tenantSlug!=='string'||typeof d.email!=='string'||typeof d.password!=='string'||d.password.length>256||d.email.length>254||d.tenantSlug.length>120)throw new HttpFailure(400,'Invalid credentials');
  const found=await db.query(`SELECT t.id AS tenant_id,u.id AS user_id,u.password_hash,m.role FROM tenants t
    JOIN memberships m ON m.tenant_id=t.id JOIN users u ON u.id=m.user_id
    WHERE t.slug=$1 AND lower(u.email)=lower($2)`,[d.tenantSlug.trim(),d.email.trim()]);
  if(found.rowCount!==1||!(await verifyPassword(d.password,found.rows[0].password_hash as string)))throw new HttpFailure(401,'Invalid credentials');
  const user=found.rows[0];
  const token=randomBytes(32).toString('base64url');
  const expiresAt=new Date(Date.now()+MAX_TOKEN_AGE_HOURS*3600_000).toISOString();
  await db.query(`INSERT INTO sessions(token_hash,tenant_id,user_id,expires_at) VALUES($1,$2,$3,$4)`,
    [tokenDigest(token),user.tenant_id,user.user_id,expiresAt]);
  return {token,role:user.role as Role,expiresAt};
}
export async function authenticate(db:SqlClient,authorization:unknown):Promise<Actor>{
  if(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))throw new HttpFailure(401,'Authentication required');
  const token=authorization.slice(7);
  const found=await db.query(`SELECT s.tenant_id,s.user_id,m.role FROM sessions s
    JOIN memberships m ON m.tenant_id=s.tenant_id AND m.user_id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now()`,[tokenDigest(token)]);
  if(found.rowCount!==1)throw new HttpFailure(401,'Invalid or expired session');
  const row=found.rows[0];
  return {tenantId:row.tenant_id as string,userId:row.user_id as string,role:row.role as Role};
}
export async function logout(db:SqlClient,authorization:unknown):Promise<void>{
  if(typeof authorization==='string'&&/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))
    await db.query('DELETE FROM sessions WHERE token_hash=$1',[tokenDigest(authorization.slice(7))]);
}