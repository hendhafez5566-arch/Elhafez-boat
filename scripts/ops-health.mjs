/** Read-only local alarm; emits counts/codes, never tokens, payloads or contact identifiers. */
import pg from 'pg';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required (runtime role)');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:5000});
const alerts=[];await db.connect();
try{
 const role=(await db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
 if(role.rolsuper||role.rolbypassrls)throw new Error('Monitoring requires non-superuser/non-BYPASSRLS runtime');
 const tenants=(await db.query('SELECT id FROM tenants ORDER BY id LIMIT 10000')).rows;
 for(const {id} of tenants){
  await db.query('BEGIN READ ONLY');
  try{
   await db.query("SELECT set_config('app.tenant_id',$1,true)",[id]);
   const active=(await db.query("SELECT 1 FROM tenant_subscriptions WHERE tenant_id=$1 AND status IN ('ACTIVE','TRIAL') AND current_period_ends_at>now()",[id])).rowCount;
   if(active){
    const health=await db.query("SELECT last_seen_at>now()-interval '2 minutes' AS fresh,last_error_code FROM chatbot_worker_health WHERE tenant_id=$1",[id]);
    if(!health.rows[0]?.fresh||health.rows[0]?.last_error_code)alerts.push({tenant:id,code:'WORKER_UNHEALTHY'});
   }
   for(const [table,due] of [['whatsapp_outbox','next_attempt_at'],['chatbot_social_outbox','next_attempt_at'],['chatbot_connector_jobs','next_attempt_at'],['chatbot_integration_jobs','next_attempt_at'],['chatbot_delay_jobs','due_at']]){
    // Identifiers are a fixed internal list, never input.
    const rows=(await db.query(`SELECT status,count(*)::int AS count FROM ${table} WHERE tenant_id=$1 AND (status='UNCERTAIN' OR status='PROCESSING' OR (status='PENDING' AND ${due}<now()-interval '5 minutes')) GROUP BY status`,[id])).rows;
    for(const row of rows)alerts.push({tenant:id,queue:table,code:row.status,count:row.count});
   }
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e}
 }
 console.log(JSON.stringify({checkedAt:new Date().toISOString(),tenants:tenants.length,healthy:!alerts.length,alerts}));
 if(alerts.length)process.exitCode=2;
}catch(e){console.error(JSON.stringify({healthy:false,code:e.code||'MONITOR_FAILED'}));process.exitCode=1}
finally{await db.end()}
