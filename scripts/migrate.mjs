import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const {Client}=require('pg');
const databaseUrl=process.env.MIGRATION_DATABASE_URL;
if(!databaseUrl)throw new Error('MIGRATION_DATABASE_URL is required (separate privileged migration role)');
const db=new Client({connectionString:databaseUrl});
await db.connect();
try{
  await db.query('SELECT pg_advisory_lock(19082026)');
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const directory=fileURLToPath(new URL('../packages/database/migrations/',import.meta.url));
  const migrations=(await readdir(directory)).filter(f=>/^\d{4}_[a-z0-9_-]+\.sql$/.test(f)).sort();
  for(const name of migrations){
    const exists=await db.query('SELECT 1 FROM schema_migrations WHERE filename=$1',[name]);
    if(exists.rowCount)continue;
    const raw=await readFile(new URL('../packages/database/migrations/'+name,import.meta.url),'utf8');
    const sql=raw.replace(/^\s*(?:--[^\n]*\n\s*)*BEGIN\s*;/i,'').replace(/COMMIT\s*;\s*$/i,'');
    await db.query('BEGIN');
    try{
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations(filename) VALUES($1)',[name]);
      await db.query('COMMIT');
      console.log('Applied migration',name);
    }catch(e){await db.query('ROLLBACK');throw e;}
  }
}finally{
  try{await db.query('SELECT pg_advisory_unlock(19082026)')}finally{await db.end()}
}