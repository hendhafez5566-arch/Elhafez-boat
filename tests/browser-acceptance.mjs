/** Real headless Chrome/Chromium acceptance: company login, dashboard, Flow Builder and mobile. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {once} from 'node:events';
const base=process.env.WEB_BASE_URL||'http://127.0.0.1:3000';
const account=JSON.parse(await readFile(process.env.ACCEPTANCE_BROWSER_ACCOUNT||'acceptance-evidence/browser-account.json','utf8'));
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const profile=await mkdtemp(join(tmpdir(),'boat-chromium-'));
const child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
 '--no-first-run','--no-default-browser-check','--disable-background-networking',
 '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws;let commandId=0;const pending=new Map(),exceptions=[],network=[],consoleErrors=[];
async function waitForPort(){for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error('Chrome exited before launching');try{
 const info=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');return Number(info[0]);
 }catch{}await sleep(150)}throw new Error('Chrome DevTools port unavailable')}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value}
function send(method,params={}){const id=++commandId;return new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('Chrome CDP timeout: '+method))},12000);
 pending.set(id,{resolve:result=>{clearTimeout(timeout);resolve(result)},reject:error=>{clearTimeout(timeout);reject(error)}});
 ws.send(JSON.stringify({id,method,params}));
 })}
async function until(predicate,name){
 for(let i=0;i<70;i++){if(await evaluate(predicate))return;await sleep(160)}
 const state=await evaluate("JSON.stringify({loginHidden:document.getElementById('login')?.hidden,appHidden:document.getElementById('app')?.hidden,notice:document.getElementById('notice')?.textContent,listener:Boolean(document.getElementById('login-form')?.onsubmit),scripts:[...document.scripts].map(s=>s.src),readyState:document.readyState})").catch(()=>null);
 throw new Error('Browser UI timed out waiting for '+name+'; state='+state+'; exceptions='+JSON.stringify(exceptions.slice(-8))+'; network='+JSON.stringify(network.slice(-15))+'; console='+JSON.stringify(consoleErrors.slice(-8)));
}
async function screenshot(filename){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('acceptance-evidence/'+filename,Buffer.from(r.data,'base64'))}
try{
 const port=await waitForPort();
 let target;for(let i=0;i<30;i++){try{const pages=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=pages.find(p=>p.type==='page'&&p.webSocketDebuggerUrl);if(target)break}catch{}await sleep(120)}
 assert.ok(target?.webSocketDebuggerUrl,'No debuggable Chrome page');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',event=>{const value=JSON.parse(String(event.data));if(value.id){const entry=pending.get(value.id);if(entry){pending.delete(value.id);value.error?entry.reject(new Error(JSON.stringify(value.error))):entry.resolve(value.result)}}else if(value.method==='Page.javascriptDialogOpening'){send('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});}else if(value.method==='Runtime.exceptionThrown')exceptions.push(JSON.stringify(value.params.exceptionDetails||{}).slice(0,900));else if(value.method==='Log.entryAdded'){consoleErrors.push(String(value.params?.entry?.text||'').slice(0,650));}else if(value.method==='Runtime.consoleAPICalled'&&value.params?.type==='error'){consoleErrors.push((value.params.args||[]).map(a=>a.value||a.description||'').join(' ').slice(0,650));}else if(value.method==='Network.responseReceived'){
  const response=value.params?.response;
  if(response?.url&&((response.status>=400)||['Script','XHR','Fetch'].includes(value.params?.type))){network.push({url:new URL(response.url).pathname,status:response.status,type:value.params?.type});if(network.length>50)network.shift()}
 }else if(value.method==='Network.loadingFailed')network.push({failure:String(value.params?.errorText||'unknown')});});
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Log.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:base+'/'});
 await until("Boolean(document.querySelector('#login-form input[name=tenantSlug]'))",'login form');
 await until("Boolean(document.getElementById('login-form')?.onsubmit)",'login JS initialization');
 assert.equal(await evaluate("document.documentElement.getAttribute('dir')"),'rtl');
 const payload=JSON.stringify(account);
 await evaluate(`(()=>{const p=${payload};const f=document.getElementById('login-form');f.querySelector('[name=tenantSlug]').value=p.slug;f.querySelector('[name=email]').value=p.email;f.querySelector('[name=password]').value=p.password;f.requestSubmit();return true})()`);
 await until("Boolean(document.getElementById('app')&&!document.getElementById('app').hidden)",'authenticated dashboard');
 await until("Boolean(document.getElementById('company-name')?.textContent)",'company header');
 assert.equal(await evaluate("document.getElementById('company-name').textContent"),account.slug);
 await mkdir('acceptance-evidence',{recursive:true});await screenshot('dashboard-desktop.png');
 await evaluate("document.querySelector('[data-page=flow-builder]').click()");
 await until("Boolean(document.getElementById('flow-builder')&&!document.getElementById('flow-builder').hidden)",'flow builder');
 await until("Boolean(document.querySelector('.canvas-node'))",'flow canvas blocks');
 const count=await evaluate("document.querySelectorAll('.canvas-node').length");assert.ok(count>=2,'Expected editable flow steps');
 await screenshot('flow-builder-desktop.png');
 await evaluate("document.querySelector('.flow-canvas')?.scrollIntoView({block:'start'})");
 await sleep(200);await screenshot('flow-builder-canvas-desktop.png');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await sleep(300);await evaluate("window.scrollTo(0,0)");await screenshot('flow-builder-mobile.png');
 await evaluate("document.querySelector('.flow-canvas')?.scrollIntoView({block:'start'})");
 await sleep(250);await screenshot('flow-builder-canvas-mobile.png');
 const bodyWidth=await evaluate('document.documentElement.scrollWidth');
 assert.ok(Number.isFinite(bodyWidth)&&bodyWidth<3000,'Mobile flow canvas overflows document excessively');
 // Actual owner CRUD and publication through rendered forms, including stored-XSS probe.
 await evaluate("document.querySelector('[data-page=catalog]').click()");
 await until("!document.getElementById('catalog').hidden && Boolean(document.getElementById('catalog-form')?.onsubmit)",'catalog form initialization');
 const probe='Browser fixture <img src=x onerror=window.__xssProbe=1>';
 await evaluate(`(()=>{const f=document.getElementById('catalog-form');f.elements.title.value=${JSON.stringify(probe)};f.elements.description.value='Browser-approved fixture';f.requestSubmit()})()`);
 await until(`Boolean([...document.querySelectorAll('#catalog-items article')].find(c=>c.textContent.includes(${JSON.stringify(probe)})))`,'catalog created');
 assert.equal(await evaluate('Boolean(window.__xssProbe)'),false);
 const findCard=`[...document.querySelectorAll('#catalog-items article')].find(c=>c.textContent.includes(${JSON.stringify(probe)}))`;
 await evaluate(`[...(${findCard}).querySelectorAll('button')].find(b=>b.textContent==='تعديل').click()`);
 await until(`document.getElementById('catalog-form').elements.title.value===${JSON.stringify(probe)}`,'edit populated');
 await evaluate("(()=>{const f=document.getElementById('catalog-form');f.elements.description.value='Edited through browser';f.requestSubmit()})()");
 await until(`(${findCard})?.textContent.includes('Edited through browser')`,'catalog edit saved');
 await evaluate(`[...(${findCard}).querySelectorAll('button')].find(b=>b.textContent==='اعتماد ونشر').click()`);
 await until(`(${findCard})?.textContent.includes('PUBLISHED')`,'catalog published');
 await screenshot('catalog-crud-published.png');
 await evaluate(`[...(${findCard}).querySelectorAll('button')].find(b=>b.textContent==='أرشفة').click()`);
 await until(`(${findCard})?.textContent.includes('ARCHIVED')`,'catalog archived');
 await evaluate("document.querySelector('[data-page=flow-builder]').click()");
 await until("Boolean(document.querySelector('.canvas-node'))",'editable canvas');
 await evaluate("(()=>{const input=document.getElementById('builder-name');input.value='Browser saved publication';input.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('builder-save').click()})()");
 await until("document.getElementById('notice').textContent.includes('تم حفظ مسودة')",'flow save');
 await evaluate("document.getElementById('builder-publish').click()");
 await until("document.getElementById('notice').textContent.includes('تم نشر إصدار')",'flow publish');
 await evaluate("document.querySelector('[data-page=privacy]').click()");
 await until("Boolean(document.querySelector('#privacy-tools input[name=days]'))",'privacy settings');
 await evaluate("(()=>{const h=document.getElementById('privacy-tools');h.querySelector('input[name=days]').value='31';h.querySelector('button.primary').click()})()");
 await until("document.querySelector('#privacy-tools input[name=days]')?.value==='31'",'privacy saved');
 await evaluate("document.querySelector('[data-page=integrations]').click()");
 await until("!document.getElementById('integrations').hidden",'integration validation page');
 await evaluate("(()=>{const f=document.getElementById('integration-form');f.elements.name.value='Rejected destination';f.elements.url.value='https://unapproved.fixture.test';f.requestSubmit()})()");
 await until("document.getElementById('notice').classList.contains('error')",'unapproved host error');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert.ok(await evaluate("document.activeElement!==document.body"),'Keyboard Tab must reach an actionable control');
 console.log('PASS browser real catalog create/edit/publish/archive + stored XSS text safety; flow save/publish; privacy save; rejected integration host; keyboard Tab');
 // Visit every owner page at desktop/tablet/mobile widths; no connect/send/publish actions.
 const pages=await evaluate("[...document.querySelectorAll('[data-page]')].map(n=>n.dataset.page)");
 const pageEvidence=[];
 for(const [device,width,height] of [['desktop',1366,900],['tablet',820,1180],['mobile',390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:device!=='desktop'});
  for(const page of pages){
   await evaluate(`document.querySelector('[data-page="${page}"]').click()`);
   await until(`Boolean(document.getElementById(${JSON.stringify(page)})&&!document.getElementById(${JSON.stringify(page)}).hidden)`,'page '+page);
   await sleep(450);
   const evidence=await evaluate(`(()=>{const p=document.getElementById(${JSON.stringify(page)});return {buttons:p.querySelectorAll('button').length,forms:p.querySelectorAll('form').length,unnamedButtons:[...p.querySelectorAll('button')].filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')).length}})()`);
   assert.equal(evidence.unnamedButtons,0,'Buttons must have accessible names: '+page);
   await evaluate('window.scrollTo(0,0)');await screenshot(page+'-'+device+'.png');pageEvidence.push({page,device,...evidence});
  }
 }
 await writeFile('acceptance-evidence/browser-pages.json',JSON.stringify(pageEvidence,null,2));
 assert.equal(network.some(n=>n.status>=500),false,'UI must not encounter server errors');
 console.log('PASS '+pageEvidence.length+' owner page/viewport visits with named buttons (screen loading only; not all actions/forms)');
 await evaluate("document.getElementById('logout').click()");
 await until("Boolean(document.getElementById('login')&&!document.getElementById('login').hidden)",'logout/login screen');
 assert.equal(await evaluate("document.getElementById('app').hidden"),true);
 // Customer-facing Website Widget: load actual deployed widget.js and talk to the
 // same PostgreSQL-backed flow engine; no provider accounts or mocked chat messages.
 assert.match(account.widgetKey||'',/^[A-Za-z0-9_-]{32}$/,'Acceptance widget key required');
 await send('Page.navigate',{url:base+'/join.html'});
 await until("document.readyState==='complete'",'website host page');
 const widgetBoot="(()=>{document.body.replaceChildren();const h=document.createElement('h1');h.textContent='موقع تجريبي — واجهة العميل';document.body.append(h);const p=document.createElement('p');p.textContent='محادثة Website Chat مع بوت منشور في قاعدة بيانات الاختبار';document.body.append(p);const s=document.createElement('script');s.src='/widget.js';s.dataset.key="+JSON.stringify(account.widgetKey)+";document.body.append(s);return true})()";
 await evaluate(widgetBoot);
 const hostExpr="[...document.querySelectorAll('body > div')].find(n=>n.shadowRoot?.querySelector('section'))";
 await until("Boolean("+hostExpr+")",'real embedded widget script');
 await evaluate("(()=>{const n="+hostExpr+";n.shadowRoot.querySelector('button').click();return true})()");
 await until("("+hostExpr+")?.shadowRoot.querySelectorAll('.bubble').length>=2",'real published flow in visitor widget');
 await screenshot('website-widget-customer-desktop.png');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await sleep(220);await screenshot('website-widget-customer-mobile.png');
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await evaluate("(()=>{const n="+hostExpr+";const b=[...n.shadowRoot.querySelectorAll('.choices button')].find(x=>x.textContent.trim()==='موظف');if(!b)throw new Error('Live flow employee action missing');b.click();return true})()");
 await until("("+hostExpr+")?.shadowRoot.querySelector('.error')?.textContent.includes('المحادثة مع موظف الشركة')",'website staff handoff');
 await screenshot('website-widget-staff-handoff-desktop.png');
 assert.equal(network.some(n=>n.status>=500),false,'Customer widget must not encounter server 5xx');
 console.log('PASS actual Website Widget desktop/mobile with published flow and customer-to-employee handoff; three extra Chromium PNGs');
 assert.deepEqual(exceptions,[],`Browser JavaScript exceptions: ${exceptions.join(', ')}`);
 if(account.platform){
  await send('Page.navigate',{url:base+'/platform.html'});
  await until("Boolean(document.getElementById('platform-refresh')?.onclick)",'platform JS');
  await evaluate(`(()=>{const f=document.getElementById('platform-login-form');const p=${JSON.stringify(account.platform)};f.elements.email.value=p.email;f.elements.password.value=p.password;f.requestSubmit()})()`);
  await until("!document.getElementById('platform-workspace').hidden && document.getElementById('platform-plans').options.length>0",'platform login');
  await screenshot('platform-admin-authenticated.png');
  await evaluate(`(()=>{const f=document.getElementById('platform-create-form');f.elements.name.value='Browser company fixture';f.elements.slug.value='browser-'+Date.now();f.elements.ownerEmail.value='browser-owner@example.invalid';f.requestSubmit()})()`);
  await until("!document.getElementById('platform-invite-result').hidden && document.getElementById('platform-invite-link').value.includes('#owner.')",'platform company create');
  await evaluate("document.getElementById('platform-logout').click()");
  await until("!document.getElementById('platform-login').hidden",'platform logout');
  console.log('PASS actual platform-admin browser login/company creation/invite generation/logout; private invitation never captured');
 }
 console.log('PASS headless Chrome: RTL company login, real dashboard, flow canvas, mobile viewport, logout');
 console.log('PASS screenshots: dashboard, desktop/mobile flow builder and actual canvas views');
}catch(error){console.error('BROWSER ACCEPTANCE FAILURE:',error);process.exitCode=1}
finally{
 if(ws){ws.close();await sleep(100)}
 if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit').catch(()=>{}),sleep(1600)]);if(child.exitCode===null)child.kill('SIGKILL')}
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
}