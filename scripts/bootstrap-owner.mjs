import { createRequire } from 'node:module';
import { passwordHash } from '../.build/apps/api/src/auth.js';
const require=createRequire(import.meta.url);
const {Client}=require('pg');
const {MIGRATION_DATABASE_URL,BOOTSTRAP_TENANT_SLUG,BOOTSTRAP_TENANT_NAME,BOOTSTRAP_EMAIL,BOOTSTRAP_PASSWORD}=process.env;
if(!MIGRATION_DATABASE_URL||!BOOTSTRAP_TENANT_SLUG||!BOOTSTRAP_TENANT_NAME||!BOOTSTRAP_EMAIL||!BOOTSTRAP_PASSWORD)throw new Error('Bootstrap environment variables are required. See docs/11-LOCAL-SETUP.md');
if(!/^[a-z0-9-]{3,40}$/.test(BOOTSTRAP_TENANT_SLUG))throw new Error('Invalid tenant slug');
const hash=await passwordHash(BOOTSTRAP_PASSWORD);
const db=new Client({connectionString:MIGRATION_DATABASE_URL});
await db.connect();
try{
  await db.query('BEGIN');
  const tenant=await db.query('INSERT INTO tenants(slug,name) VALUES($1,$2) RETURNING id',[BOOTSTRAP_TENANT_SLUG,BOOTSTRAP_TENANT_NAME]);
  const user=await db.query('INSERT INTO users(email,password_hash) VALUES(lower($1),$2) RETURNING id',[BOOTSTRAP_EMAIL,hash]);
  await db.query("INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')",[tenant.rows[0].id,user.rows[0].id]);
  await db.query(`INSERT INTO tenant_subscriptions(tenant_id,plan_code,status,current_period_ends_at)
    VALUES($1,'STARTER','TRIAL',now()+interval '14 days') ON CONFLICT(tenant_id) DO NOTHING`,[tenant.rows[0].id]);
  await db.query('COMMIT');
  console.log('Created tenant and OWNER membership:',BOOTSTRAP_TENANT_SLUG);
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end()}