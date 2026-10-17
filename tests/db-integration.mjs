/** Real PostgreSQL integration gate; requires migrated, disposable CI database and admin role. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
if(process.env.CI_DB_INTEGRATION!=='1'||!process.env.MIGRATION_DATABASE_URL)throw new Error('Set CI_DB_INTEGRATION=1 and MIGRATION_DATABASE_URL for a disposable migrated database');
const db=new pg.Client({connectionString:process.env.MIGRATION_DATABASE_URL});await db.connect();
const a=randomUUID(),b=randomUUID(),user=randomUUID(),role='boat_rls_'+randomBytes(6).toString('hex');
try{
 await db.query('BEGIN');
 await db.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
 await db.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
 await db.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
 await db.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
 for(const id of [a,b])await db.query('INSERT INTO tenants(id,slug,name) VALUES($1,$2,$3)',[id,'ci-'+id,'CI company']);
 await db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[user,user+'@example.invalid','not-a-login-fixture']);
 for(const id of [a,b])await db.query(`INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')`,[id,user]);
 await db.query(`SET LOCAL ROLE ${role}`);
 await db.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
 await db.query(`INSERT INTO chatbot_catalog_items(tenant_id,kind,title,created_by) VALUES($1,'SERVICE','Company A service',$2)`,[a,user]);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM chatbot_catalog_items')).rows[0].n,1);
 await db.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM chatbot_catalog_items')).rows[0].n,0);
 assert.equal((await db.query(`UPDATE chatbot_catalog_items SET title='Cross tenant write' WHERE tenant_id=$1`,[a])).rowCount,0);
 await db.query('SAVEPOINT cross_tenant');
 await assert.rejects(db.query(`INSERT INTO chatbot_catalog_items(tenant_id,kind,title,created_by) VALUES($1,'SERVICE','Forbidden service',$2)`,[a,user]),e=>e.code==='42501');
 await db.query('ROLLBACK TO SAVEPOINT cross_tenant');
 const required=['chatbot_flow_drafts','chatbot_flow_versions','chatbot_flow_sessions','chatbot_catalog_items','chatbot_ai_settings','chatbot_ai_events','chatbot_saved_replies','chatbot_inbox_reads','chatbot_integrations','chatbot_integration_jobs','chatbot_access_keys'];
 const rls=await db.query('SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1::text[])',[required]);
 assert.equal(rls.rows.length,required.length);for(const row of rls.rows){assert.equal(row.relrowsecurity,true,row.relname);assert.equal(row.relforcerowsecurity,true,row.relname)}
 console.log('PASS PostgreSQL catalog isolation, cross-tenant read/update/insert denial, and RLS/FORCE flags for all new tenant tables');
}finally{await db.query('ROLLBACK');await db.end()}
