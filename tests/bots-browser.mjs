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
let baselineServer,baselineDir;
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
 await screenshot('rebuild-failure.png');
 const details=await evaluate("JSON.stringify({title:document.getElementById('page-title')?.textContent,botsHidden:document.getElementById('bots')?.hidden,bots:document.getElementById('bots')?.textContent,nav:[...document.querySelectorAll('[data-page=bots]')].map(b=>({text:b.textContent,html:b.outerHTML}))})");
 throw new Error(details+' Browser UI timed out waiting for '+name+'; state='+state+'; exceptions='+JSON.stringify(exceptions.slice(-8))+'; network='+JSON.stringify(network.slice(-15))+'; console='+JSON.stringify(consoleErrors.slice(-8)));
}
async function screenshot(filename){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('acceptance-evidence/'+filename,Buffer.from(r.data,'base64'))}

try{
 const port=await waitForPort();const target=(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(p=>p.type==='page');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',event=>{const v=JSON.parse(String(event.data));if(v.id){const p=pending.get(v.id);pending.delete(v.id);if(p)v.error?p.reject(Error(v.error.message)):p.resolve(v.result)}else if(v.method==='Page.javascriptDialogOpening')void send('Page.handleJavaScriptDialog',{accept:true});else if(v.method==='Runtime.exceptionThrown')exceptions.push(v.params.exceptionDetails.text)});
 await send('Page.enable');await send('Runtime.enable');await mkdir('acceptance-evidence',{recursive:true});
 async function login(origin){
  await send('Page.navigate',{url:origin+'/'});await until("Boolean(document.getElementById('login-form')?.onsubmit)",'login ready');
  const restored=await evaluate("fetch('/api/v1/auth/me').then(r=>r.ok)");
  if(!restored)await evaluate(`(()=>{const p=${JSON.stringify(account)},f=document.getElementById('login-form');f.elements.tenantSlug.value=p.slug;f.elements.email.value=p.email;f.elements.password.value=p.password;f.requestSubmit()})()`);
  await until("!document.getElementById('app').hidden",'logged in');
  if(origin===base)await until("document.body.dataset.authReady==='true'",'session initialization complete');
  else await sleep(500);
 }
 async function click(text,selector='button'){await evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing button '+${JSON.stringify(text)});b.click()})()`)}
 // Reconstruct actual original assets, never a mocked before image or a Git worktree.
 baselineDir=await mkdtemp(join(tmpdir(),'boat-original-'));
 execFileSync('tar',['-x','-C',baselineDir],{input:execFileSync('git',['archive','b02a3132751ed0b6acbbc5f1a928b83b04dcb572','apps/web'])});
 baselineServer=spawn(process.execPath,[join(baselineDir,'apps/web/server.mjs')],{env:{...process.env,WEB_PORT:'3001',API_INTERNAL_ORIGIN:'http://127.0.0.1:4000'},stdio:'ignore'});
 for(let i=0;i<40;i++){try{if((await fetch('http://127.0.0.1:3001/')).ok)break}catch{}await sleep(100)}
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});
 await login('http://127.0.0.1:3001');await evaluate("document.querySelector('[data-page=flow-builder]').click()");await until("document.querySelectorAll('.canvas-node').length>1",'baseline canvas');
 for(const [width,height] of [[1366,900],[390,844],[320,700]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await sleep(200);await screenshot('rebuild-before-builder-'+width+'.png')}
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:900,deviceScaleFactor:1,mobile:false});await login(base);
 await evaluate("document.querySelector('[data-page=bots]').click()");await until("!document.getElementById('bots').hidden && !document.getElementById('bots').textContent.includes('جارٍ تحميل')",'bot manager');
 const botName='مساعد المتصفح '+Date.now();
 await evaluate(`(()=>{const f=document.querySelector('.bot-create-form');f.elements.name.value=${JSON.stringify(botName)};f.requestSubmit()})()`);
 await until("document.getElementById('page-title').textContent.includes('مساعد المتصفح') && document.querySelectorAll('.canvas-node').length===1",'new independent Start');
 await evaluate("document.querySelector('.canvas-node[data-node-id=start] .canvas-add').click()");
 await until("Boolean(document.querySelector('.builder-component-dialog[open]'))",'Start output picker');
 await click('رسالة نصية','.builder-picker-item');await until("document.querySelectorAll('.canvas-node').length===2",'first message inserted');
 await evaluate("(()=>{const t=document.querySelector('.builder-inspector textarea');t.value='أهلًا بك في تجربة البوت المستقل';t.dispatchEvent(new Event('input',{bubbles:true}))})()");
 await screenshot('rebuild-after-contextual-message-1366.png');
 // Exercise the real Arabic template and three stable button branches through existing controls.
 await evaluate("document.getElementById('builder-load-preset').click()");
 await until("Boolean(document.querySelector('.canvas-node[data-node-id=menu]'))",'three button template');
 await evaluate("document.getElementById('builder-save').click()");await until("document.getElementById('notice').textContent.includes('تم حفظ')",'draft saved');
 const bots=await evaluate("fetch('/api/v1/bots').then(r=>r.json())");const bot=bots.find(b=>b.name===botName);assert.ok(bot);
 const cfg=await evaluate(`fetch('/api/v1/bots/${bot.id}/flows').then(r=>r.json())`);assert.equal(cfg.draft.definition.nodes.find(n=>n.type==='BUTTONS').choices.length,3);
 await evaluate("document.getElementById('builder-publish').click()");await until("document.getElementById('notice').textContent.includes('تم نشر')",'bot publish');
 await send('Page.reload');await until("!document.getElementById('app').hidden",'session restored');await evaluate("document.querySelector('[data-page=bots]').click()");await until(`Boolean(document.querySelector('[data-bot-id="${bot.id}"]'))`,'saved bot card');
 await evaluate(`document.querySelector('[data-bot-id="${bot.id}"] button').click()`);await until("document.getElementById('page-title').textContent.includes('مساعد المتصفح') && document.querySelectorAll('.canvas-node').length>=6",'bot definition reloaded');
 const again=await evaluate(`fetch('/api/v1/bots/${bot.id}/flows').then(r=>r.json())`);assert.deepEqual(again.draft.definition,cfg.draft.definition);assert.equal(again.published.version,1);
 for(const [width,height] of [[1366,900],[768,1024],[390,844],[320,700]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await sleep(200);await screenshot('rebuild-after-builder-'+width+'.png');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'builder horizontal overflow at '+width);
  await evaluate("document.querySelector('[data-page=bots]').click()");await until("!document.getElementById('bots').hidden",'manager viewport');await screenshot('rebuild-after-manager-'+width+'.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'manager overflow at '+width);
  await evaluate(`document.querySelector('[data-bot-id="${bot.id}"] button').click()`);await until("!document.getElementById('flow-builder').hidden",'builder viewport');
 }
 assert.deepEqual(exceptions,[]);
 console.log('PASS new Chromium bot journey: create independent Start, contextual message, Arabic template/three buttons, save, publish, cookie reload, same bot and definition; 1366/768/390/320 actual before/after screenshots and overflow checks');
}finally{ws?.close();child.kill('SIGTERM');baselineServer?.kill('SIGTERM');await rm(profile,{recursive:true,force:true});if(baselineDir)await rm(baselineDir,{recursive:true,force:true})}
