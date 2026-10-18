import test from 'node:test';import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {onboardingConfiguration,requireSignupOrigin,checkTokenDebug,beginWhatsAppSignup} from '../.build/apps/api/src/whatsapp-onboarding.js';
import {normalizeAppMessage,eventTime} from '../.build/apps/api/src/whatsapp-coexistence.js';
import {parseSignupEvent} from '../apps/web/public/whatsapp-signup.js';
const actor={tenantId:'11111111-1111-4111-8111-111111111111',userId:'22222222-2222-4222-8222-222222222222',role:'OWNER'};
const fixture={META_APP_ID:'123456789',META_GRAPH_VERSION:'v24.0',META_EMBEDDED_CONFIG_ID:'1111122222',META_COEXISTENCE_CONFIG_ID:'3333344444',META_APP_SECRET:'fixture-only',META_WEBHOOK_VERIFY_TOKEN:'fixture-only',WHATSAPP_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64'),APP_PUBLIC_ORIGIN:'https://pilot.example',META_EMBEDDED_SIGNUP_ENABLED:'true',META_ONBOARDING_REVIEWED:'true',META_COEXISTENCE_ENABLED:'true'};
test('official signup remains gated until explicit platform readiness; only owner can start and origins are exact',async()=>{
 const old=Object.fromEntries(Object.keys(fixture).map(k=>[k,process.env[k]]));Object.assign(process.env,fixture);
 try{
  assert.equal(onboardingConfiguration().coexistenceAvailable,true);process.env.META_ONBOARDING_REVIEWED='false';assert.equal(onboardingConfiguration().cloudAvailable,false);process.env.META_ONBOARDING_REVIEWED='true';
  assert.throws(()=>requireSignupOrigin('https://pilot.example.evil'),e=>e.status===403);assert.throws(()=>requireSignupOrigin(undefined),e=>e.status===403);requireSignupOrigin('https://pilot.example');
  const db={query:async()=>{throw Error('must not query')}};await assert.rejects(beginWhatsAppSignup(db,{...actor,role:'MANAGER'},{mode:'COEXISTENCE'}),e=>e.status===403);
  const good={data:{is_valid:true,app_id:'123456789',scopes:['whatsapp_business_messaging','whatsapp_business_management'],granular_scopes:[{scope:'whatsapp_business_management',target_ids:['999999']}],expires_at:Math.floor(Date.now()/1000)+600}};
  assert.ok(checkTokenDebug(good,'999999'));for(const d of [{...good.data,is_valid:false},{...good.data,app_id:'other'},{...good.data,scopes:[]},{...good.data,expires_at:1},{...good.data,granular_scopes:[]}])assert.throws(()=>checkTokenDebug({data:d},'999999'));
 }finally{for(const [k,v] of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v}
});
test('Meta window event origin/type validation rejects forged and malformed results',()=>{
 const payload={type:'WA_EMBEDDED_SIGNUP',event:'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',data:{waba_id:'999999'}};
 assert.equal(parseSignupEvent({origin:'https://www.facebook.com.evil',data:payload}),null);assert.equal(parseSignupEvent({origin:'null',data:payload}),null);assert.equal(parseSignupEvent({origin:'https://www.facebook.com',data:'{'}),null);assert.equal(parseSignupEvent({origin:'https://www.facebook.com',data:JSON.stringify(payload)}).event,payload.event);
});
test('app echoes preserve outbound identity and provider timestamp; history cannot open a customer service window',()=>{
 const now=String(Math.floor(Date.now()/1000)-5),m={id:'wamid.fixture',from:'15550783881',to:'16505551234',timestamp:now,type:'text',text:{body:'Company reply'}};
 assert.equal(normalizeAppMessage(m,'15550783881').kind,'OUTBOUND');assert.equal(normalizeAppMessage(m,'15550783881').source,'BUSINESS_APP');assert.equal(normalizeAppMessage(m,'15550783881',true).source,'HISTORY');assert.equal(eventTime('bad'),null);assert.equal(eventTime(Date.now()),null);assert.equal(normalizeAppMessage({...m,to:'bad'},'15550783881'),null);assert.equal(normalizeAppMessage({...m,to:undefined},'15550783881',true,'16505551234').phone,'16505551234');assert.equal(normalizeAppMessage({...m,type:'revoke'},'15550783881'),null);
});
