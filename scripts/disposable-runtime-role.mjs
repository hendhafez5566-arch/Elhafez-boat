/** Grants for local disposable acceptance ONLY; never a production provisioning script. */
import pg from 'pg';
if(process.env.CI_ACCEPTANCE_DISPOSABLE_DB!=='YES')throw new Error('Disposable test database only');
const url=new URL(process.env.MIGRATION_DATABASE_URL||'');
if(url.pathname!=='/elhafez_ci')throw new Error('Expected elhafez_ci database');
const password=process.env.TEST_RUNTIME_PASSWORD;
if(!password||password.length<20)throw new Error('TEST_RUNTIME_PASSWORD must have at least 20 characters');
const db=new pg.Client({connectionString:url.toString()});await db.connect();
try{
 const exists=await db.query("SELECT 1 FROM pg_roles WHERE rolname='boat_local_runtime'");
 if(!exists.rowCount){const sql=await db.query("SELECT format('CREATE ROLE boat_local_runtime LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', $1::text) AS sql",[password]);await db.query(sql.rows[0].sql)}
 await db.query('GRANT CONNECT ON DATABASE elhafez_ci TO boat_local_runtime');
 await db.query('GRANT USAGE ON SCHEMA public TO boat_local_runtime');
 await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO boat_local_runtime');
 await db.query('GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO boat_local_runtime');
 console.log('Disposable non-owner role granted; no provider accounts created');
}finally{await db.end()}
