/** Independent restored-database check, real runtime role/RLS, original fixture key only. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {publicTenant} from '../.build/apps/api/src/public-tenant.js';
import {openIntegrationSecret} from '../.build/apps/api/src/integration-secrets.js';
import {processDelay} from '../.build/apps/api/src/delay-scheduler.js';
if(process.env.CI_ACCEPTANCE_DISPOSABLE_DB!=='YES')throw Error('Disposable only');
const fixture=JSON.parse(await readFile('acceptance-evidence/restore-fixture-private.json','utf8'));
const restored=new URL(process.env.MIGRATION_DATABASE_URL);restored.pathname='/elhafez_ci_restored';
const admin=new pg.Client({connectionString:restored.toString()});await admin.connect();
const originalRuntime=new URL(fixture.runtimeUrl),role=originalRuntime.username;
try{
 const grants=(await admin.query("SELECT format('GRANT USAGE ON SCHEMA public TO %I; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO %I; GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', $1::text,$1::text,$1::text) sql",[role])).rows[0].sql;await admin.query(grants);
 originalRuntime.pathname='/elhafez_ci_restored';const pool=new pg.Pool({connectionString:originalRuntime.toString()});pool.on('error',()=>{});
 try{
  process.env.INTEGRATION_SECRET_ENCRYPTION_KEY=fixture.key;
  await publicTenant(pool,fixture.tenant,async c=>{
   const roleFlags=(await c.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.equal(roleFlags.rolsuper,false);assert.equal(roleFlags.rolbypassrls,false);
   const other=await c.query('SELECT id FROM contacts WHERE tenant_id<>$1',[fixture.tenant]);assert.equal(other.rowCount,0);
   const media=await c.query("SELECT content FROM chatbot_media WHERE tenant_id=$1 AND status='ACTIVE'",[fixture.tenant]);assert.ok(media.rows.some(r=>Buffer.isBuffer(r.content)&&r.content.length>50));
   const secret=(await c.query('SELECT credentials_encrypted FROM chatbot_connectors WHERE tenant_id=$1 LIMIT 1',[fixture.tenant])).rows[0].credentials_encrypted;assert.ok(openIntegrationSecret(secret));
   const delayed=(await c.query('SELECT status FROM chatbot_delay_jobs WHERE tenant_id=$1 AND conversation_id=$2',[fixture.tenant,fixture.conversation])).rows[0];assert.equal(delayed.status,'PENDING');
   assert.ok((await c.query('SELECT 1 FROM audit_events WHERE tenant_id=$1 LIMIT 1',[fixture.tenant])).rowCount);
   await c.query('UPDATE chatbot_delay_jobs SET due_at=now()-interval \'1 second\' WHERE tenant_id=$1 AND conversation_id=$2',[fixture.tenant,fixture.conversation]);
  });
  await Promise.all([publicTenant(pool,fixture.tenant,c=>processDelay(c,fixture.tenant)),publicTenant(pool,fixture.tenant,c=>processDelay(c,fixture.tenant))]);
  const messages=await admin.query("SELECT body FROM conversation_messages WHERE tenant_id=$1 AND conversation_id=$2 AND body='What do you need?'",[fixture.tenant,fixture.conversation]);assert.equal(messages.rowCount,1);
  console.log('PASS LOCAL RESTORE seeded encrypted secrets/original key, media bytes, audit, least-privilege RLS and competing restored delay exactly once');
 }finally{await pool.end()}
}finally{await admin.end()}
