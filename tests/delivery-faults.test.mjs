import test from 'node:test';
import assert from 'node:assert/strict';
import {sendWhatsApp,deliveryDisposition,DeliveryFailure} from '../.build/apps/worker/delivery.js';
import {providerSimulator} from './support/provider-simulator.mjs';
test('production WhatsApp sender against loopback simulator: delivery and ambiguous faults',async()=>{
 const sim=await providerSimulator();
 try{
  for(const [mode,expected] of [['','SENT'],['429','PENDING'],['500','UNCERTAIN'],['timeout','UNCERTAIN'],['redirect','UNCERTAIN'],['malformed','UNCERTAIN'],['oversized','UNCERTAIN']]){
   const transport=(url,options)=>{assert.equal(new URL(url).hostname,'graph.facebook.com');return fetch(sim.base+'/whatsapp/messages?mode='+mode,options)};
   try{const result=await sendWhatsApp('v24.0','123','fixture-token',{type:'text',text:{body:'test'}},transport);assert.equal(expected,'SENT');assert.ok(result.providerId)}catch(e){assert.equal(deliveryDisposition(e),expected,mode)}
  }
  assert.equal(sim.calls.some(c=>c.path==='/unexpected'),false,'Credentials must never follow redirects');
 }finally{await sim.close()}
});
test('no automatic retry for 408/5xx/unknown outcomes; only explicit throttle retries',()=>{
 for(const status of [undefined,0,200,302,408,500,502,503,504])assert.equal(deliveryDisposition(new DeliveryFailure(status)),'UNCERTAIN');
 for(const status of [400,401,403,404,422])assert.equal(deliveryDisposition(new DeliveryFailure(status)),'FAILED');
 assert.equal(deliveryDisposition(new DeliveryFailure(429)),'PENDING');
 assert.equal(deliveryDisposition(new Error('secret response')),'UNCERTAIN');
});
test('invalid account identifiers fail before any transport',async()=>{
 await assert.rejects(sendWhatsApp('v24.0','123/evil','token',{},()=>{throw new Error('Must not connect')}),e=>e instanceof DeliveryFailure&&e.status===400);
});
test('provider fixture contracts, OAuth refresh and duplicate idempotency keys (harness coverage only)',async()=>{
 const sim=await providerSimulator();
 try{
  for(const name of ['whatsapp','messenger','instagram','telegram','google/oauth/token','google/sheets','hubspot','shopify','woocommerce','ai']){
   const url=sim.base+'/'+name;
   const options={method:'POST',headers:{'content-type':'application/json','idempotency-key':name},body:JSON.stringify({grant_type:'refresh_token',refresh_token:'fixture'})};
   const a=await(await fetch(url,options)).json(),b=await(await fetch(url,options)).json();assert.deepEqual(a,b);
   for(const mode of ['429','500'])assert.equal((await fetch(url+'?mode='+mode,options)).status,Number(mode));
  }
  assert.equal(sim.effects.size,10);
 }finally{await sim.close()}
});
