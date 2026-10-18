import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {verifyWhatsAppAccount,connectWhatsApp,diagnoseWhatsApp,disconnectWhatsApp} from '../.build/apps/api/src/whatsapp.js';
const actor={tenantId:'11111111-1111-4111-8111-111111111111',userId:'22222222-2222-4222-8222-222222222222',role:'OWNER'};
const id='33333333-3333-4333-8333-333333333333';
test('WhatsApp onboarding validates WABA ownership, rejects redirects/malformed provider data, and safely reconnects',async()=>{
 const old=globalThis.fetch,version=process.env.META_GRAPH_VERSION,key=process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
 process.env.META_GRAPH_VERSION='v24.0';process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY=randomBytes(32).toString('base64');
 const token='fixture-token-no-real-account-123456';let mode='ok';const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});assert.equal(options.redirect,'error');
  if(mode==='network')throw new Error('private provider body');
  if(mode==='bad-json')return new Response('{');
  if(mode==='oversized')return new Response('x'.repeat(262145));
  if(String(url).includes('/phone_numbers'))return Response.json({data:[{id:mode==='wrong-waba'?'999999':'123456'}]});
  return Response.json({id:'123456',display_phone_number:'+10000000000'});
 };
 try{
  for(const bad of ['wrong-waba','network','bad-json','oversized']){mode=bad;await assert.rejects(verifyWhatsAppAccount('123456','654321',token),e=>e.status>=400&&!e.message.includes(token)&&!e.message.includes('private provider'))}
  mode='ok';assert.equal((await verifyWhatsAppAccount('123456','654321',token)).id,'123456');
  const sql=[];const db={query:async(q,p)=>{sql.push({q,p});return {rowCount:1,rows:[{id}]}}};
  await connectWhatsApp(db,actor,{phoneNumberId:'123456',wabaId:'654321',accessToken:token});
  const insert=sql.find(x=>x.q.includes('INSERT INTO whatsapp_accounts'));
  assert.match(insert.q,/whatsapp_accounts.tenant_id=EXCLUDED.tenant_id/);assert.match(insert.q,/status='CONNECTED'/);assert.ok(!insert.p[3].includes(token));
  await assert.rejects(diagnoseWhatsApp(db,{...actor,role:'AGENT'},id),e=>e.status===403);
  await disconnectWhatsApp({query:async(q)=>{sql.push({q});return {rowCount:1,rows:[{phone_number_id:'123456'}]}}},actor,id);
  assert.ok(sql.some(x=>x.q.includes("status='FAILED'")&&x.q.includes("status='PENDING'")));
  const disabled=await diagnoseWhatsApp({query:async()=>({rows:[{status:'DISABLED'}]})},actor,id);assert.equal(disabled.verified,false);
 }finally{globalThis.fetch=old;if(version===undefined)delete process.env.META_GRAPH_VERSION;else process.env.META_GRAPH_VERSION=version;if(key===undefined)delete process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;else process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY=key}
});
