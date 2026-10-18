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
let ws;let commandId=0;const pending=new Map(),exceptions=[];
async function waitForPort(){for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error('Chrome exited before launching');try{
 const info=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n');return Number(info[0]);
 }catch{}await sleep(150)}throw new Error('Chrome DevTools port unavailable')}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value}
function send(method,params={}){const id=++commandId;return new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('Chrome CDP timeout: '+method))},12000);
 pending.set(id,{resolve:result=>{clearTimeout(timeout);resolve(result)},reject:error=>{clearTimeout(timeout);reject(error)}});
 ws.send(JSON.stringify({id,method,params}));
 })}
async function until(predicate,name){for(let i=0;i<70;i++){if(await evaluate(predicate))return;await sleep(160)}throw new Error('Browser UI timed out waiting for '+name)}
async function screenshot(filename){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile('acceptance-evidence/'+filename,Buffer.from(r.data,'base64'))}
try{
 const port=await waitForPort();
 let target;for(let i=0;i<30;i++){try{const pages=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=pages.find(p=>p.type==='page'&&p.webSocketDebuggerUrl);if(target)break}catch{}await sleep(120)}
 assert.ok(target?.webSocketDebuggerUrl,'No debuggable Chrome page');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',event=>{const value=JSON.parse(String(event.data));if(value.id){const entry=pending.get(value.id);if(entry){pending.delete(value.id);value.error?entry.reject(new Error(JSON.stringify(value.error))):entry.resolve(value.result)}}else if(value.method==='Runtime.exceptionThrown')exceptions.push(value.params.exceptionDetails?.text||'JavaScript exception')});
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.navigate',{url:base+'/'});
 await until("Boolean(document.querySelector('#login-form input[name=tenantSlug]'))",'login form');
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
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await sleep(300);await screenshot('flow-builder-mobile.png');
 const bodyWidth=await evaluate('document.documentElement.scrollWidth');
 assert.ok(Number.isFinite(bodyWidth)&&bodyWidth<3000,'Mobile flow canvas overflows document excessively');
 await evaluate("document.getElementById('logout').click()");
 await until("Boolean(document.getElementById('login')&&!document.getElementById('login').hidden)",'logout/login screen');
 assert.equal(await evaluate("document.getElementById('app').hidden"),true);
 assert.deepEqual(exceptions,[],`Browser JavaScript exceptions: ${exceptions.join(', ')}`);
 console.log('PASS headless Chrome: RTL company login, real dashboard, flow canvas, mobile viewport, logout');
 console.log('PASS screenshots saved: dashboard-desktop.png, flow-builder-desktop.png, flow-builder-mobile.png');
}catch(error){console.error('BROWSER ACCEPTANCE FAILURE:',error);process.exitCode=1}
finally{
 if(ws){ws.close();await sleep(100)}
 if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit').catch(()=>{}),sleep(1600)]);if(child.exitCode===null)child.kill('SIGKILL')}
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
}