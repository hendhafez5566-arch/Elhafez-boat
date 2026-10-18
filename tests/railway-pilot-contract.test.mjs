import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const run=(file,env={})=>spawnSync(process.execPath,[file],{
 env:{PATH:process.env.PATH||'',...env},encoding:'utf8',timeout:7000
});
test('low-cost Railway manual-pilot launchers have valid Node syntax',()=>{
 for(const file of ['scripts/railway-pilot.mjs','scripts/railway-pilot-setup.mjs']){
  const x=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(x.status,0,x.stderr);
 }
});
test('manual Railway pilot refuses startup without runtime secrets and RLS database',()=>{
 const x=run('scripts/railway-pilot.mjs');
 assert.notEqual(x.status,0);
 assert.match(x.stderr,/Pilot startup requires DATABASE_URL/);
});
test('manual Railway pilot refuses paid AI provider credentials before startup',()=>{
 const x=run('scripts/railway-pilot.mjs',{
  DATABASE_URL:'postgresql://boat_pilot_runtime:placeholder@localhost/boat_pilot',
  WHATSAPP_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,1).toString('base64'),
  RATE_LIMIT_SECRET:'placeholder',
  AI_API_KEY:'not-a-real-secret'
 });
 assert.notEqual(x.status,0);
 assert.match(x.stderr,/Paid\/external AI configuration is forbidden/);
});
test('database initializer refuses production connection and cannot contact it',()=>{
 const x=run('scripts/railway-pilot-setup.mjs',{
  BOAT_PILOT_INIT_CONFIRM:'boat_pilot',
  MIGRATION_DATABASE_URL:'postgresql://postgres:placeholder-password-must-not-connect@production.internal:5432/production',
  DATABASE_URL:'postgresql://boat_pilot_runtime:placeholder-password-must-not-connect@production.internal:5432/production',
  BOOTSTRAP_EMAIL:'owner@example.invalid',
  BOOTSTRAP_PASSWORD:'placeholder-password',
  BOOTSTRAP_TENANT_SLUG:'pilot-boat'
 });
 assert.notEqual(x.status,0);
 assert.match(x.stderr,/Refusing setup: expected isolated Railway pilot DB/);
});
