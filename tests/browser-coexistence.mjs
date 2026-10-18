/** Test harness only: fake Meta SDK + loopback HTTPS-origin/cookie bridge to REAL API/DB.
 * Does not prove Meta popup, real TLS cookies, eligibility or provider authorization.
 */
import assert from 'node:assert/strict';
export async function browserCoexistence({ws,send,evaluate,until,screenshot,base}){
 let cookie='';const pending=new Set();
 const bridge=event=>{const e=JSON.parse(String(event.data));if(e.method!=='Fetch.requestPaused')return;
  const task=(async()=>{const p=e.params,u=new URL(p.request.url);const headers={...p.request.headers,origin:'https://pilot.fixture.test'};
   if(cookie)headers.cookie='eb_wa_signup='+cookie;
   const r=await fetch(base+u.pathname,{method:p.request.method,headers,body:p.request.method==='GET'?undefined:p.request.postData});
   const set=r.headers.get('set-cookie')?.match(/eb_wa_signup=([^;]*)/);if(set)cookie=set[1];
   const text=await r.text();await send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:r.status,responseHeaders:[{name:'content-type',value:'application/json'}],body:Buffer.from(text).toString('base64')});
  })();pending.add(task);task.finally(()=>pending.delete(task)).catch(()=>{});
 };
 ws.addEventListener('message',bridge);
 await send('Fetch.enable',{patterns:[{urlPattern:'*/api/v1/whatsapp/signup/*',requestStage:'Request'}]});
 try{
  await evaluate(`(()=>{window.FB={init(){},login(callback,options){window.__signupOptions=options;window.__signupCallback=callback}};document.querySelector('[data-page="wa-connect"]').click()})()`);
  await until("document.querySelectorAll('#wa-self-service .card').length===2",'self-service number choices');
  await screenshot('coexistence-01-number-choice-desktop.png');
  await evaluate("document.querySelector('#wa-self-service .card button').click()");
  await until("[...document.querySelectorAll('#wa-choose-phone button')].some(b=>b.textContent==='متابعة في Meta')",'prepared SDK gesture');
  await evaluate("document.querySelector('#wa-choose-phone button').click()");
  assert.equal(await evaluate("window.__signupOptions.extras.featureType"),'whatsapp_business_app_onboarding');
  await evaluate("window.__signupCallback({authResponse:{code:'fixture-browser-code'}});window.dispatchEvent(new MessageEvent('message',{origin:'https://www.facebook.com',data:JSON.stringify({type:'WA_EMBEDDED_SIGNUP',event:'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',data:{waba_id:'6655443322'}})}))");
  await until("document.querySelectorAll('#wa-choose-phone button').length===2",'real backend authorized phone selection');
  await screenshot('coexistence-02-select-authorized-phone.png');
  await evaluate("document.querySelector('#wa-choose-phone button').click()");
  await until("document.getElementById('wa-self-service').textContent.includes('واتساب بيزنس + المنصة')",'stored real tenant connection');
  assert.equal(await evaluate("document.getElementById('wa-self-service').textContent.includes('استقبال الرسائل: لم يُثبت بعد')"),true);
  await screenshot('coexistence-03-authorized-not-live.png');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await screenshot('coexistence-04-mobile.png');
  await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
  // A second popup is cancelled, preserving the existing account.
  await evaluate("document.querySelector('#wa-self-service .card button').click()");
  await until("document.querySelector('#wa-choose-phone button')?.textContent==='متابعة في Meta'",'second attempt');
  await evaluate("document.querySelector('#wa-choose-phone button').click();window.__signupCallback({})");
  await until("document.getElementById('notice').textContent.includes('لم تمنح التفويض')",'cancelled signup');
  console.log('PASS COEXISTENCE Chromium actual two-path Arabic UI, SDK contract fixture, API/DB-backed phone selection, encrypted grant, cancelled popup, desktop/mobile; HTTPS-cookie bridge is test-only, not live Meta');
 }finally{await Promise.allSettled([...pending]);await send('Fetch.disable');ws.removeEventListener('message',bridge);await evaluate('delete window.FB')}
}
