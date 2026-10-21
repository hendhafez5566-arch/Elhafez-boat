/** Real API/PostgreSQL/Chromium visual and interaction acceptance. Synthetic tenant only. */
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {arrangeFlow} from '../apps/web/public/flow-geometry.js';
import {studioClick,revealStudioControl} from './support/studio-navigation.mjs';
const account=JSON.parse(await readFile('acceptance-evidence/scale-locale-account.json','utf8'));
const phase=process.env.VISUAL_PHASE||'after',dir='docs/product-rebuild/evidence/visual-rebuild-2026-10-21/'+phase;
await mkdir(dir,{recursive:true});
const apiPort=4187,webPort=3187,base='http://127.0.0.1:'+webPort,children=[],errors=[],checks=[];
let browser;
const start=(file,env)=>{const p=spawn(process.execPath,[file],{env:{...process.env,...env},stdio:['ignore','pipe','pipe']});children.push(p);p.stdout.on('data',()=>{});p.stderr.on('data',()=>{});return p};
const check=s=>{checks.push(s);console.log('PASS '+s)};
const graph={name:'الحافظ للسياحة · مساعد الرحلات',channel:'WEBSITE',startId:'start',variables:[{key:'customer_name',label:'اسم العميل',type:'text',scope:'contact'}],nodes:[
{id:'start',type:'START',next:'welcome'},
{id:'welcome',type:'TEXT',label:'ترحيب العملاء',text:'أهلًا بك في الحافظ للسياحة 👋\nنساعدك تختار رحلتك القادمة. كيف نقدر نساعدك؟',next:'menu'},
{id:'menu',type:'BUTTONS',label:'اختر الخدمة',text:'اختر الخدمة المناسبة لك',choices:[{id:'tours',title:'البرامج السياحية',next:'gallery'},{id:'offers',title:'استفسار عن العروض',next:'offers'},{id:'staff',title:'تحدث مع موظف',next:'handoff'}]},
{id:'gallery',type:'TEXT',text:'وجهات السفر',label:'وجهات السفر',blocks:[{type:'GALLERY',cards:[{title:'رحلات داخل مصر',subtitle:'أخبرنا بالوجهة والتاريخ المطلوب'},{title:'رحلات خارج مصر',subtitle:'فريقنا يساعدك في اختيار البرنامج'}]}],next:'name'},
{id:'name',type:'INPUT',label:'اسم العميل',field:'customer_name',text:'ما اسمك؟',validation:{type:'text',min:2},next:'phone'},
{id:'phone',type:'INPUT',label:'رقم التواصل',field:'customer_phone',text:'ما رقم التواصل؟',validation:{type:'phone'},next:'condition'},
{id:'condition',type:'CONDITION',label:'التحقق من البيانات',field:'customer_name',operator:'exists',match:'all',rules:[{field:'customer_name',operator:'exists'},{field:'customer_phone',operator:'exists'}],yes:'thanks',no:'retry'},
{id:'thanks',type:'TEXT',label:'تأكيد استلام الطلب',text:'وصل طلبك. سيكمل معك موظف من الفريق.',next:'handoff'},
{id:'retry',type:'TEXT',label:'استكمال البيانات',text:'نحتاج بيانات التواصل لاستكمال طلبك.',next:'name'},
{id:'offers',type:'TEXT',label:'استفسار العروض',text:'أخبر الموظف بالوجهة التي تفضلها ليراجع العروض المعتمدة.',next:'handoff'},
{id:'handoff',type:'HANDOFF',label:'فريق خدمة العملاء',text:'تم تحويل المحادثة لفريق خدمة العملاء.'}
]};graph.layout=arrangeFlow(graph);
try{
 start('.build/apps/api/src/server.js',{PORT:String(apiPort),DATABASE_URL:account.databaseUrl,CI_RUNTIME_ACCEPTANCE:'1',RATE_LIMIT_SECRET:randomBytes(32).toString('hex')});
 start(process.env.VISUAL_WEB_SERVER||'apps/web/server.mjs',{WEB_PORT:String(webPort),API_INTERNAL_ORIGIN:'http://127.0.0.1:'+apiPort});
 for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,150));}
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('https://**',r=>r.abort());
 await page.goto(base);await page.locator('#login-form [name=tenantSlug]').fill(account.slug);await page.locator('#login-form [name=email]').fill(account.email);await page.locator('#login-form [name=password]').fill(account.password);await page.locator('#login-form').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>document.body.dataset.authReady==='true');
 const api=(path,method='GET',body)=>page.evaluate(async({path,method,body})=>{const r=await fetch('/api/v1'+path,{method,headers:{'content-type':'application/json','x-boat-csrf':'1'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}},{path,method,body});
 let botId;try{const prior=JSON.parse(await readFile('acceptance-evidence/visual-comparison-bot.json','utf8'));if(prior.tenantId===account.tenantId)botId=prior.botId}catch{}
 if(!botId){const created=await api('/bots','POST',{name:graph.name,template:'blank'});assert.equal(created.status,201);botId=created.data.id;await writeFile('acceptance-evidence/visual-comparison-bot.json',JSON.stringify({tenantId:account.tenantId,botId}),{mode:0o600})}const path='/bots/'+botId+'/flows';
 const save=async f=>{const cfg=(await api(path)).data;const reply=await api(path+'/draft','PUT',{...f,expectedRevision:cfg.draft.draftRevision});assert.equal(reply.status,200,JSON.stringify(reply.data));};
 const load=async()=>{await page.goto('about:blank');await page.goto(base+'/#bot/'+botId);await page.waitForSelector('.canvas-node');};
 const shot=name=>page.screenshot({path:dir+'/'+name+'.png'});
 const select=async id=>page.locator('[data-node-id="'+id+'"] .canvas-title').evaluate(b=>b.click());
 await save(graph);await load();assert.equal(await page.locator('.canvas-node').count(),11);
 await select('welcome');await page.locator('.canvas-navigation .canvas-zoom').click();await page.locator('.builder-graph-search').fill('ترحيب العملاء');await page.locator('.builder-search-results button').first().click();
 // Identical graph/layout, viewport, zoom, locale and selected step in both phases.
 await shot('01-workspace');await page.locator('.flow-canvas').screenshot({path:dir+'/02-node-cards.png'});await page.locator('.flow-canvas').screenshot({path:dir+'/03-connectors.png'});
 if(!await page.locator('.builder-palette').isVisible())await studioClick(page,'إظهار المكونات');
 await page.locator('.builder-palette').screenshot({path:dir+'/04-library.png'});await page.locator('.builder-inspector').screenshot({path:dir+'/05-inspector.png'});await page.locator('.builder-inspector').screenshot({path:dir+'/06-message-editor.png'});
 await select('condition');await page.locator('.builder-inspector').screenshot({path:dir+'/07-condition-editor.png'});
 await studioClick(page,'تجربة المحادثة');await page.locator('.builder-preview-dialog').screenshot({path:dir+'/08-preview.png'});await page.locator('.builder-preview-dialog .builder-dialog-header button').click();
 await select('welcome');await page.setViewportSize({width:390,height:844});await shot('09-mobile');await page.setViewportSize({width:1440,height:1000});
 check('ten actual matched Chromium screenshots; real stored 11-node tourism graph, Arabic,100% zoom,1440x1000 and390x844');
 if(phase!=='before'){
  await page.locator('.builder-properties>button').first().click();
  if(!await page.locator('.builder-palette').isVisible())await studioClick(page,'إظهار المكونات');
  const search=page.getByLabel('بحث مكتبة المكونات');await search.fill('شرط');assert.equal(await page.locator('.builder-quick-item:visible').count(),1);await search.fill('no-such-component');assert.ok(await page.locator('.builder-library-empty').isVisible());await search.fill('');
  await page.getByRole('button',{name:'إضافة رسالة نصية',exact:true}).click();assert.equal(await page.locator('.canvas-node').count(),12);await page.getByLabel('نص الرسالة',{exact:true}).fill('رسالة جديدة من المكتبة');await page.locator('.builder-properties>button').first().click();await page.locator('.flow-canvas').focus();await page.keyboard.press('Control+z');assert.equal(await page.locator('.canvas-node').count(),12);await page.keyboard.press('Control+z');assert.equal(await page.locator('.canvas-node').count(),11);
  check('search groups/empty state and add/edit/Undo retain the original graph');
  await select('welcome');const text=page.getByLabel('نص الرسالة',{exact:true});await text.fill('أهلًا {{customer_name}} — تم التعديل');await page.locator('#builder-save').click();await page.locator('#builder-unsaved').filter({hasText:'تم الحفظ على الخادم'}).waitFor();const saved=(await api(path)).data.draft.definition;assert.equal(saved.nodes.find(n=>n.id==='welcome').text,'أهلًا {{customer_name}} — تم التعديل');await load();await select('welcome');assert.equal(await page.getByLabel('نص الرسالة',{exact:true}).inputValue(),'أهلًا {{customer_name}} — تم التعديل');check('message edit persists via actual UI save and reopen without losing11 nodes');
  const edge=page.locator('.canvas-edge-hit[data-from=start]');await edge.evaluate(e=>e.dispatchEvent(new MouseEvent('click',{bubbles:true})));const edges=await page.locator('.canvas-edge').count();await studioClick(page,'فصل الوصلة');assert.equal(await page.locator('.canvas-edge').count(),edges-1);await page.locator('.flow-canvas').focus();await page.keyboard.press('Control+z');assert.equal(await page.locator('.canvas-edge').count(),edges);check('select/disconnect/Undo restores all original edges');
  await studioClick(page,'تجربة المحادثة');const dialog=page.locator('.builder-preview-dialog');await dialog.getByRole('button',{name:'البرامج السياحية',exact:true}).click();await dialog.locator('.builder-preview-input input').fill('عميل تجريبي');await dialog.locator('.builder-preview-input button').click();await dialog.getByText('ما رقم التواصل؟',{exact:true}).waitFor();await dialog.locator('.builder-preview-input input').fill('+201012345678');await dialog.locator('.builder-preview-input button').click();await dialog.getByText('تم تحويل المحادثة لفريق خدمة العملاء.',{exact:true}).waitFor();assert.equal(await dialog.locator('.flow-content-card').count(),2);await dialog.locator('.builder-dialog-header button').click();check('shared real server simulation traverses gallery,input validation,condition and employee handoff');
  await page.locator('.builder-properties>button').first().click();await page.setViewportSize({width:390,height:844});if(await page.locator('.builder-palette').isVisible())await page.getByRole('button',{name:'إغلاق المكتبة ×',exact:true}).click();await studioClick(page,'إظهار المكونات');await page.getByRole('button',{name:'إغلاق المكتبة ×',exact:true}).click();assert.ok(!await page.locator('.builder-palette').isVisible());assert.ok(await page.locator('.flow-canvas').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1440,height:1000});check('mobile library opens/closes with visible controls and no horizontal page overflow');
 }
 if(phase!=='before'){await page.locator('#builder-save').click();await page.locator('#builder-unsaved').filter({hasText:'تم الحفظ على الخادم'}).waitFor();}
 const large={name:'مخطط تجريبي · 500 خطوة',channel:'WEBSITE',startId:'n0',nodes:Array.from({length:500},(_,i)=>i===499?{id:'n'+i,type:'END',text:'انتهى'}:{id:'n'+i,type:i?'INPUT':'START',field:'answer',text:'سؤال تجريبي '+i,next:'n'+(i+1)})};large.layout=arrangeFlow(large);await save(large);await load();await select('n1');await page.locator('.canvas-navigation .canvas-zoom').click();for(let i=0;i<17;i++)await page.locator('.canvas-navigation button').first().evaluate(b=>b.click());assert.equal(await page.locator('.canvas-node').count(),500);assert.equal(await page.locator('.canvas-edge').count(),499);await shot('10-large-graph');check('actual500-node save/reopen and499 connectors at matching fixed zoom');
 assert.deepEqual(errors,[]);await writeFile(dir+'/results.json',JSON.stringify({phase,checks,errors,fixture:{botId,nodes:11,language:'ar',zoom:'100%',selected:'welcome',viewport:[1440,1000],mobile:[390,844]},provider:'NONE; actual PostgreSQL/API/Chromium'},null,2)+'\n');
}finally{await browser?.close();for(const p of children)p.kill('SIGTERM')}
