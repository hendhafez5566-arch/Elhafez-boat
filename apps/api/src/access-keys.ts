import {randomBytes,createHash} from 'node:crypto';
import {allow,HttpFailure,isUuid,withTenantTransaction,type Actor,type SqlClient,type SqlPool} from './services.js';
const digest=(key:string)=>createHash('sha256').update(key).digest('hex');
const scopes=['catalog:read','leads:read'];
export async function listAccessKeys(db:SqlClient,actor:Actor){allow(actor,['OWNER']);return (await db.query('SELECT id,name,scopes,expires_at,revoked_at FROM chatbot_access_keys WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100',[actor.tenantId])).rows}
export async function createAccessKey(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER']);const d=input as {name?:unknown;scopes?:unknown};if(!d||typeof d.name!=='string'||d.name.trim().length<2||d.name.length>100||!Array.isArray(d.scopes)||!d.scopes.length||d.scopes.some(s=>!scopes.includes(String(s))))throw new HttpFailure(400,'Invalid name or read scopes');
 const key='ebk_'+randomBytes(32).toString('base64url'),hash=digest(key);
 const r=await db.query(`INSERT INTO chatbot_access_keys(tenant_id,token_hash,name,scopes,created_by,expires_at) VALUES($1,$2,$3,$4::jsonb,$5,now()+interval '90 days') RETURNING id,name,expires_at`,[actor.tenantId,hash,d.name.trim(),JSON.stringify([...new Set(d.scopes)]),actor.userId]);
 await db.query('INSERT INTO chatbot_access_key_routes(token_hash,tenant_id,key_id) VALUES($1,$2,$3)',[hash,actor.tenantId,r.rows[0].id]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'ACCESS_KEY_CREATED','access_key',$3)`,[actor.tenantId,actor.userId,r.rows[0].id]);return {...r.rows[0],key};
}
export async function revokeAccessKey(db:SqlClient,actor:Actor,id:string){allow(actor,['OWNER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid key');await db.query('UPDATE chatbot_access_keys SET revoked_at=now() WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id]);return {revoked:true}}
export async function authenticateAccessKey(pool:SqlClient&SqlPool,authorization:string,path:string,method:string):Promise<Actor>{
 const key=authorization.replace(/^Bearer /,'');if(!/^ebk_[A-Za-z0-9_-]{43}$/.test(key))throw new HttpFailure(401,'Invalid API key');
 const route=await pool.query('SELECT tenant_id,key_id FROM chatbot_access_key_routes WHERE token_hash=$1',[digest(key)]);if(!route.rowCount)throw new HttpFailure(401,'Invalid API key');
 const tx=await pool.connect();try{
  await tx.query('BEGIN');await tx.query("SELECT set_config('app.tenant_id',$1,true)",[route.rows[0].tenant_id]);
  const result=await tx.query(`SELECT k.scopes,k.tenant_id,k.created_by,m.role FROM chatbot_access_keys k JOIN memberships m ON m.tenant_id=k.tenant_id AND m.user_id=k.created_by WHERE k.tenant_id=$1 AND k.id=$2 AND k.revoked_at IS NULL AND k.expires_at>now()`,[route.rows[0].tenant_id,route.rows[0].key_id]);
  if(!result.rowCount||result.rows[0].role!=='OWNER')throw new HttpFailure(401,'Expired or revoked key');const row=result.rows[0];
  const needed=path==='/api/v1/catalog'?'catalog:read':path==='/api/v1/leads'?'leads:read':null;
  if(method!=='GET'||!needed||!Array.isArray(row.scopes)||!row.scopes.includes(needed))throw new HttpFailure(403,'API key scope denied');
  const actor:Actor={tenantId:String(row.tenant_id),userId:String(row.created_by),role:'VIEWER'};
  await tx.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'ACCESS_KEY_USED','access_key',$3)`,[actor.tenantId,actor.userId,route.rows[0].key_id]);await tx.query('COMMIT');return actor;
 }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
}
