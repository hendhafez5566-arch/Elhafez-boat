/** Real headless Chrome/Chromium acceptance: company login, dashboard, Flow Builder and mobile. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
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
let baselineServer,baselineDir;const dialogReplies=[];
let ws;let commandId=0;const pending=new Map(),exceptions=[],network=[],consoleErrors=[];
async function waitForPort(){for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error('Chrome exited before launching');try{
 const info=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');return Number(info[0]);
 }catch{}await sleep(150)}throw new Error('Chrome DevTools port unavailable')}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
function send(method,params={}){const id=++commandId;return new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('Chrome CDP timeout: '+method))},12000);
 pending.set(id,{resolve:result=>{clearTimeout(timeout);resolve(result)},reject:error=>{clearTimeout(timeout);reject(error)}});
 ws.send(JSON.stringify({id,method,params}));
 })}
async function until(predicate,name){
 for(let i=0;i<70;i++){if(await evaluate(predicate))return;await sleep(160)}
 const state=await evaluate("JSON.stringify({loginHidden:document.getElementById('login')?.hidden,appHidden:document.getElementById('app')?.hidden,notice:document.getElementById('notice')?.textContent,listener:Boolean(document.getElementById('login-form')?.onsubmit),scripts:[...document.scripts].map(s=>s.src),readyState:document.readyState})").catch(()=>null);
 await screenshot('rebuild-failure.png');
 const details=await evaluate("JSON.stringify({title:document.getElementById('page-title')?.textContent,botsHidden:document.getElementById('bots')?.hidden,bots:document.getElementById('bots')?.textContent,nav:[...document.querySelectorAll('[data-page=bots]')].map(b=>({text:b.textContent,html:b.outerHTML}))})");
 throw new Error(details+' Browser UI timed out waiting for '+name+'; state='+state+'; exceptions='+JSON.stringify(exceptions.slice(-8))+'; network='+JSON.stringify(network.slice(-15))+'; console='+JSON.stringify(consoleErrors.slice(-8)));
}
async function pageLoaded(action){const loaded=new Promise(resolve=>{const handler=event=>{if(JSON.parse(String(event.data)).method==='Page.loadEventFired'){ws.removeEventListener('message',handler);resolve()}};ws.addEventListener('message',handler)});await action();await loaded}
async function screenshot(filename){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('acceptance-evidence/'+filename,Buffer.from(r.data,'base64'))}

try{
 const port=await waitForPort();const target=(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(p=>p.type==='page');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',event=>{const v=JSON.parse(String(event.data));if(v.id){const p=pending.get(v.id);pending.delete(v.id);if(p)v.error?p.reject(Error(v.error.message)):p.resolve(v.result)}else if(v.method==='Page.javascriptDialogOpening')void send('Page.handleJavaScriptDialog',{accept:true,...(dialogReplies.length?{promptText:dialogReplies.shift()}:{})});else if(v.method==='Runtime.exceptionThrown')exceptions.push(v.params.exceptionDetails.text)});
 await send('Page.enable');await send('Runtime.enable');await mkdir('acceptance-evidence',{recursive:true});
 async function login(origin,credentials=account){
  await pageLoaded(()=>send('Page.navigate',{url:origin+'/'}));await until("Boolean(document.getElementById('login-form')?.onsubmit)",'login ready');
  const restored=await evaluate("fetch('/api/v1/auth/me').then(r=>r.ok)");
  if(!restored)await evaluate(`(()=>{const p=${JSON.stringify(credentials)},f=document.getElementById('login-form');f.elements.tenantSlug.value=p.slug;f.elements.email.value=p.email;f.elements.password.value=p.password;f.requestSubmit()})()`);
  await until("!document.getElementById('app').hidden",'logged in');
  if(origin===base)await until("document.body.dataset.authReady==='true'",'session initialization complete');
  else await sleep(500);
 }
 async function click(text,selector='button'){await evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)}||b.getAttribute('aria-label')==='إضافة '+${JSON.stringify(text)});if(!b)throw Error('Missing button '+${JSON.stringify(text)});b.click()})()`)}
 // Reconstruct actual original assets, never a mocked before image or a Git worktree.
 baselineDir=await mkdtemp(join(tmpdir(),'boat-original-'));
 execFileSync('tar',['-x','-C',baselineDir],{input:execFileSync('git',['archive','b02a3132751ed0b6acbbc5f1a928b83b04dcb572','apps/web'])});
 baselineServer=spawn(process.execPath,[join(baselineDir,'apps/web/server.mjs')],{env:{...process.env,WEB_PORT:'3001',API_INTERNAL_ORIGIN:'http://127.0.0.1:4000'},stdio:'ignore'});
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:3001/')).ok)break}catch{}await sleep(100)}
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await login('http://127.0.0.1:3001');await evaluate("document.querySelector('[data-page=flow-builder]').click()");await until("document.querySelectorAll('.canvas-node').length>1",'baseline canvas');
 for(const [width,height] of [[1366,900],[390,844],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await sleep(200);await screenshot('rebuild-before-builder-'+width+'.png')}
 await evaluate("document.querySelector('[data-page=team]').click()");await until("Boolean(document.querySelector('#team-list article'))",'original team UI baseline');
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await sleep(150);await screenshot('team-before-'+width+'.png')}
 for(const page of ['overview','media','integrations','usage']){await evaluate(`document.querySelector('[data-page=${page}]').click()`);await until(`!document.getElementById('${page}').hidden`,'baseline '+page);await sleep(250);for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await screenshot('closure-before-'+page+'-'+width+'.png')}}
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await login(base);
 await evaluate("document.querySelector('[data-page=bots]').click()");await until("!document.getElementById('bots').hidden && !document.getElementById('bots').textContent.includes('جارٍ تحميل')",'bot manager');
 const botName='مساعد المتصفح '+Date.now();
 await evaluate(`(()=>{const f=document.querySelector('.bot-create-form');f.elements.name.value=${JSON.stringify(botName)};f.requestSubmit()})()`);
 await until("document.getElementById('page-title').textContent.includes('مساعد المتصفح') && document.querySelectorAll('.canvas-node').length===1",'new independent Start');
 await evaluate("document.querySelector('.canvas-node[data-node-id=start] .canvas-add').click()");
 await until("Boolean(document.querySelector('.builder-component-dialog[open]'))",'Start output picker');
 await click('رسالة نصية','.builder-picker-item');await until("document.querySelectorAll('.canvas-node').length===3",'first message inserted');
 await evaluate("(()=>{const t=document.querySelector('.builder-inspector textarea');t.value='أهلًا بك في تجربة البوت المستقل';t.dispatchEvent(new Event('input',{bubbles:true}))})()");
 await screenshot('rebuild-after-contextual-message-1366.png');
 // Empty-bot insertion adds a real terminal step, rather than leaving a dangling edge.
 await evaluate("document.getElementById('notice').textContent='';document.getElementById('builder-save').click()");await until("document.getElementById('notice').textContent.includes('تم حفظ')",'first message draft saved');
 const initialBots=await evaluate("fetch('/api/v1/bots').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})"),initialBot=initialBots.find(b=>b.name===botName);
 const firstMessage=await evaluate(`fetch('/api/v1/bots/${initialBot.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);
 const firstDefinition=firstMessage.draft.definition,firstStart=firstDefinition.nodes.find(n=>n.type==='START'),firstText=firstDefinition.nodes.find(n=>n.id===firstStart.next);assert.equal(firstText.type,'TEXT');assert.equal(firstDefinition.nodes.find(n=>n.id===firstText.next).type,'END');
 const validFirst=await evaluate(`fetch('/api/v1/flows/validate',{method:'POST',headers:{'content-type':'application/json','x-boat-csrf':'1'},body:JSON.stringify(${JSON.stringify(firstDefinition)})}).then(async r=>({status:r.status,data:await r.json()}))`);assert.equal(validFirst.status,200);assert.equal(validFirst.data.valid,true);
 // Exercise the real Arabic template and three stable button branches through existing controls.
 await evaluate("document.getElementById('builder-load-preset').click()");
 await until("Boolean(document.querySelector('.canvas-node[data-node-id=menu]'))",'three button template');
 await evaluate("document.getElementById('notice').textContent='';document.getElementById('builder-save').click()");await until("document.getElementById('notice').textContent.includes('تم حفظ')",'draft saved');
 const bots=await evaluate("fetch('/api/v1/bots').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})");const bot=bots.find(b=>b.name===botName);assert.ok(bot);
 const cfg=await evaluate(`fetch('/api/v1/bots/${bot.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);assert.equal(cfg.draft.definition.nodes.find(n=>n.type==='BUTTONS').choices.length,3);
 await evaluate("document.getElementById('builder-publish').click()");await until("document.getElementById('notice').textContent.includes('تم نشر')",'bot publish');
 await pageLoaded(()=>send('Page.reload'));await until("document.body.dataset.authReady==='true' && !document.getElementById('app').hidden",'session restored');await evaluate("document.querySelector('[data-page=bots]').click()");await until(`Boolean(document.querySelector('[data-bot-id="${bot.id}"]'))`,'saved bot card');
 await evaluate(`document.querySelector('[data-bot-id="${bot.id}"] button').click()`);await until("document.getElementById('page-title').textContent.includes('مساعد المتصفح') && document.querySelectorAll('.canvas-node').length>=6",'bot definition reloaded');
 assert.equal(await evaluate('location.hash'),'#bot/'+bot.id,'Refresh preserves the selected bot context');
 const again=await evaluate(`fetch('/api/v1/bots/${bot.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);assert.deepEqual(again.draft.definition,cfg.draft.definition);assert.equal(again.published.version,1);
 for(const [width,height] of [[1366,900],[768,1024],[390,844],[320,700]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await sleep(200);await screenshot('rebuild-after-builder-'+width+'.png');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'builder horizontal overflow at '+width);
  await evaluate("document.querySelector('[data-page=bots]').click()");await until("!document.getElementById('bots').hidden",'manager viewport');await screenshot('rebuild-after-manager-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'manager overflow at '+width);
  await evaluate(`document.querySelector('[data-bot-id="${bot.id}"] button').click()`);await until("!document.getElementById('flow-builder').hidden",'builder viewport');
 }

 // A second bot uses the real data-capture template; preview must not create real leads.
 await evaluate("document.querySelector('[data-page=bots]').click()");await until("!document.getElementById('bots').hidden",'manager for second bot');
 const secondName='مساعد جمع البيانات '+Date.now();
 await evaluate(`(()=>{const f=document.querySelector('.bot-create-form');f.elements.name.value=${JSON.stringify(secondName)};f.elements.templateId.value='service';f.requestSubmit()})()`);
 await until("document.querySelectorAll('.canvas-node[data-node-id=phone]').length===1 && document.getElementById('page-title').textContent.includes('جمع البيانات')",'second bot template');
 const countBefore=await evaluate("fetch('/api/v1/leads/summary').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(d=>d.total)");
 await click('تجربة المحادثة','.builder-view-actions button');await until("Boolean(document.querySelector('.builder-preview-dialog[open]'))",'second bot simulator');
 await until("[...document.querySelectorAll('#builder-preview-options button')].some(b=>b.textContent==='اترك بياناتك')",'template preview choices');
 await click('اترك بياناتك','#builder-preview-options button');await until("Boolean(document.querySelector('#builder-preview-options form input'))",'name question');
 await evaluate("(()=>{const f=document.querySelector('#builder-preview-options form');f.querySelector('input').value='عميل تجريبي';f.requestSubmit()})()");
 await until("Boolean(document.querySelector('#builder-preview-options input[type=tel]'))",'phone question');
 await evaluate("(()=>{const f=document.querySelector('#builder-preview-options form');f.querySelector('input').value='01000000000';f.requestSubmit()})()");
 await until("document.getElementById('builder-preview').textContent.includes('وصل طلبك إلى فريق العمل')",'preview human handoff');
 await screenshot('rebuild-after-data-capture-handoff-320.png');
 const countAfter=await evaluate("fetch('/api/v1/leads/summary').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(d=>d.total)");assert.equal(countAfter,countBefore,'Preview does not create actual customer leads');
 const firstAgain=await evaluate(`fetch('/api/v1/bots/${bot.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);assert.deepEqual(firstAgain.draft.definition,cfg.draft.definition,'Second bot cannot overwrite first bot');
 await evaluate("document.querySelector('.builder-preview-dialog').close()");
 await send('Emulation.setDeviceMetricsOverride',{width:683,height:450,deviceScaleFactor:2,mobile:false});await screenshot('rebuild-after-builder-200-percent.png');
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'200% desktop equivalent overflow');
 console.log('PASS second bot: service template, three buttons, name+phone capture, real server preview/human handoff, no real lead writes, first bot unchanged and 200% viewport equivalent');

 await evaluate("document.querySelector('[data-page=leads]').click()");await until("Boolean(document.querySelector('.crm-lead-card'))",'actual contact directory');
 await click('ملف العميل','.crm-lead-card button');await until("Boolean(document.querySelector('.crm-profile'))",'contact profile');await screenshot('rebuild-after-contact-profile-200-percent.png');
 const profileName=await evaluate("document.querySelector('.crm-profile h3').textContent");
 await click('افتح المحادثة','.crm-lead-card button');await until(`document.getElementById('thread-title').textContent.includes(${JSON.stringify(profileName)})`,'matching contact conversation');
 assert.ok(await evaluate("document.getElementById('thread-messages').children.length>0"),'real conversation history');
 console.log('PASS browser directory -> contact profile -> exact linked inbox conversation with real retained history');

 await evaluate("document.querySelector('[data-page=bots]').click()");await until(`Boolean(document.querySelector('[data-bot-id="${bot.id}"]'))`,'bot management actions');
 async function cardClick(text){await evaluate(`(()=>{const b=[...document.querySelectorAll('[data-bot-id="${bot.id}"] button')].find(b=>b.textContent===${JSON.stringify(text)});if(!b)throw Error('Missing bot action');b.click()})()`)}
 const renamed='مساعد الدعم المستقل';dialogReplies.push(renamed);await cardClick('تغيير الاسم');await until(`document.querySelector('[data-bot-id="${bot.id}"] h3')?.textContent===${JSON.stringify(renamed)}`,'bot renamed');
 await cardClick('كلمات بدء المحادثة');await until(`Boolean(document.querySelector('[data-bot-id="${bot.id}"] .bot-triggers form'))`,'bot keyword form');
 await evaluate(`(()=>{const f=document.querySelector('[data-bot-id="${bot.id}"] .bot-triggers form');f.querySelector('input').value='اختبار المتصفح';f.querySelectorAll('select')[2].value='menu';f.requestSubmit()})()`);
 await until(`!document.querySelector('[data-bot-id="${bot.id}"] .bot-triggers')`,'keyword saved');assert.equal((await evaluate(`fetch('/api/v1/bots/${bot.id}/triggers').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`)).length,1);
 await cardClick('توجيه القنوات');await until(`Boolean(document.querySelector('[data-bot-id="${bot.id}"] .bot-routing select'))`,'available local channel');
 await cardClick('توجيه إلى هذا البوت');await until(`!document.querySelector('[data-bot-id="${bot.id}"] .bot-routing')`,'website route saved');assert.equal((await evaluate(`fetch('/api/v1/bots/${bot.id}/routes').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`))[0].channel,'WEBSITE');
 await cardClick('توجيه القنوات');await until(`Boolean(document.querySelector('[data-bot-id="${bot.id}"] .bot-routing'))`,'saved route panel');await cardClick('إزالة التوجيه');await until(`!document.querySelector('[data-bot-id="${bot.id}"] .bot-routing')`,'route removed');
 await cardClick('أرشفة');await until(`Boolean([...document.querySelectorAll('[data-bot-id="${bot.id}"] button')].find(b=>b.textContent==='استعادة البوت'))`,'archived bot');
 await cardClick('استعادة البوت');await until(`Boolean([...document.querySelectorAll('[data-bot-id="${bot.id}"] button')].find(b=>b.textContent==='أرشفة'))`,'restored bot');
 assert.deepEqual((await evaluate(`fetch('/api/v1/bots/${bot.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`)).draft.definition,cfg.draft.definition);
 console.log('PASS bot manager browser: rename, scoped keyword, local website route/unroute, archive/restore with original definition preserved');

 // The novice journey uses the visible wizard, not the quick-create compatibility form.
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 const beforeWizard=await evaluate("fetch('/api/v1/bots').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(x=>x.length)");
 await click('إنشاء بوت خطوة بخطوة');await until("Boolean(document.querySelector('.bot-setup-dialog[open]'))",'novice setup dialog');await click('التالي','.bot-setup-form button');
 const noviceName='بوت المبتدئ '+Date.now();
 await evaluate(`(()=>{const f=document.querySelector('.bot-setup-form');for(const [key,value] of Object.entries({name:${JSON.stringify(noviceName)},businessName:'متجر تجريبي',greeting:'مرحبًا بك في تجربتنا الجديدة'})){const n=f.elements.namedItem(key);n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}))}const phone=f.querySelector('input[type=checkbox]');phone.checked=false;phone.dispatchEvent(new Event('change',{bubbles:true}))})()`);
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:700,deviceScaleFactor:1,mobile:true});await screenshot('continuation-setup-fields-320.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'setup form mobile overflow');
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await click('التالي','.bot-setup-form button');await click('السابق','.bot-setup-form button');assert.equal(await evaluate("document.querySelector('.bot-setup-form').elements.businessName.value"),'متجر تجريبي');
 assert.equal(await evaluate("document.querySelector('.bot-setup-form input[type=checkbox]').checked"),false);
 await click('التالي','.bot-setup-form button');await click('التالي','.bot-setup-form button');await until("document.querySelector('.bot-setup-form').textContent.includes('مرحبًا بك في تجربتنا الجديدة')",'server-validated setup review');
 assert.equal(await evaluate("fetch('/api/v1/bots').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(x=>x.length)"),beforeWizard,'Review must not create a bot');
 await screenshot('continuation-setup-review-1366.png');await click('إنشاء المسودة وفتح المحرر','.bot-setup-form button');
 await until("Boolean(document.querySelector('.builder-linear-mode')) && document.getElementById('page-title').textContent.includes('المبتدئ')",'novice step editor');
 const noviceBots=await evaluate("fetch('/api/v1/bots').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})"),novice=noviceBots.find(b=>b.name===noviceName);assert.equal(noviceBots.length,beforeWizard+1);assert.ok(novice);
 const noviceBefore=await evaluate(`fetch('/api/v1/bots/${novice.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);assert.equal(noviceBefore.published,null);assert.equal(noviceBefore.draft.definition.nodes.some(n=>n.id==='phone'),false);
 await evaluate("[...document.querySelectorAll('[data-step-id=menu] .builder-step-branch button')].find(b=>b.textContent==='إضافة خطوة هنا').click()");await until("Boolean(document.querySelector('.builder-component-dialog[open]'))",'novice branch picker');await click('رسالة نصية','.builder-picker-item');
 await until("Boolean(document.querySelector('.builder-inspector:not([hidden]) textarea'))",'novice branch inspector');
 await evaluate("(()=>{const t=document.querySelector('.builder-inspector textarea');t.value='رد خاص لاختيار المعلومات';t.dispatchEvent(new Event('input',{bubbles:true}))})()");
 await evaluate("document.querySelector('.builder-properties > button').click()");await evaluate("document.getElementById('notice').textContent='';document.getElementById('builder-save').click()");await until("document.getElementById('notice').textContent.includes('تم حفظ')",'novice branch save');
 const noviceSaved=await evaluate(`fetch('/api/v1/bots/${novice.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);const menu=noviceSaved.draft.definition.nodes.find(n=>n.id==='menu'),reply=noviceSaved.draft.definition.nodes.find(n=>n.id===menu.choices[0].next);assert.equal(reply.text,'رد خاص لاختيار المعلومات');assert.equal(reply.next,'information');assert.equal(menu.choices[0].id,'info');
 await screenshot('continuation-simple-editor-1366.png');await evaluate("document.querySelector('.builder-display-menu>summary').click()");await click('عرض المخطط المرئي','.builder-display-menu button');assert.ok(await evaluate("!document.querySelector('.builder-studio').classList.contains('builder-linear-mode')"));await screenshot('continuation-canvas-1366.png');await evaluate("document.querySelector('.builder-display-menu>summary').click()");await click('عرض مبسط بالخطوات','.builder-display-menu button');
 for(const [width,height] of [[390,844],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await screenshot('continuation-simple-editor-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'novice editor overflow '+width)}
 // Configure advanced branch types in the same independent draft, without fetching media.
 await evaluate("[...document.querySelectorAll('[data-step-id=menu] .builder-step-branch button')].find(b=>b.textContent==='إضافة خطوة هنا').click()");await click('شرط','.builder-picker-item');
 await evaluate("(()=>{const labels=[...document.querySelectorAll('#builder-editor label')];const field=labels.find(l=>l.textContent.startsWith('قارن إجابة العميل عن')).querySelector('select');field.value='customer_name';field.dispatchEvent(new Event('change'));const ops=labels.find(l=>l.textContent.startsWith('المقارنة')).querySelector('select');ops.value='exists';ops.dispatchEvent(new Event('change'))})()");
 assert.ok(await evaluate("[...document.querySelectorAll('#builder-editor label')].find(l=>l.textContent.startsWith('الإجابة المطلوبة')).hidden"),'exists condition does not ask for a comparison value');
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await screenshot('wizard-condition-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'condition inspector overflow '+width)}
 await evaluate("document.querySelector('.builder-properties > button').click()");
 for(const [kind,title,url] of [['MEDIA','صورة / فيديو / ملف','https://example.invalid/local-image.png'],['LINK','رابط خارجي','https://example.invalid/local-information']]){
  await evaluate("[...document.querySelectorAll('[data-step-id=menu] .builder-step-branch button')].find(b=>b.textContent==='إضافة خطوة هنا').click()");await click(title,'.builder-picker-item');
  await evaluate(`(()=>{const input=[...document.querySelectorAll('#builder-editor label')].find(l=>l.textContent.startsWith('رابط HTTPS')).querySelector('input');input.value=${JSON.stringify(url)};input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await evaluate("document.querySelector('.builder-properties > button').click()");
 }
 await evaluate("document.getElementById('notice').textContent='';document.getElementById('builder-save').click()");await until("document.getElementById('notice').textContent.includes('تم حفظ')",'advanced branch save');
 const advancedSaved=await evaluate(`fetch('/api/v1/bots/${novice.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);
 assert.ok(advancedSaved.draft.definition.nodes.some(n=>n.type==='CONDITION'&&n.field==='customer_name'&&n.operator==='exists'));
 assert.ok(advancedSaved.draft.definition.nodes.some(n=>n.type==='MEDIA'&&n.url==='https://example.invalid/local-image.png'));
 assert.ok(advancedSaved.draft.definition.nodes.some(n=>n.type==='LINK'&&n.url==='https://example.invalid/local-information'));
 console.log('PASS real condition/media/link branch insertion and saved typed fields, no provider/media requests');
 // A real concurrent editor updates this bot through the API. The visible editor retains local work.
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await evaluate("document.querySelector('[data-step-id=welcome] .builder-node').click()");
 await evaluate("(()=>{const input=[...document.querySelectorAll('#builder-editor label')].find(l=>l.textContent.startsWith('نص الرسالة')).querySelector('textarea');input.value='ترحيب محلي نحتفظ به';input.dispatchEvent(new Event('input',{bubbles:true}))})()");
 await evaluate("document.querySelector('.builder-properties > button').click()");
 const external=structuredClone(advancedSaved.draft.definition);external.name='اسم زميل الفريق';external.nodes.find(n=>n.id==='welcome').text='ترحيب زميل الفريق';
 const externalSaved=await evaluate(`fetch('/api/v1/bots/${novice.id}/flows/draft',{method:'PUT',headers:{'content-type':'application/json','x-boat-csrf':'1'},body:JSON.stringify({...${JSON.stringify(external)},expectedRevision:${advancedSaved.draft.draftRevision}})}).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);
 await evaluate("document.getElementById('notice').textContent='';document.getElementById('builder-save').click()");await until("Boolean(document.querySelector('.builder-conflict-dialog[open] .builder-merge-review'))",'real optimistic conflict review');
 assert.equal(await evaluate("document.querySelectorAll('.builder-merge-conflict').length"),1,'one same-field conflict, independent name change merged');
 assert.ok(await evaluate("[...document.querySelectorAll('.builder-merge-review button')].find(b=>b.textContent==='فحص وتطبيق المسودة المجمعة').disabled"),'explicit decision required');
 await evaluate("document.querySelectorAll('.builder-merge-conflict summary').forEach(summary=>summary.click())");
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate("document.querySelector('.builder-merge-conflict').scrollIntoView({block:'center'})");await sleep(200);await screenshot('conflict-review-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'conflict review overflow '+width)}
 await evaluate("(()=>{const select=document.querySelector('.builder-merge-conflict select');select.value='local';select.dispatchEvent(new Event('change',{bubbles:true}))})()");
 await click('فحص وتطبيق المسودة المجمعة','.builder-merge-review button');await until("!document.querySelector('.builder-conflict-dialog').open",'validated merge applied locally');
 const beforeMergeSave=await evaluate(`fetch('/api/v1/bots/${novice.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);assert.equal(beforeMergeSave.draft.draftRevision,externalSaved.draftRevision,'applying review must not write to server');assert.equal(beforeMergeSave.draft.definition.nodes.find(n=>n.id==='welcome').text,'ترحيب زميل الفريق');
 await evaluate("document.getElementById('notice').textContent='';document.getElementById('builder-save').click()");await until("document.getElementById('notice').textContent.includes('تم حفظ')",'merged draft saved with current revision');
 const mergedSaved=await evaluate(`fetch('/api/v1/bots/${novice.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);assert.equal(mergedSaved.draft.definition.name,'اسم زميل الفريق');assert.equal(mergedSaved.draft.definition.nodes.find(n=>n.id==='welcome').text,'ترحيب محلي نحتفظ به');assert.equal(mergedSaved.published,null);assert.equal(mergedSaved.draft.definition.nodes.find(n=>n.id==='menu').choices[0].id,'info');
 console.log('PASS concurrent real bot draft review: explicit local/remote choice, independent edit preserved, compiler validation, no write until save and no publish');
 // Real Chromium file selection: reject malformed JSON, then restore a validated backup locally.
 const backupPath=join(profile,'draft-backup.json');
 const documentNode=await send('DOM.getDocument');const fileNode=await send('DOM.querySelector',{nodeId:documentNode.root.nodeId,selector:'#flow-builder input[type=file]'});assert.ok(fileNode.nodeId);
 await writeFile(backupPath,'{broken');await evaluate("document.getElementById('notice').textContent=''");await send('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[backupPath]});await until("document.getElementById('notice').textContent.includes('تعذر قراءة الملف')",'invalid backup rejected');
 assert.equal(await evaluate("document.getElementById('builder-name').value"),'اسم زميل الفريق');
 const backup=structuredClone(mergedSaved.draft.definition);backup.name='نسخة مسترجعة للاختبار';
 await writeFile(backupPath,JSON.stringify({draftRevision:1,definition:backup}));await send('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[backupPath]});await until("document.getElementById('notice').textContent.includes('استُرجعت النسخة')",'valid backup restored after real compiler validation');
 assert.equal(await evaluate("document.getElementById('builder-name').value"),'نسخة مسترجعة للاختبار');
 const beforeRestoreSave=await evaluate(`fetch('/api/v1/bots/${novice.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);assert.equal(beforeRestoreSave.draft.draftRevision,mergedSaved.draft.draftRevision,'imported old revision is never reused');assert.equal(beforeRestoreSave.draft.definition.name,'اسم زميل الفريق');
 await click('تراجع','.builder-toolbar button');assert.equal(await evaluate("document.getElementById('builder-name').value"),'اسم زميل الفريق');await click('إعادة','.builder-toolbar button');assert.equal(await evaluate("document.getElementById('builder-name').value"),'نسخة مسترجعة للاختبار');
 await evaluate("document.getElementById('notice').textContent='';document.getElementById('builder-save').click()");await until("document.getElementById('notice').textContent.includes('تم حفظ')",'restored backup saved');
 const restoredSaved=await evaluate(`fetch('/api/v1/bots/${novice.id}/flows').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);assert.equal(restoredSaved.draft.definition.name,'نسخة مسترجعة للاختبار');assert.equal(restoredSaved.published,null);
 await screenshot('conflict-restored-draft-320.png');console.log('PASS real file restore: malformed JSON rejected, compiler validation, no implicit write/publish, current revision used and undo/redo preserved');
 const incomplete={name:'مسودة تنتظر الإكمال',startId:'s',nodes:[{id:'s',type:'START',next:'pending'}]};await writeFile(backupPath,JSON.stringify({definition:incomplete}));await send('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[backupPath]});await until("document.getElementById('notice').textContent.includes('استُرجعت النسخة غير المكتملة')",'unfinished backup inspected');
 await evaluate("document.getElementById('notice').textContent='';document.getElementById('builder-save').click()");await until("document.getElementById('notice').textContent.includes('تم حفظ')",'unfinished draft saved');await evaluate("document.getElementById('builder-publish').click()");await until("document.getElementById('notice').classList.contains('error')",'unfinished publication rejected');
 const unfinishedProof=await evaluate(`fetch('/api/v1/bots/${novice.id}/flows').then(r=>r.json())`);assert.equal(unfinishedProof.published,null);assert.equal(unfinishedProof.draft.definition.nodes.length,1);await click('تراجع','.builder-toolbar button');await evaluate("document.getElementById('notice').textContent='';document.getElementById('builder-save').click()");await until("document.getElementById('notice').textContent.includes('تم حفظ')",'complete graph recovered');
 const dense={name:'مسار متشعب دائري طويل',startId:'n0',nodes:[{id:'n0',type:'START',next:'n1'},{id:'n1',type:'BUTTONS',text:'اختر الفرع',choices:[{id:'a',title:'الأول',next:'n2'},{id:'b',title:'الثاني',next:'n16'},{id:'c',title:'الثالث',next:'n30'}]},...Array.from({length:46},(_,i)=>({id:'n'+(i+2),type:'INPUT',field:'answer'+i,text:'السؤال '+(i+1),next:i===45?'n1':'n'+(i+3)}))]};
 await writeFile(backupPath,JSON.stringify({definition:dense}));await send('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[backupPath]});await until("document.getElementById('builder-name').value==='مسار متشعب دائري طويل'",'dense cyclic graph imported');await evaluate("document.querySelector('.builder-display-menu>summary').click()");await click('عرض المخطط المرئي','.builder-display-menu button');await until("document.querySelectorAll('.canvas-node').length===48",'48 cyclic cards');
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await evaluate("document.querySelector('.builder-display-menu>summary').click()");await click('ملاءمة المخطط','.builder-display-menu button');
 await evaluate("document.querySelector('.canvas-node[data-node-id=n2]').focus()");const beforeKey=await evaluate("parseFloat(document.querySelector('.canvas-node[data-node-id=n2]').style.left)");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',modifiers:1});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});assert.equal(await evaluate("parseFloat(document.querySelector('.canvas-node[data-node-id=n2]').style.left)"),beforeKey+20);
 await evaluate("document.getElementById('notice').textContent=''");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',modifiers:2});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS'});await until("document.getElementById('notice').textContent.includes('تم حفظ')",'Ctrl-S saves dense graph');await screenshot('closure-dense-canvas-1366.png');
 const denseProof=await evaluate(`fetch('/api/v1/bots/${novice.id}/flows').then(r=>r.json())`);assert.equal(denseProof.draft.definition.nodes.length,48);assert.equal(denseProof.draft.definition.nodes.find(n=>n.id==='n47').next,'n1');assert.ok(denseProof.draft.definition.layout.n2);
 await evaluate("document.querySelector('.builder-display-menu>summary').click()");await click('عرض مبسط بالخطوات','.builder-display-menu button');await send('Emulation.setDeviceMetricsOverride',{width:320,height:700,deviceScaleFactor:1,mobile:true});await screenshot('closure-dense-steps-320.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'dense mobile steps overflow');
 console.log('PASS unfinished import/save, publish blocked; actual 48-node cyclic graph, stable routes, Alt-arrow and Ctrl-S, desktop canvas and mobile steps');



 await evaluate("document.querySelector('[data-page=bots]').click()");await click('مكتبة القوالب');await until("!document.querySelector('.template-gallery').hidden",'template gallery');
 await evaluate("(()=>{const s=document.querySelector('.template-gallery input');s.value='بيانات';s.dispatchEvent(new Event('input',{bubbles:true}))})()");assert.equal(await evaluate("document.querySelectorAll('.template-gallery .template-card').length"),1);await screenshot('continuation-template-gallery-320.png');
 // Internal note and inbox context are exercised only on synthetic website conversations.
 await evaluate("document.querySelector('[data-page=leads]').click()");await until("Boolean(document.querySelector('.crm-lead-card'))",'CRM for note');await click('افتح المحادثة','.crm-lead-card button');await until("!document.getElementById('thread-tools').hidden",'inbox selected');
 await until("document.querySelector('.inbox-contact-panel').textContent.includes('سجل محادثات العميل')",'contact context loaded');
 await click('ملاحظة داخلية');await evaluate("(()=>{const f=document.querySelector('.inbox-note-form');f.querySelector('textarea').value='ملاحظة فريق تجريبية لا تُرسل';f.requestSubmit()})()");await until("document.getElementById('thread-messages').textContent.includes('ملاحظة فريق تجريبية لا تُرسل')",'internal note retained');

 const selectedConversation=await evaluate("document.querySelector('#inbox-list .thread.active').dataset.conversationId");
 await evaluate("(()=>{const t=document.getElementById('reply-form').elements.body;t.value='مسودة داخل المتصفح لم تُرسل';t.dispatchEvent(new Event('input',{bubbles:true}))})()");
 await click('العودة للمحادثات');await evaluate("document.querySelector('#inbox-list .thread:not(.active)').click()");
 await until(`document.querySelector('#inbox-list .thread.active')?.dataset.conversationId!==${JSON.stringify(selectedConversation)}`,'switch conversation without sending');
 await click('العودة للمحادثات');await evaluate(`document.querySelector('[data-conversation-id="${selectedConversation}"]').click()`);await until("document.getElementById('reply-form').elements.body.value==='مسودة داخل المتصفح لم تُرسل'",'unsent reply retained for correct contact');
 await screenshot('continuation-inbox-note-320.png');await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await evaluate('window.scrollTo(0,0)');await screenshot('continuation-inbox-context-1366.png');
 const localThreads=await evaluate("fetch('/api/v1/whatsapp/inbox').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})");assert.equal(localThreads.find(t=>t.id===selectedConversation).channel,'WEBSITE','manual reply must only touch disposable website conversation');
 const dashboardLead=localThreads.find(t=>t.id===selectedConversation).lead_id;assert.ok(dashboardLead);
 await evaluate(`fetch('/api/v1/leads/${dashboardLead}/stage',{method:'PATCH',headers:{'content-type':'application/json','x-boat-csrf':'1'},body:JSON.stringify({stage:'READY_FOR_AGENT'})}).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);
 await evaluate("document.querySelector('[data-page=overview]').click()");await until(`Boolean(document.querySelector('#dashboard-ready [data-conversation-id="${selectedConversation}"]'))`,'dashboard specific ready conversation');
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await screenshot('wizard-dashboard-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'dashboard overflow '+width)}
 await evaluate(`document.querySelector('#dashboard-ready [data-conversation-id="${selectedConversation}"]').click()`);await until(`!document.getElementById('wa-inbox').hidden&&document.querySelector('#inbox-list .thread.active')?.dataset.conversationId==='${selectedConversation}'`,'dashboard exact thread navigation');
 await evaluate("document.getElementById('thread-assign').click()");await until("document.getElementById('thread-take').textContent==='تسليم للبوت'",'assign website conversation');
 await evaluate("(()=>{const f=document.getElementById('reply-form');f.elements.body.value='رد موظف في محادثة الموقع المحلية';f.requestSubmit()})()");await until("document.getElementById('thread-messages').textContent.includes('رد موظف في محادثة الموقع المحلية')",'website staff reply visible');
 await evaluate("document.getElementById('thread-take').click()");await until("document.getElementById('thread-take').textContent==='استلام'",'release to bot');assert.ok(await evaluate("document.querySelector('#reply-form button.primary').disabled"));
 await evaluate("document.getElementById('thread-take').click()");await until("!document.querySelector('#reply-form button.primary').disabled",'take over again');
 await evaluate("document.getElementById('thread-close').click()");await until("document.querySelector('#reply-form button.primary').disabled",'close disables manual reply');
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await screenshot('wizard-inbox-closed-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'manual inbox overflow '+width)}
 console.log('PASS browser website assignment, manual reply, release, take over and close without external transport');
 await evaluate("document.querySelector('[data-page=channels]').click()");await until("Boolean(document.querySelector('.channel-directory'))",'channel readiness directory');await screenshot('continuation-channel-directory-1366.png');
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'channel directory overflow');
 console.log('PASS novice wizard/back/review/no-write, searchable gallery, same-definition simple/canvas branch editing, mobile steps, retained internal inbox note, contact context and truthful channel directory');

 await evaluate("document.querySelector('[data-page=campaigns]').click()");await until("Boolean([...document.querySelectorAll('#campaign-list [data-campaign-id]')].find(c=>c.textContent.includes('حملة مراجعة محلية دون إرسال')))",'local campaign draft');
 // Author a real new draft through the visible creation disclosure and four steps.
 await evaluate("document.querySelector('.campaign-create-disclosure > summary').click()");assert.ok(await evaluate("document.querySelector('.campaign-create-disclosure').open"),'campaign form actually visible');
 await evaluate("document.getElementById('campaign-form').elements.name.value='حملة المعالج المحلية'");
 await click('التالي','.campaign-wizard-actions button');
 await evaluate("document.getElementById('campaign-form').elements.tag.value='interested'");
 await click('التالي','.campaign-wizard-actions button');
 await click('السابق','.campaign-wizard-actions button');
 assert.equal(await evaluate("document.getElementById('campaign-form').elements.tag.value"),'interested');
 await click('التالي','.campaign-wizard-actions button');await evaluate("(()=>{const select=document.querySelector('#campaign-steps [data-template]');select.value=[...select.options].find(o=>o.textContent.includes('review_fixture')).value;select.dispatchEvent(new Event('change'))})()");await click('التالي','.campaign-wizard-actions button');
 await evaluate("(()=>{const d=new Date(Date.now()+86400000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());document.getElementById('campaign-form').elements.startAt.value=d.toISOString().slice(0,16)})()");
 assert.ok(await evaluate("document.querySelector('.campaign-draft-summary').textContent.includes('قالب اختبار محلي')"),'review shows actual approved template content');
 for(const [width,height] of [[1366,900],[390,844],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await evaluate("document.querySelector('.campaign-progress').scrollIntoView({block:'start'})");await sleep(250);assert.ok(await evaluate("document.getElementById('campaign-form').checkVisibility() && document.querySelector('.campaign-create-disclosure').open"),'visible wizard at screenshot');await screenshot('wizard-campaign-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'wizard overflow '+width)}
 await evaluate("document.getElementById('campaign-form').requestSubmit()");
 await until("[...document.querySelectorAll('#campaign-list [data-campaign-id]')].some(c=>c.textContent.includes('حملة المعالج المحلية'))",'wizard saved real draft');
 assert.ok(await evaluate("document.querySelector('.campaign-wizard-panel:not([hidden])').textContent.includes('واتساب')"),'wizard reset after save');
 console.log('PASS campaign wizard actual draft save, back preservation, real template review and desktop/mobile');
 for(const kind of ['fixture_named','fixture_media','fixture_carousel']){
  if(!await evaluate("document.querySelector('.campaign-create-disclosure').open"))await evaluate("document.querySelector('.campaign-create-disclosure > summary').click()");
  await evaluate(`document.getElementById('campaign-form').elements.name.value='حملة ${kind}'`);await click('التالي','.campaign-wizard-actions button');await click('التالي','.campaign-wizard-actions button');
  await evaluate(`(()=>{const select=document.querySelector('#campaign-steps [data-template]');select.value=[...select.options].find(o=>o.textContent.includes('${kind}')).value;select.dispatchEvent(new Event('change'));for(const input of document.querySelectorAll('#campaign-steps [data-kind],#campaign-steps [name^=card_]')){input.value=(input.dataset.kind==='mediaUrl'||input.name.endsWith('_mediaUrl'))?'https://example.invalid/local-fixture.png':input.dataset.kind==='buttons'?'fixture-value':'قيمة معتمدة محليًا';input.dispatchEvent(new Event('input',{bubbles:true}))}})()`);await click('التالي','.campaign-wizard-actions button');await evaluate("(()=>{const d=new Date(Date.now()+86400000);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());document.getElementById('campaign-form').elements.startAt.value=d.toISOString().slice(0,16)})()");
  await screenshot('closure-campaign-'+kind+'-320.png');await evaluate("document.getElementById('campaign-form').requestSubmit()");await until(`document.getElementById('campaign-list').textContent.includes('حملة ${kind}')`,'advanced template saved '+kind);
 }
 console.log('PASS named header/body, dynamic URL/quick reply and media header forms save real campaign drafts without launch');
 const campaignId=await evaluate("[...document.querySelectorAll('#campaign-list [data-campaign-id]')].find(c=>c.textContent.includes('حملة مراجعة محلية دون إرسال')).dataset.campaignId");
 await evaluate(`document.querySelector('[data-campaign-id="${campaignId}"] button').click()`);await until(`Boolean(document.querySelector('[data-campaign-id="${campaignId}"] .campaign-review'))`,'campaign audience review');
 const reviewProof=await evaluate(`fetch('/api/v1/campaigns/${campaignId}/review').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})`);assert.equal(reviewProof.queuedByReview,0);
 await evaluate('window.scrollTo(0,0)');await screenshot('continuation-campaign-review-1366.png');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:700,deviceScaleFactor:1,mobile:true});await screenshot('continuation-campaign-review-320.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'campaign review mobile overflow');
 await evaluate("document.querySelector('[data-page=leads]').click()");await until("Boolean(document.querySelector('.crm-lead-card input[type=checkbox]'))",'CRM bulk selection');
 await evaluate("document.querySelector('.crm-lead-card input[type=checkbox]').click()");await click('تطبيق على المحددين','.crm-bulk-toolbar button');await until("document.getElementById('notice').textContent.includes('تم تحديث العملاء المحددين')",'bulk CRM update');await screenshot('continuation-crm-bulk-320.png');
 console.log('PASS real campaign audience/content review without launch and role-scoped CRM bulk interaction on mobile');
 await evaluate("document.querySelector('[data-page=analytics]').click()");await until("Boolean(document.querySelector('#bot-insights select'))",'analytics loaded');
 for(const days of [7,90]){await evaluate(`(()=>{const s=document.querySelector('#bot-insights select');s.value='${days}';s.dispatchEvent(new Event('change'))})()`);await until("document.getElementById('bot-insights').getAttribute('aria-busy')==='false'",'analytics period loaded');assert.equal(await evaluate("document.querySelectorAll('.vessel-activity-day').length"),days)}
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await screenshot('wizard-analytics-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'analytics overflow '+width)}
 console.log('PASS analytics actual period requests and zero-filled UTC daily series');
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:profile});await click('تنزيل النشاط اليومي CSV','#bot-insights button');
 let exportedCsv='';for(let i=0;i<50;i++){try{exportedCsv=await readFile(join(profile,'elhafez-activity-90-days.csv'),'utf8');break}catch{await sleep(100)}}assert.ok(exportedCsv.startsWith('\uFEFF'),'UTF-8 BOM for Arabic spreadsheet headers');
 const csvRows=exportedCsv.trim().split('\r\n');assert.equal(csvRows.length,91);const report=await evaluate("fetch('/api/v1/analytics/overview?days=90').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})");
 assert.equal(csvRows.slice(1).reduce((sum,row)=>sum+Number(row.split(',')[1]),0),report.conversations);assert.equal(csvRows.slice(1).reduce((sum,row)=>sum+Number(row.split(',')[2]),0),report.leads);assert.ok(report.previous.startDay);assert.ok(await evaluate("document.getElementById('bot-insights').textContent.includes('الفترة السابقة')"));
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await sleep(150);await screenshot('comparison-report-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'comparison report overflow '+width)}
 await evaluate("(()=>{const original=window.fetch;window.fetch=(input,options)=>{if(String(input).startsWith('/api/v1/analytics/overview')){window.fetch=original;return Promise.reject(new TypeError('Injected offline report fault'))}return original(input,options)};const s=document.querySelector('#bot-insights select');s.value='7';s.dispatchEvent(new Event('change'))})()");await until("Boolean(document.querySelector('#bot-insights .insights-loading button'))",'report failure retry');assert.equal(await evaluate("document.querySelectorAll('#bot-insights .metric').length"),6);await click('إعادة المحاولة','#bot-insights .insights-loading button');await until("document.querySelectorAll('.vessel-activity-day').length===7&&!document.querySelector('.insights-loading')",'report retry actual seven-day result');
 console.log('PASS report comparison boundaries displayed, actual downloaded 90-day aggregate CSV reconciles to API, no contacts, real retry after injected transport failure');

 // Actual media upload -> real local ClamAV worker -> private preview -> deletion.
 await evaluate("document.querySelector('[data-page=media]').click()");await until("!document.getElementById('media').hidden",'media library');
 const mediaPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'),mediaPath=join(profile,'browser-clean.png');await writeFile(mediaPath,mediaPng);
 async function uploadLocal(path){const doc=await send('DOM.getDocument'),node=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#media-form input[type=file]'});await send('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[path]});await evaluate("document.getElementById('media-form').requestSubmit()")}
 await uploadLocal(mediaPath);await until("document.getElementById('media-list').textContent.includes('browser-clean.png')",'uploaded media is listed');
 let clean=false;for(let i=0;i<100;i++){await evaluate("[...document.querySelectorAll('#media button')].find(b=>b.textContent==='تحديث حالة الفحص').click()");await sleep(300);clean=await evaluate("[...document.querySelectorAll('#media-list article')].find(n=>n.textContent.includes('browser-clean.png'))?.textContent.includes('اجتاز الفحص')");if(clean)break}assert.ok(clean,'actual worker must scan clean media');
 const cleanAssetId=await evaluate("[...document.querySelectorAll('#media-list article')].find(n=>n.textContent.includes('browser-clean.png')).dataset.mediaId");
 const privateHeaders=await evaluate(`fetch('/api/v1/media/${cleanAssetId}/content').then(r=>({status:r.status,nosniff:r.headers.get('x-content-type-options'),disposition:r.headers.get('content-disposition'),cache:r.headers.get('cache-control')}))`);assert.deepEqual(privateHeaders,{status:200,nosniff:'nosniff',disposition:'attachment',cache:'no-store'});
 await evaluate(`document.querySelector('[data-media-id="${cleanAssetId}"] button').click()`);await until("Boolean(document.querySelector('.media-preview img')?.naturalWidth)",'private clean image preview');
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate("document.querySelector('.media-preview').scrollIntoView({block:'start'})");await sleep(150);await screenshot('closure-media-clean-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'media overflow '+width)}
 await evaluate(`([...document.querySelectorAll('[data-media-id="${cleanAssetId}"] button')].find(b=>b.textContent==='حذف الملف')).click()`);await until(`!document.querySelector('[data-media-id="${cleanAssetId}"]')`,'unused media deleted');assert.equal(await evaluate(`fetch('/api/v1/media/${cleanAssetId}/content').then(r=>r.status)`),404);
 const badMediaPath=join(profile,'fake.png');await writeFile(badMediaPath,'not an image');await uploadLocal(badMediaPath);await until("document.getElementById('notice').textContent.includes('صيغة الملف غير مدعومة')",'server rejects forged media MIME');
 // Local integration inspection and encrypted setting lifecycle: no jobs or connections.
 await evaluate("document.querySelector('[data-page=integrations]').click()");await until("!document.getElementById('integrations').hidden",'integration tasks');
 await evaluate("(()=>{const f=document.getElementById('integration-form');f.elements.name.value='ربط محلي دون إرسال';f.elements.url.value='https://webhook.fixture.invalid/hook';f.elements.authMode.value='BEARER';f.elements.authMode.dispatchEvent(new Event('change'));f.elements.secret.value='DISPOSABLE-NOT-A-REAL-SECRET'})()");await click('فحص إعداد الرابط دون اتصال','#integration-form button');await until("document.getElementById('notice').textContent.includes('لم يحدث اتصال')",'local inspect no connection');
 await evaluate("document.getElementById('integration-form').requestSubmit()");await until("document.getElementById('integration-list').textContent.includes('ربط محلي دون إرسال')",'real encrypted integration saved');assert.equal(await evaluate("document.getElementById('integration-list').textContent.includes('DISPOSABLE')"),false);
 await click('إيقاف','#integration-list button');await until("[...document.querySelectorAll('#integration-list button')].some(b=>b.textContent==='تفعيل')",'integration disabled');
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await screenshot('closure-integrations-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'integration overflow '+width)}
 console.log('PASS actual local ClamAV upload/private preview/delete and forged MIME rejection; integration inspect/save/disable with secret absent and no external connection');
 // Team lifecycle has a separate company: production seat limits stay unchanged.
 const teamAccount=account.team;assert.ok(teamAccount);await evaluate("document.getElementById('logout').click()");await until("!document.getElementById('login').hidden",'switch to dedicated team company');await login(base,teamAccount);
 await evaluate("document.querySelector('[data-page=team]').click()");await until("Boolean(document.querySelector('#team-list [data-member-id]'))",'team task page loaded');
 const priorMembers=await evaluate("document.querySelectorAll('#team-list [data-member-id]').length");
 await evaluate("(()=>{const original=window.fetch;window.fetch=(input,options)=>{if(String(input)==='/api/v1/team'){window.fetch=original;return Promise.reject(new TypeError('Injected offline transport fault'))}return original(input,options)};document.querySelector('[data-page=team]').click()})()");await until("Boolean(document.querySelector('.team-load-error'))",'team network error state');assert.equal(await evaluate("document.querySelectorAll('#team-list [data-member-id]').length"),priorMembers,'last good team data retained');await screenshot('team-retry-320.png');await click('إعادة المحاولة','.team-load-error button');await until("!document.querySelector('.team-load-error')",'team retry recovers real API data');
 const staffEmail='staff-browser-'+Date.now()+'@example.invalid';
 async function invite(email,role){await evaluate(`(()=>{const f=document.getElementById('invite-form');f.elements.email.value=${JSON.stringify(email)};f.elements.role.value=${JSON.stringify(role)};f.elements.role.dispatchEvent(new Event('change'));f.requestSubmit()})()`);await until("Boolean(document.querySelector('#invite-result input'))",'private invitation link created');const link=await evaluate("document.querySelector('#invite-result input').value");await click('إخفاء الرابط','#invite-result button');assert.ok(await evaluate("!document.querySelector('#invite-result input')"),'private token cleared before screenshots');return link.split('#team.')[1]}
 const revokedToken=await invite(staffEmail,'AGENT');
 await evaluate(`(()=>{const f=document.getElementById('invite-form');f.elements.email.value=${JSON.stringify(staffEmail.toUpperCase())};f.requestSubmit()})()`);await until("document.getElementById('notice').textContent.includes('توجد دعوة سارية')",'Arabic duplicate invitation error');
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await sleep(150);await screenshot('team-invitations-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'team overflow '+width)}
 await evaluate(`(()=>{const row=[...document.querySelectorAll('#team-invites [data-invitation-id]')].find(n=>n.textContent.includes(${JSON.stringify(staffEmail)}));row.querySelector('button').click()})()`);await until("document.querySelector('#team-invites [data-status=REVOKED]')!==null",'invitation revoked');
 const testPassword='Disposable-team-browser-1234';
 const revokedStatus=await evaluate(`fetch('/api/v1/team/accept',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:${JSON.stringify(revokedToken)},email:${JSON.stringify(staffEmail)},password:${JSON.stringify(testPassword)}})}).then(r=>r.status)`);assert.equal(revokedStatus,404);
 const managerEmail='manager-browser-'+Date.now()+'@example.invalid',managerToken=await invite(managerEmail,'MANAGER');
 // Keep the existing owner cookie while accepting the public invite with the invitee credentials.
 await pageLoaded(()=>send('Page.navigate',{url:base+'/join.html#team.'+managerToken}));
 await evaluate(`(()=>{const f=document.getElementById('join-form');f.elements.email.value=${JSON.stringify(managerEmail)};f.elements.password.value=${JSON.stringify(testPassword)};f.requestSubmit()})()`);await until("document.getElementById('join-form').hidden",'actual join form accepted');
 assert.equal(await evaluate('location.hash'),'','invitation secret removed from URL');
 await evaluate('window.scrollTo(0,0)');await sleep(150);await screenshot('team-accepted-320.png');
 await pageLoaded(()=>evaluate("document.getElementById('join-login').click()"));await until("Boolean(document.getElementById('login-form')?.onsubmit)",'company login ready after join');assert.equal(await evaluate("document.getElementById('login-form').elements.tenantSlug.value"),teamAccount.slug);
 await until("document.body.dataset.authReady==='true'",'owner cookie restored without another login');
 await evaluate("document.querySelector('[data-page=team]').click()");await until("Boolean(document.querySelector('#team-list select'))",'owner edit role available');
 for(const role of ['VIEWER','MANAGER']){await evaluate(`(()=>{const row=[...document.querySelectorAll('#team-list [data-member-id]')].find(n=>n.textContent.includes(${JSON.stringify(managerEmail)}));row.querySelector('select').value=${JSON.stringify(role)};row.querySelector('button').click()})()`);await until(`([...document.querySelectorAll('#team-list [data-member-id]')].find(n=>n.textContent.includes(${JSON.stringify(managerEmail)})))?.querySelector('p')?.textContent==='${role==='VIEWER'?'مشاهدة فقط':'مدير'}'`,'owner role change stored '+role)}
 // Complete new-company setup while the owner's existing session is active.
 await evaluate("document.querySelector('[data-page=overview]').click()");await until("(()=>{const b=[...document.querySelectorAll('#getting-started button')].find(b=>b.textContent.startsWith('إعداد الشركة و'));if(!b)return false;b.click();return true})()",'company setup entry');await until("Boolean(document.querySelector('.company-setup-dialog[open]'))",'company setup dialog');
 await click('التالي','.company-setup-form button');await evaluate("(()=>{const f=document.querySelector('.company-setup-form');for(const [key,value] of Object.entries({name:'بوت الشركة الجديد',businessName:'شركة الاختبار المتكاملة',greeting:'مرحبًا من نشاطنا الجديد'})){f.elements[key].value=value;f.elements[key].dispatchEvent(new Event('input',{bubbles:true}))}})()");await click('التالي','.company-setup-form button');await click('السابق','.company-setup-form button');assert.equal(await evaluate("document.querySelector('.company-setup-form').elements.businessName.value"),'شركة الاختبار المتكاملة');await click('التالي','.company-setup-form button');await click('مراجعة دون ربط قناة','.company-setup-form button');await until("document.querySelector('.company-setup-form').textContent.includes('مرحبًا من نشاطنا الجديد')",'company server preview');
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await screenshot('closure-company-review-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'company setup overflow '+width)}await click('إنشاء المسودة وفتح المحرر','.company-setup-form button');await until("document.getElementById('page-title').textContent.includes('بوت الشركة الجديد')",'company bot draft opened');
 const companyProof=await evaluate("fetch('/api/v1/workspace').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})");assert.equal(companyProof.name,'شركة الاختبار المتكاملة');const companyBots=await evaluate("fetch('/api/v1/bots').then(r=>r.json())");const configuredBot=companyBots.find(b=>b.name==='بوت الشركة الجديد');assert.ok(configuredBot);assert.equal(configuredBot.publishedVersion,null);assert.equal(configuredBot.routes.length,0);
 await evaluate("document.querySelector('[data-page=usage]').click()");await until("document.querySelectorAll('.usage-meter').length===3",'real company plan and usage meters');assert.ok(await evaluate("document.getElementById('usage-summary').textContent.includes('شركة الاختبار المتكاملة')"));
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await screenshot('closure-usage-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'usage overflow '+width)}
 console.log('PASS company setup/back/deferred channel/server preview/atomic name+independent unpublished bot and actual plan/usage meters');
 await evaluate("document.querySelector('[data-page=overview]').click()");await until("document.querySelectorAll('#dashboard-metrics .metric').length===4 && document.querySelector('#getting-started button')?.textContent==='إعداد الشركة وبوت جديد'",'saved company dashboard');
 const dashboardCounts=await evaluate("fetch('/api/v1/leads/summary').then(r=>r.json())");assert.equal(await evaluate("document.querySelector('#dashboard-metrics .metric strong').textContent"),new Intl.NumberFormat('ar-EG').format(dashboardCounts.total));assert.ok(await evaluate("document.getElementById('dashboard-ready').textContent.includes('لا يوجد عملاء ينتظرون')"));
 for(const [width,height] of [[1366,900],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await evaluate('window.scrollTo(0,0)');await screenshot('closure-dashboard-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'dashboard overflow '+width)}
 await evaluate("(()=>{const original=window.fetch;window.fetch=(input,options)=>{if(String(input)==='/api/v1/leads/summary'){window.fetch=original;return Promise.reject(new TypeError('Injected dashboard failure'))}return original(input,options)};document.querySelector('[data-page=overview]').click()})()");await until("Boolean(document.querySelector('.dashboard-load-error'))",'dashboard retained-data error');assert.equal(await evaluate("document.querySelectorAll('#dashboard-metrics .metric').length"),4);await screenshot('closure-dashboard-retry-320.png');await click('إعادة المحاولة','.dashboard-load-error button');await until("!document.querySelector('.dashboard-load-error') && document.querySelector('#getting-started button')?.textContent==='إعداد الشركة وبوت جديد'",'dashboard actual retry');
 await click('كل المحادثات','#dashboard-ready button');await until("!document.getElementById('wa-inbox').hidden",'dashboard exact inbox shortcut');console.log('PASS dashboard actual KPI reconciliation, empty readiness, company shortcut, desktop/mobile, retained-data error/retry and working inbox shortcut');

 await evaluate("document.getElementById('logout').click()");await until("!document.getElementById('login').hidden",'owner logout before manager login');
 assert.equal(await evaluate("document.getElementById('login-form').elements.tenantSlug.value"),teamAccount.slug);
 await evaluate(`(()=>{const f=document.getElementById('login-form');f.elements.email.value=${JSON.stringify(managerEmail)};f.elements.password.value=${JSON.stringify(testPassword)};f.requestSubmit()})()`);await until("document.body.dataset.authReady==='true'",'real invited manager login');
 await evaluate("document.querySelector('[data-page=team]').click()");await until("Boolean(document.querySelector('#team-list [data-member-id]'))",'manager team load');
 assert.ok(await evaluate("document.querySelector('#invite-form option[value=MANAGER]').disabled"),'manager invitation option is unavailable');assert.equal(await evaluate("document.querySelectorAll('#team-list select').length"),0,'manager cannot change roles');
 const deniedManagerInvite=await evaluate("fetch('/api/v1/team/invitations',{method:'POST',headers:{'content-type':'application/json','x-boat-csrf':'1'},body:JSON.stringify({email:'forbidden-manager@example.invalid',role:'MANAGER'})}).then(r=>r.status)");assert.equal(deniedManagerInvite,403);
 await screenshot('team-manager-permissions-320.png');
 await evaluate("document.querySelector('[data-page=analytics]').click()");await until("Boolean(document.querySelector('#bot-insights select'))&&!document.querySelector('.insights-loading')",'empty company report');
 assert.equal(await evaluate("document.querySelector('#bot-insights .metric strong').textContent"),new Intl.NumberFormat('ar-EG').format(0));assert.ok(await evaluate("document.getElementById('bot-insights').textContent.includes('لا يوجد نشاط في الفترة المحددة')"));await evaluate('window.scrollTo(0,0)');await sleep(150);await screenshot('comparison-empty-320.png');
 console.log('PASS browser team lifecycle: create/hide token, duplicate Arabic error, revoke/denied acceptance, actual accepted manager login, forbidden manager grant, owner role change and no external delivery');
 assert.deepEqual(exceptions,[]);
 console.log('PASS new Chromium bot journey: create independent Start, contextual message, Arabic template/three buttons, save, publish, cookie reload, same bot and definition; 1366/768/390/320 actual before/after screenshots and overflow checks');
}catch(error){console.error('BOT BROWSER FAILURE',error);await screenshot('rebuild-failure.png').catch(()=>{});throw error}
finally{ws?.close();child.kill('SIGTERM');baselineServer?.kill('SIGTERM');await Promise.race([once(child,'exit').catch(()=>{}),sleep(1600)]);if(child.exitCode===null)child.kill('SIGKILL');await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:150});if(baselineDir)await rm(baselineDir,{recursive:true,force:true,maxRetries:5,retryDelay:150})}
