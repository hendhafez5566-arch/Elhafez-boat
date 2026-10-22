/**
 * One-time, isolated Railway manual pilot bootstrap.
 * Refuses any database other than the explicit fresh "boat_pilot" database on
 * boat-pilot-db.railway.internal. Never run against an existing production DB.
 *
 * Only the parent launcher sees privileged credentials. Web/API/worker MUST
 * receive only the non-owner DATABASE_URL after this setup finishes.
 */
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {Client}=require('pg');

const migration=process.env.MIGRATION_DATABASE_URL, runtime=process.env.DATABASE_URL;
if(process.env.BOAT_PILOT_INIT_CONFIRM!=='boat_pilot')throw new Error('Pilot database setup requires explicit confirmation');
if(!migration||!runtime||!process.env.BOOTSTRAP_PASSWORD||!process.env.BOOTSTRAP_EMAIL)throw new Error('Missing private pilot database/bootstrap credentials');
const a=new URL(migration),b=new URL(runtime);
if(a.protocol!=='postgresql:'||b.protocol!=='postgresql:'||
 a.hostname!=='boat-pilot-db.railway.internal'||b.hostname!==a.hostname||
 a.pathname!=='/boat_pilot'||b.pathname!==a.pathname||
 a.username!=='postgres'||b.username!=='boat_pilot_runtime'||!b.password||
 a.password.length<20||b.password.length<20)throw new Error('Refusing setup: expected isolated Railway pilot DB and distinct strong admin/runtime roles');
if(process.env.BOOTSTRAP_TENANT_SLUG!=='pilot-boat')throw new Error('Refusing setup without the dedicated pilot-boat company slug');

let db;
for(let attempt=0;attempt<40;attempt++){
 db=new Client({connectionString:migration,connectionTimeoutMillis:3500});
 try{await db.connect();break}catch(error){
  await db.end().catch(()=>{});db=undefined;
  if(attempt===39)throw new Error('Pilot database did not become available; check DB service status');
  await new Promise(resolve=>setTimeout(resolve,3000));
 }
}
try{
 const identity=await db.query('SELECT current_user, current_database() AS db');
 if(identity.rows[0]?.current_user!=='postgres'||identity.rows[0]?.db!=='boat_pilot')throw new Error('Admin connection is not the isolated pilot DB');
 const migrationResult=spawnSync(process.execPath,['scripts/migrate.mjs'],{env:process.env,stdio:'inherit',timeout:120000});
 if(migrationResult.error||migrationResult.status!==0)throw new Error('Pilot schema migration failed');
 const tenantCount=await db.query('SELECT count(*)::integer AS n FROM tenants');
 const count=Number(tenantCount.rows[0].n);
 if(count>0){
  const existing=await db.query('SELECT t.slug,u.email FROM tenants t JOIN memberships m ON m.tenant_id=t.id JOIN users u ON u.id=m.user_id WHERE m.role=$1',['OWNER']);
  if(count!==1||!existing.rows.some(x=>x.slug==='pilot-boat'&&x.email===process.env.BOOTSTRAP_EMAIL.toLowerCase())){
   throw new Error('Existing tenants found; refusing to bootstrap or alter a non-pilot database');
  }
 }
 // Role creation is strictly limited to a dedicated non-owner, non-BYPASSRLS login.
 const role=await db.query("SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='boat_pilot_runtime'");
 if(!role.rowCount){
  const statement=await db.query("SELECT format('CREATE ROLE boat_pilot_runtime LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', $1::text) AS sql",[decodeURIComponent(b.password)]);
  await db.query(statement.rows[0].sql);
 }else if(Object.values(role.rows[0]).some(Boolean))throw new Error('Pilot runtime role has excessive privileges');
 await db.query('GRANT CONNECT ON DATABASE boat_pilot TO boat_pilot_runtime');
 await db.query('GRANT USAGE ON SCHEMA public TO boat_pilot_runtime');
 await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO boat_pilot_runtime');
 await db.query('GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO boat_pilot_runtime');
 await db.query('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO boat_pilot_runtime');
 await db.query('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE,SELECT,UPDATE ON SEQUENCES TO boat_pilot_runtime');
 if(count===0){
  const owner=spawnSync(process.execPath,['scripts/bootstrap-owner.mjs'],{env:process.env,stdio:'inherit',timeout:30000});
  if(owner.error||owner.status!==0)throw new Error('Pilot company bootstrap failed');
 }
 const check=new Client({connectionString:runtime,connectionTimeoutMillis:5000});
 try{
  await check.connect();
  const perms=await check.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  if(!perms.rowCount||perms.rows[0].rolsuper||perms.rows[0].rolbypassrls)throw new Error('RLS runtime verification failed');
  await check.query('SELECT id FROM tenants LIMIT 1');
 }finally{await check.end()}
 console.log('Isolated pilot migrations, RLS runtime role and owner verified');
}finally{await db.end()}
