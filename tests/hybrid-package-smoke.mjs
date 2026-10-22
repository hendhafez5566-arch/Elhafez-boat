/** Run inside the built production image with a disposable fixture mounted read-only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=process.env.WEB_BASE_URL||'http://127.0.0.1:3000';
const account=JSON.parse(readFileSync(process.env.HYBRID_ACCOUNT_FILE||'/run/test-account.json'));
const health=await fetch(base+'/health');assert.equal(health.status,200);assert.equal((await health.json()).database,'reachable');
const login=await fetch(base+'/api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json','x-boat-csrf':'1'},body:JSON.stringify({tenantSlug:account.slug,email:account.email,password:account.password})});
assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
for(const path of ['/flow-basic-builder.js','/flow-builder.js','/flow-canvas.js','/flow-builder.css']){const response=await fetch(base+path,{headers:{cookie}});assert.equal(response.status,200);assert.ok((await response.text()).length>1000)}
assert.equal((await fetch(base+'/api/v1/bots',{headers:{cookie}})).status,200);
console.log('PASS production Node22/Alpine image: database health, login, authenticated bot API, four hybrid assets');
