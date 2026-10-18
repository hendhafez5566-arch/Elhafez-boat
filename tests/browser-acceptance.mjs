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
 // Vessel workspace acceptance: real nav buttons moved, drawer opens and search works.
 assert.equal(await evaluate("document.querySelectorAll('.vessel-rail .vessel-rail-item').length"),5,'Expected five focus destinations in narrow rail');
 assert.equal(await evaluate("Boolean(document.querySelector('.vessel-home .vessel-hero') && document.querySelector('.vessel-home-panels #dashboard-ready'))"),true,'Dashboard widgets survive layout composition');
 await evaluate("document.querySelector('.vessel-menu-button').click()");
 assert.equal(await evaluate("document.querySelector('.vessel-drawer').hidden"),false,'Navigation drawer opens');
 await screenshot('vessel-navigation-open-desktop.png');
 const matching=await evaluate("(()=>{const s=document.querySelector('.vessel-search');s.value='الخصوصية';s.dispatchEvent(new Event('input',{bubbles:true}));return [...document.querySelectorAll('.vessel-menu-section button[data-page]')].filter(b=>b.style.display!=='none'&&!b.hidden).map(b=>b.dataset.page)})()");
 assert.deepEqual(matching,['privacy'],'Search should show only matching destination');
 await evaluate("document.querySelector('.vessel-close').click()");
 assert.equal(await evaluate("document.querySelector('.vessel-drawer').hidden"),true,'Navigation drawer closes');

 await evaluate("document.querySelector('[data-page=flow-builder]').click()");
 await until("Boolean(document.getElementById('flow-builder')&&!document.getElementById('flow-builder').hidden)",'flow builder');
 await until("Boolean(document.querySelector('.canvas-node'))",'flow canvas blocks');
 const count=await evaluate("document.querySelectorAll('.canvas-node').length");assert.ok(count>=2,'Expected editable flow steps');
 await screenshot('flow-builder-desktop.png');

 // Real Chromium verifies new layout/palette and a visual-only step sample.
 assert.equal(await evaluate("Boolean(document.querySelector('.builder-studio .builder-stage .flow-canvas'))"),true,'Canvas should be central');
 assert.equal(await evaluate("Boolean(document.querySelector('.builder-palette .builder-quick'))"),true,'Quick palette should exist');
 await evaluate("document.querySelector('.builder-quick-item[aria-label=\"إضافة قائمة اختيارات\"]').click()");
 await until("Boolean(document.querySelector('.builder-properties .builder-step-sample .builder-sample-choice'))",'List preview');
 await evaluate("document.querySelector('.builder-stage').scrollIntoView({block:'start'})");
 await screenshot('visual-studio-list-editor-desktop.png');
 await evaluate("document.querySelector('.builder-quick-item[aria-label=\"إضافة أزرار رد\"]').click()");
 await until("Boolean(document.querySelector('.builder-properties .builder-step-sample .builder-sample-choice'))",'Buttons preview');
 await screenshot('visual-studio-buttons-editor-desktop.png');

 // Real business-user choice editor: 3 WhatsApp buttons, 10 WhatsApp list items.
 await evaluate("(()=>{const host=document.getElementById('builder-editor');const add=()=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()==='إضافة اختيار').click();add();add()})()");
 assert.equal(await evaluate("document.querySelectorAll('#builder-editor .builder-choice').length"),3,'WhatsApp buttons cap is 3');
 await evaluate("(()=>{const input=document.querySelector('#builder-editor .builder-choice input[aria-label]');input.value='استفسار سريع';input.dispatchEvent(new Event('input',{bubbles:true}));const move=document.querySelector('#builder-editor .builder-choice-actions button:nth-child(2)');move.click()})()");
 assert.equal(await evaluate("document.querySelectorAll('#builder-editor .builder-choice input[aria-label]')[1].value"),'استفسار سريع','Choice reorder must preserve its title');
 await evaluate("(()=>{const btn=[...document.querySelectorAll('#builder-editor button')].find(b=>b.textContent.trim()==='إضافة اختيار');btn.click()})()");
 assert.equal(await evaluate("document.querySelectorAll('#builder-editor .builder-choice').length"),3,'Fourth WhatsApp button must be rejected');
 await evaluate("document.querySelector('.builder-quick-item[aria-label=\"إضافة قائمة اختيارات\"]').click()");
 await until("document.querySelectorAll('#builder-editor .builder-choice').length===1",'list editor initialized');
 await evaluate("(()=>{const add=()=>[...document.querySelectorAll('#builder-editor button')].find(b=>b.textContent.trim()==='إضافة اختيار').click();for(let i=1;i<10;i++)add();add()})()");
 assert.equal(await evaluate("document.querySelectorAll('#builder-editor .builder-choice').length"),10,'WhatsApp list cap is 10');
 console.log('PASS choice editor: live titles, ordering and real WhatsApp 3-button / 10-list limits');

 const dropped=await evaluate("(()=>{const area=document.querySelector('.flow-canvas'),data=new DataTransfer(),before=document.querySelectorAll('.canvas-node').length,r=area.getBoundingClientRect();data.setData('application/x-boat-block','TEXT');area.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data,clientX:r.left+Math.min(150,r.width/2),clientY:r.top+150}));return {before,after:document.querySelectorAll('.canvas-node').length}})()");
 assert.equal(dropped.after,dropped.before+1,'Dropping a palette block should create a canvas node');
 console.log('PASS visual studio palette, list/buttons sample and canvas block drop in Chromium');

 // Premium studio acceptance: real browser and real draft editor, not mock screenshots.
 const startPorts=await evaluate("document.querySelectorAll('.canvas-node[data-node-id=start] .canvas-add').length");
 assert.ok(startPorts>=1,'Starting step needs contextual add button');
 const beforeInsert=await evaluate("document.querySelectorAll('.canvas-node').length");
 await evaluate("document.querySelector('.canvas-node[data-node-id=start] .canvas-add').click()");
 await until("Boolean(document.querySelector('.builder-component-dialog[open] .builder-picker-grid button'))",'contextual component picker');
 await screenshot('premium-component-picker-desktop.png');
 await evaluate("(()=>{const p=document.querySelector('.builder-component-dialog');const search=p.querySelector('input[type=search]');search.value='رسالة';search.dispatchEvent(new Event('input',{bubbles:true}));const choice=[...p.querySelectorAll('.builder-picker-item')].find(b=>b.textContent.includes('رسالة نصية'));if(!choice)throw Error('TEXT missing from searchable picker');choice.click()})()");
 await until("document.querySelectorAll('.canvas-node').length>"+beforeInsert,'contextual step insertion');
 assert.equal(await evaluate("document.querySelectorAll('.canvas-node').length"),beforeInsert+1,'Contextual insertion adds exactly one node');
 await until("Boolean(document.querySelector('.builder-inspector:not([hidden]) textarea'))",'contextual inspector');
 const newMessage='رسالة جديدة من تجربة المتصفح — لا ترسل إلى عملاء حقيقيين';
 const editResult=await evaluate(`(()=>{try{const t=document.querySelector('.builder-inspector textarea');t.value=${JSON.stringify(newMessage)};t.dispatchEvent(new Event('input',{bubbles:true}));return {ok:true}}catch(e){return {error:String(e),stack:String(e.stack||'')}}})()`);
 assert.equal(editResult.error,undefined,'Inspector input must not throw: '+JSON.stringify(editResult));
 assert.ok((await evaluate("document.querySelector('.canvas-node.selected .canvas-message-text')?.textContent||''")).includes('رسالة جديدة'),'Live canvas message must reflect inspector edits');
 await screenshot('premium-new-message-inspector-desktop.png');
 await evaluate("document.querySelector('.builder-properties > button').click()");
 assert.equal(await evaluate("document.querySelector('.builder-inspector').hidden"),true,'Inspector closes without losing draft');
 const viewBefore=await evaluate("document.querySelector('.flow-stage').style.transform");
 await evaluate("document.querySelector('.builder-view-actions button:nth-child(3)').click()");
 assert.notEqual(await evaluate("document.querySelector('.flow-stage').style.transform"),viewBefore,'Zoom toolbar updates canvas');
 await evaluate("document.querySelector('.builder-view-actions button:nth-child(4)').click()");
 await screenshot('premium-full-canvas-desktop.png');
 await evaluate("document.querySelector('.builder-view-actions button.primary').click()");
 await until("Boolean(document.querySelector('.builder-preview-dialog[open]'))",'phone simulator dialog');
 await sleep(450);await screenshot('premium-phone-simulator-desktop.png');
 await evaluate("document.querySelector('.builder-preview-dialog .builder-dialog-header button').click()");
 await evaluate("document.querySelector('.builder-view-actions button:last-child').click()");
 assert.equal(await evaluate("document.body.classList.contains('studio-focus')"),true,'Full-screen studio hides navigation');
 await sleep(200);
 assert.equal(await evaluate("(()=>{const r=document.querySelector('.flow-canvas').getBoundingClientRect();return r.top<innerHeight&&r.bottom>70&&r.width>600})()"),true,'Focus mode must actually show a usable canvas in viewport');
 await screenshot('premium-studio-focus-desktop.png');
 await evaluate("document.querySelector('.builder-view-actions button:last-child').click()");
 console.log('PASS contextual add step, graph insertion, live inspector update, zoom, phone modal and full-screen');


 // Exercise the real guided builder in Chrome, without saving/publishing or connecting accounts.
 assert.equal(await evaluate("Boolean(document.querySelector('.boat-guide-hero button'))"),true,'Guided bot creator must be on Flow Builder');
 await evaluate("document.querySelector('.boat-guide-hero button').click()");
 await until("!document.querySelector('.boat-guide-panel').hidden",'guided bot setup');
 await screenshot('guided-bot-01-goal-desktop.png');
 await evaluate("(()=>{const a=document.querySelector('.boat-guide-quick textarea');a.value='شركة سياحة تعرض برامج العمرة والأسعار';a.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.boat-guide-quick button').click()})()");
 await evaluate("document.querySelector('.boat-guide-actions .primary').click()");
 await until("Boolean(document.querySelector('.boat-guide-body input[maxlength=\"80\"]'))",'guided company information');
 await screenshot('guided-bot-02-company-desktop.png');
 await evaluate("(()=>{const a=document.querySelector('.boat-guide-body input[maxlength=\"80\"]');a.value='شركة رواد السياحة التجريبية';a.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.boat-guide-actions .primary').click()})()");
 await until("Boolean(document.querySelector('.boat-guide-map li'))",'generated journey review');
 await screenshot('guided-bot-03-journey-desktop.png');
 await evaluate("document.querySelector('.boat-guide-actions .primary').click()");
 await until("document.getElementById('builder-name').value.includes('شركة رواد السياحة التجريبية')",'actual editable draft created by guide');
 assert.equal(await evaluate("document.getElementById('builder-unsaved').textContent"),'تعديلات غير محفوظة');
 await screenshot('guided-bot-04-generated-draft-desktop.png');
 // A business owner will often leave the builder to fill the catalog first.
 // Switching sections must not erase the bot that was just generated.
 await evaluate("document.querySelector('[data-page=catalog]').click()");
 await until("!document.getElementById('catalog').hidden",'catalog after wizard');
 await evaluate("document.querySelector('[data-page=flow-builder]').click()");
 await until("!document.getElementById('flow-builder').hidden",'return to draft');
 assert.equal(await evaluate("document.getElementById('builder-name').value.includes('شركة رواد السياحة التجريبية')"),true,'Unsaved generated bot must survive section navigation');
 assert.equal(await evaluate("document.getElementById('builder-unsaved').textContent"),'تعديلات غير محفوظة');
 console.log('PASS browser guide: actual flow generation plus unsaved draft preserved across catalog navigation; no external send');

 // Build a meaningful 3-way flow in the real editor, not a two-node demonstration.
 const originalGraphCount=await evaluate("document.querySelectorAll('.canvas-node').length");
 for(let branch=0;branch<3;branch++)for(let depth=0;depth<2;depth++){
   await evaluate(`document.querySelectorAll('.canvas-node[data-node-id=menu] .canvas-add')[${branch}].click()`);
   await until("Boolean(document.querySelector('.builder-component-dialog[open] .builder-picker-item'))",'branch step picker');
   await evaluate("(()=>{const p=document.querySelector('.builder-component-dialog');const t=[...p.querySelectorAll('.builder-picker-item')].find(b=>b.textContent.includes('رسالة نصية'));if(!t)throw Error('TEXT picker missing');t.click()})()");
 }
 assert.equal(await evaluate("document.querySelectorAll('.canvas-node').length"),originalGraphCount+6,'Expected six connected branch steps');
 await evaluate("(()=>{const bar=document.querySelector('.builder-stage>.builder-toolbar');const btn=[...bar.querySelectorAll('button')].find(b=>b.textContent==='تراجع');btn.click()})()");
 assert.equal(await evaluate("document.querySelectorAll('.canvas-node').length"),originalGraphCount+5,'Undo must remove last branch step');
 await evaluate("(()=>{const bar=document.querySelector('.builder-stage>.builder-toolbar');const btn=[...bar.querySelectorAll('button')].find(b=>b.textContent==='إعادة');btn.click()})()");
 assert.equal(await evaluate("document.querySelectorAll('.canvas-node').length"),originalGraphCount+6,'Redo must restore last branch step');
 await evaluate("(()=>{const btn=[...document.querySelectorAll('.builder-view-actions button')].find(b=>b.textContent==='ترتيب تلقائي');btn.click()})()");
 const overlaps=await evaluate("(()=>{const r=[...document.querySelectorAll('.canvas-node')].map(n=>({id:n.dataset.nodeId,b:n.getBoundingClientRect()}));let count=0;for(let i=0;i<r.length;i++)for(let j=0;j<i;j++){const a=r[i].b,b=r[j].b;if(a.left<b.right-3&&a.right>b.left+3&&a.top<b.bottom-3&&a.bottom>b.top+3)count++}return count})()");
 assert.equal(overlaps,0,'Actual DOM canvas cards cannot overlap after auto-layout');
 await evaluate("document.querySelector('.builder-stage').scrollIntoView({block:'start'})");
 await screenshot('premium-large-branching-flow-desktop.png');
 // Real DOM pointer handlers: attempt to drag a card directly onto an occupied card.
 const collideDrag=await evaluate("(()=>{const nodes=[...document.querySelectorAll('.canvas-node')];const a=nodes.find(n=>n.dataset.nodeId==='welcome'),b=nodes.find(n=>n.classList.contains('canvas-text')&&n.dataset.nodeId!=='welcome');if(!a||!b)throw Error('drag nodes unavailable');const drag=b.querySelector('.canvas-title');drag.setPointerCapture=()=>{};const from=b.getBoundingClientRect(),to=a.getBoundingClientRect();const x=from.left+30,y=from.top+20;drag.onpointerdown({button:0,pointerId:41,clientX:x,clientY:y});drag.onpointermove({clientX:x+to.left-from.left,clientY:y+to.top-from.top});drag.onpointerup({});const aa=document.querySelector('.canvas-node[data-node-id=welcome]').getBoundingClientRect();const bb=document.querySelector('.canvas-node[data-node-id='+b.dataset.nodeId+']').getBoundingClientRect();return {overlap:aa.left<bb.right-3&&aa.right>bb.left+3&&aa.top<bb.bottom-3&&aa.bottom>bb.top+3}})()");
 assert.equal(collideDrag.overlap,false,'Manual pointer drag must refuse placement on top of an occupied card');
 await screenshot('premium-drag-collision-guard-desktop.png');
 await evaluate("document.querySelector('.builder-properties > button')?.click()");
 await evaluate("(()=>{const actions=[...document.querySelectorAll('.builder-view-actions button')];actions.find(x=>x.textContent.includes('إخفاء المكونات'))?.click();actions.find(x=>x.textContent.includes('الخطوة المختارة'))?.click()})()");
 await sleep(180);
 await screenshot('premium-readable-branch-desktop.png');
 await evaluate("(()=>{const t=[...document.querySelectorAll('.builder-view-actions button')].find(x=>x.textContent.includes('إظهار المكونات'));t?.click()})()");

 console.log('PASS 3-branch graph, 6 connected new steps, undo/redo, collision-free auto layout and manual pointer drag');


 await evaluate("document.querySelector('.flow-canvas')?.scrollIntoView({block:'start'})");
 await sleep(200);await screenshot('flow-builder-canvas-desktop.png');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await sleep(300);
 assert.equal(await evaluate("document.querySelector('.nav-advanced')?.open"),false,'Advanced navigation must auto-close on mobile viewport');
 await evaluate("window.scrollTo(0,0)");await screenshot('flow-builder-mobile.png');
 await evaluate("document.querySelector('.flow-canvas')?.scrollIntoView({block:'start'})");
 await sleep(250);await screenshot('flow-builder-canvas-mobile.png');
 await evaluate("document.querySelector('.builder-view-actions button.primary').click()");
 await until("Boolean(document.querySelector('.builder-preview-dialog[open]'))",'mobile phone simulator');
 await screenshot('premium-phone-simulator-mobile.png');
 await evaluate("document.querySelector('.builder-preview-dialog .builder-dialog-header button').click()");
 const mobileMeasure=await evaluate("(()=>{const nav=document.querySelector('.sidebar nav'),sidebar=document.querySelector('.sidebar'),page=document.getElementById('flow-builder');return {sidebarHeight:Math.round(sidebar.getBoundingClientRect().height),navHeight:Math.round(nav.getBoundingClientRect().height),pageTop:Math.round(page.getBoundingClientRect().top)}})()");
 assert.ok(mobileMeasure.sidebarHeight<220,'Mobile header must not consume full viewport: '+JSON.stringify(mobileMeasure));
 assert.ok(mobileMeasure.navHeight<90,'Mobile nav must be horizontally scrollable, not vertically expanded: '+JSON.stringify(mobileMeasure));
 assert.ok(mobileMeasure.pageTop<650,'Mobile main content should be reachable in first viewport: '+JSON.stringify(mobileMeasure));
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
 if(process.env.CI_LOCAL_CLOSURE==='1'){const {browserCoexistence}=await import('./browser-coexistence.mjs');await browserCoexistence({ws,send,evaluate,until,screenshot,base});}
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
 // Roles authenticate through the real login form; hidden admin controls cannot be used.
 for(const roleAccount of account.roles||[]){
  await send('Page.navigate',{url:base+'/'});await until("Boolean(document.getElementById('login-form')?.onsubmit)",'role login JS');
  await evaluate(`(()=>{const p=${JSON.stringify(roleAccount)};const f=document.getElementById('login-form');f.elements.tenantSlug.value=p.slug;f.elements.email.value=p.email;f.elements.password.value=p.password;f.requestSubmit()})()`);
  await until("!document.getElementById('app').hidden",'role dashboard '+roleAccount.role);
  assert.equal(await evaluate("document.querySelector('[data-page=flow-builder]').hidden"),roleAccount.role!=='MANAGER');
  await evaluate("document.querySelector('[data-page=wa-inbox]').click()");await until("!document.getElementById('wa-inbox').hidden",'role inbox');
  await screenshot('role-'+roleAccount.role.toLowerCase()+'-inbox.png');
  await evaluate("document.getElementById('logout').click()");await until("!document.getElementById('login').hidden",'role logout');
 }
 console.log('PASS browser MANAGER/AGENT/VIEWER real login, inbox, admin visibility and logout');
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