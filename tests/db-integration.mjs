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
 // A reusable section is just as tenant-private as its parent bot flow.
 await db.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
 await db.query(`INSERT INTO chatbot_flow_snippets(tenant_id,name,definition,created_by)
 VALUES($1,'Company A intro','{"name":"Company A intro","steps":[]}'::jsonb,$2)`,[a,user]);
 await db.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM chatbot_flow_snippets')).rows[0].n,0);
 await db.query('SAVEPOINT snippet_cross_tenant');
 await assert.rejects(db.query(`INSERT INTO chatbot_flow_snippets(tenant_id,name,definition,created_by)
 VALUES($1,'Forbidden intro','{}'::jsonb,$2)`,[a,user]),error=>error.code==='42501');
 await db.query('ROLLBACK TO SAVEPOINT snippet_cross_tenant');

 assert.equal((await db.query(`UPDATE chatbot_catalog_items SET title='Cross tenant write' WHERE tenant_id=$1`,[a])).rowCount,0);
 await db.query('SAVEPOINT cross_tenant');
 await assert.rejects(db.query(`INSERT INTO chatbot_catalog_items(tenant_id,kind,title,created_by) VALUES($1,'SERVICE','Forbidden service',$2)`,[a,user]),e=>e.code==='42501');
 await db.query('ROLLBACK TO SAVEPOINT cross_tenant');
 // Advanced native connector and linked-subflow data cannot cross company boundaries.
 await db.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
 const connector=(await db.query("INSERT INTO chatbot_connectors(tenant_id,provider,name,created_by) VALUES($1,'HUBSPOT','Tenant A CRM',$2) RETURNING id",[a,user])).rows[0].id;
 const subflow=(await db.query("INSERT INTO chatbot_subflows(tenant_id,name) VALUES($1,'Tenant A subflow') RETURNING id",[a])).rows[0].id;
 await db.query("INSERT INTO chatbot_subflow_versions(tenant_id,subflow_id,version,definition,created_by) VALUES($1,$2,1,'{}'::jsonb,$3)",[a,subflow,user]);
 await db.query("INSERT INTO chatbot_privacy_settings(tenant_id,retention_days) VALUES($1,90)",[a]);
 await db.query("SELECT set_config('app.tenant_id',$1,true)",[b]);
 for(const table of ['chatbot_connectors','chatbot_subflows','chatbot_subflow_versions','chatbot_privacy_settings'])assert.equal((await db.query('SELECT count(*)::int AS n FROM '+table)).rows[0].n,0,table);
 await db.query('SAVEPOINT advanced_cross_tenant');
 assert.equal((await db.query("UPDATE chatbot_connectors SET name='Forbidden' WHERE tenant_id=$1 AND id=$2 RETURNING id",[a,connector])).rowCount,0);
 await assert.rejects(db.query("INSERT INTO chatbot_privacy_settings(tenant_id,retention_days) VALUES($1,30)",[a]),e=>e.code==='42501');await db.query('ROLLBACK TO SAVEPOINT advanced_cross_tenant');
 await db.query("SELECT set_config('app.tenant_id',$1,true)",[a]);
 const contact=(await db.query("INSERT INTO contacts(tenant_id,full_name,phone,email) VALUES($1,'Privacy test',NULL,'privacy@example.invalid') RETURNING id",[a])).rows[0].id;
 const conversation=(await db.query("INSERT INTO conversations(tenant_id,contact_id,channel,status) VALUES($1,$2,'WEBSITE','CLOSED') RETURNING id",[a,contact])).rows[0].id;
 await db.query("INSERT INTO conversation_messages(tenant_id,conversation_id,kind,body) VALUES($1,$2,'INBOUND','Private customer question')",[a,conversation]);
 await db.query("INSERT INTO chatbot_leads(tenant_id,conversation_id,contact_id,custom_fields) VALUES($1,$2,$3,$4::jsonb)",[a,conversation,contact,JSON.stringify({email:'privacy@example.invalid'})]);
 const {exportContact,anonymizeContact}=await import('../.build/apps/api/src/privacy.js');const actor={tenantId:a,userId:user,role:'OWNER'};
 assert.equal((await exportContact(db,actor,contact)).messages.length,1);
 assert.equal((await anonymizeContact(db,actor,contact,{confirm:contact})).anonymized,true);
 const redacted=(await db.query('SELECT phone,email,do_not_contact FROM contacts WHERE tenant_id=$1 AND id=$2',[a,contact])).rows[0];assert.equal(redacted.email,null);assert.equal(redacted.phone,null);assert.equal(redacted.do_not_contact,true);
 assert.equal((await db.query('SELECT body FROM conversation_messages WHERE tenant_id=$1 AND conversation_id=$2',[a,conversation])).rows[0].body,'[تم حذف بيانات العميل]');
 const {distributedLimit}=await import('../.build/apps/api/src/rate-limit.js');process.env.RATE_LIMIT_SECRET='ci-non-production-limit-secret';
 await distributedLimit(db,'ci-bucket-'+a,1,60);await assert.rejects(distributedLimit(db,'ci-bucket-'+a,1,60),e=>e.status===429);
 const required=['chatbot_flow_drafts','chatbot_flow_versions','chatbot_flow_sessions','chatbot_catalog_items','chatbot_ai_settings','chatbot_ai_events','chatbot_saved_replies','chatbot_inbox_reads','chatbot_integrations','chatbot_integration_jobs','chatbot_access_keys','chatbot_message_reads','chatbot_delay_jobs','chatbot_triggers','chatbot_widget_settings','chatbot_web_sessions','chatbot_web_receipts','chatbot_media','chatbot_usage_limits','chatbot_usage','chatbot_campaigns','chatbot_campaign_jobs','chatbot_flow_snippets','chatbot_subflows','chatbot_subflow_versions','chatbot_privacy_settings','chatbot_connectors','chatbot_connector_jobs','chatbot_connector_links','chatbot_social_accounts','chatbot_social_receipts','chatbot_social_actions','chatbot_social_outbox','chatbot_worker_health'];
 const rls=await db.query('SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1::text[])',[required]);
 assert.equal(rls.rows.length,required.length);for(const row of rls.rows){assert.equal(row.relrowsecurity,true,row.relname);assert.equal(row.relforcerowsecurity,true,row.relname)}
 console.log('PASS PostgreSQL catalog isolation, cross-tenant read/update/insert denial, and RLS/FORCE flags for all new tenant tables');
}finally{await db.query('ROLLBACK');await db.end()}
