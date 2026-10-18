import {initWhatsAppSignup} from './whatsapp-signup.js';
import {initCommerce} from './commerce-ui.js';
import {initAdvanced} from './advanced-ui.js';
import {initFlowBuilder} from './flow-builder.js';
import {initInsights} from './insights-ui.js';
import {initWorkspace} from './workspace-ui.js';
import {initExtensions} from './extensions.js';
const $=id=>document.getElementById(id);
const el=(tag,text,klass)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(klass)n.className=klass;return n};
const state={token:'',role:'',tenantId:'',userId:'',demo:false,page:'overview',team:[],contacts:[]};
const canEdit=()=>['OWNER','MANAGER'].includes(state.role);
function notify(message,type='success'){const n=$('notice');n.hidden=!message;n.className='notice '+type;n.textContent=message}
async function execute(fn){try{return await fn()}catch(e){notify(e.message||'تعذر إتمام العملية','error')}}
async function api(path,{method='GET',body}={}){const token=state.token;const r=await fetch('/api/v1'+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json().catch(()=>({error:'تعذر قراءة رد الخادم'}));if(token!==state.token)throw new Error('انتهت الجلسة السابقة');if(!r.ok){const e=new Error(d.error||'تعذر الطلب');e.status=r.status;throw e}return d}
function button(text,action,klass='secondary'){const b=el('button',text,klass);b.type='button';b.onclick=()=>execute(action);return b}
function card(title,text){const c=el('article',undefined,'card');c.append(el('strong',title));if(text)c.append(el('p',text));return c}
function bind(id,action){$(id).onsubmit=e=>{e.preventDefault();const f=e.currentTarget,submit=f.querySelector('button.primary,button.secondary');if(submit)submit.disabled=true;execute(async()=>{try{await action(Object.fromEntries(new FormData(f)),f)}finally{if(submit)submit.disabled=false}})}}
const ctx={state,api,notify,execute,canEdit,$,el,button,card,bind};
ctx.commerce=initCommerce(ctx);
const whatsappSignup=initWhatsAppSignup(ctx);
const advanced=initAdvanced(ctx),workspace=initWorkspace(ctx),extensions=initExtensions(ctx),builder=initFlowBuilder(ctx),insights=initInsights(ctx);
 // Keep everyday catalog fields visible, move optional channels/metadata to a disclosure.
 // All original input elements remain inside the SAME form for FormData and validation.
 const catalogForm=$('catalog-form');
 const advancedCatalog=el('details',undefined,'catalog-optional');
 advancedCatalog.append(el('summary','بيانات إضافية: التصنيف والصورة والرابط'));
 for(const name of ['categoryLabel','imageUrl','externalUrl']){
  const field=catalogForm.querySelector('[name="'+name+'"]')?.closest('label');
  if(field)advancedCatalog.append(field);
 }
 catalogForm.insertBefore(advancedCatalog,catalogForm.querySelector('button.primary'));

// First-time company owners see the 9 everyday destinations; advanced settings remain
// one disclosure away. This only reorganizes navigation, not API permissions.
const nav=document.querySelector('.sidebar nav');
const basics=new Set(['overview','flow-builder','wa-inbox','leads','catalog','analytics','website','settings','team']);
const advancedNav=document.createElement('details');advancedNav.className='nav-advanced';
const advancedLabel=document.createElement('summary');advancedLabel.textContent='أدوات متقدمة وإعدادات';advancedNav.append(advancedLabel);
const advancedButtons=document.createElement('div');advancedButtons.className='nav-advanced-buttons';
for(const tab of [...nav.querySelectorAll('[data-page]')])if(!basics.has(tab.dataset.page))advancedButtons.append(tab);
advancedNav.append(advancedButtons);nav.append(advancedNav);
 // Switching desktop -> mobile must never leave an expanded advanced section over the workspace.
 const mobileNavQuery=window.matchMedia('(max-width:800px)');
 mobileNavQuery.addEventListener?.('change',event=>{if(event.matches)advancedNav.open=false});
 document.addEventListener('click',event=>{
   if(!mobileNavQuery.matches||!advancedNav.open||advancedNav.contains(event.target))return;
   advancedNav.open=false;
 });

 // Lightweight inline SVG icon vocabulary shared by everyday and advanced destinations.
 // Unlike font glyphs, these render consistently in Arabic RTL and require no icon CDN.
 const navIcons={
  overview:'M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3z',
  'flow-builder':'M5 5h6v5H5z M15 15h6v5h-6z M8 10v5h10',
  'wa-inbox':'M4 5h16v12H9l-5 4z M7 9h10 M7 13h7',
  leads:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M18 8h4 M20 6v4',
  analytics:'M4 20V9 M10 20V4 M16 20v-9 M22 20V7',
  catalog:'M4 4h7v7H4z M14 4h7v7h-7z M4 14h7v7H4z M14 14h7v7h-7z',
  triggers:'M13 2 4 14h7l-1 8 10-13h-7z',
  campaigns:'M4 11v4 M8 7v12 M12 10l9-5v14l-9-5H8 M8 19l2 3',
  media:'M4 4h16v16H4z M7 16l4-4 3 3 3-5 3 5 M8 8h1',
  website:'M3 4h18v16H3z M3 9h18 M8 9v11',
  templates:'M4 5h16v15H4z M7 9h10 M7 13h8 M7 17h5',
  settings:'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18 M8 12a4 4 0 0 1 8 0 M12 16v2',
  'ai-settings':'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z',
  integrations:'M3 8h7 M14 8h7 M10 8l-2-2 M10 8l-2 2 M14 16H3 M14 16l-2-2 M14 16l-2 2',
  team:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M19 8v6 M16 11h6',
  'wa-connect':'M4 4h16v12H9l-5 4z M8 9h8 M8 12h5',
  connectors:'M5 6v5 M19 13v5 M3 11h6 M15 13h6 M9 9h6v6',
  channels:'M3 3h8v8H3z M13 13h8v8h-8z M11 7h4 M15 7v6',
  'comment-automation':'M4 4h16v12H8l-4 4z M8 9h9 M8 13h6',
  privacy:'M12 3 4 7v6c0 5 4 8 8 9 4-1 8-4 8-9V7z M9 12l2 2 4-4',
  usage:'M5 20V9 M11 20V4 M17 20v-8 M3 21h18'
 };
 for(const tab of nav.querySelectorAll('[data-page]')){
  let holder=tab.querySelector('span');if(!holder){holder=document.createElement('span');tab.prepend(holder)}
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','20');svg.setAttribute('height','20');
  svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');
  svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',navIcons[tab.dataset.page]||navIcons.settings);
  svg.append(path);holder.replaceChildren(svg);holder.setAttribute('aria-hidden','true');
 }

const names=Object.fromEntries([...document.querySelectorAll('[data-page]')].map(n=>[n.dataset.page,n.textContent.trim()]));
async function choose(page){if(!names[page])return;if(page!=='flow-builder'){document.body.classList.remove('studio-focus');const preview=document.querySelector('.builder-preview-dialog[open]');if(preview?.close)preview.close();const focus=document.querySelector('.builder-view-actions button:last-child');if(focus)focus.textContent='ملء الشاشة';}if(!basics.has(page)&&!mobileNavQuery.matches)advancedNav.open=true;else advancedNav.open=false;if(!canEdit()&&document.querySelector('[data-page="'+page+'"]')?.dataset.admin)return;state.page=page;$('page-title').textContent=names[page];document.querySelectorAll('.page').forEach(n=>n.hidden=n.id!==page);document.querySelectorAll('[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===page));notify('');await execute(async()=>{if(page==='flow-builder')await builder.load();else if(page==='analytics')await insights.load();else if(page==='wa-connect')await whatsappSignup.load();else if(['wa-inbox','leads','templates','team'].includes(page))await workspace.load(page);else if(['connectors','channels','privacy','comment-automation'].includes(page))await advanced.load(page);else if(['triggers','campaigns','media','website','integrations','usage','ai-settings'].includes(page))await extensions.load(page);else if(page==='catalog')await catalog();else if(page==='settings')await knowledge();else await dashboard()})}
ctx.choose=choose;
async function onboardingProgress(){
 const host=$('getting-started');host.replaceChildren();host.hidden=!canEdit();
 if(!canEdit())return;
 const [flowConfig,items,widget]=await Promise.all([api('/flows'),api('/catalog'),api('/widget/settings')]);
 const steps=[
  {name:'صمّم بوتك الأول في 3 خطوات',ready:Boolean(flowConfig.published),page:'flow-builder',action:'ابدأ تصميم البوت'},
  {name:'أضف ونشّر منتجات أو خدمات شركتك',ready:items.some(item=>item.status==='PUBLISHED'),page:'catalog',action:'افتح الكتالوج'},
  {name:'جهّز شات موقعك (اختياري)',ready:Boolean(widget.enabled),page:'website',action:'شات الموقع'}
 ];
 const completed=steps.filter(item=>item.ready).length;
 host.append(el('h3','ابدأ بسهولة — '+completed+' من '+steps.length+' خطوات جاهزة'));
 host.append(el('p','دي خطوات إعداد اختيارية هتسهّل عليك أول بوت. مش هنطلب منك ربط أي منصة خارجية دلوقتي.','muted'));
 const grid=el('div',undefined,'getting-started-grid');
 for(const [index,item] of steps.entries()){
  const card=el('article',undefined,'getting-started-card');
  card.append(el('strong',(item.ready?'✓ ':'○ ')+(index+1)+'. '+item.name));
  card.append(el('small',item.ready?'مكتملة':'لسه محتاجة إعداد','muted'));
  if(!item.ready)card.append(button(item.action,()=>choose(item.page),'secondary'));
  grid.append(card);
 }
 host.append(grid);
}
async function dashboard(){const host=$('dashboard-metrics');host.replaceChildren();$('dashboard-ready').replaceChildren();const [s,notes]=await Promise.all([api('/leads/summary'),api('/notifications')]);for(const [label,value] of [['الاستفسارات المؤهلة',s.total],['جاهزون لموظف',s.ready],['تم التواصل',s.contacted],['مهتمون',s.interested]]){const c=el('article',undefined,'metric');c.append(el('span',label),el('strong',value));host.append(c)}const ready=notes.filter(x=>x.stage==='READY_FOR_AGENT');if(!ready.length)$('dashboard-ready').append(el('p','لا يوجد عملاء ينتظرون التحويل حاليًا.'));for(const n of ready.slice(0,8))$('dashboard-ready').append(button(n.customer_name+' • '+n.channel,()=>choose('wa-inbox')));await onboardingProgress()}
async function catalog(){const host=$('catalog-items');host.replaceChildren();$('catalog-form').hidden=!canEdit();const rows=await api('/catalog');if(!rows.length)host.append(el('p','الكتالوج فارغ. أضف معلومات شركتك المعتمدة.'));for(const item of rows){const c=card(item.title,[item.categoryLabel,item.description,item.priceText,item.status].filter(Boolean).join(' • '));if(canEdit()){c.append(button('تعديل',()=>{const f=$('catalog-form');for(const key of ['id','kind','title','categoryLabel','description','priceText','imageUrl','externalUrl'])f.elements.namedItem(key).value=item[key]||'';$('catalog-editor-title').textContent='تعديل — الحفظ يعيد العنصر لمسودة';f.scrollIntoView({block:'center'})}));if(item.status!=='PUBLISHED')c.append(button('اعتماد ونشر',async()=>{await api('/catalog/'+item.id+'/publish',{method:'POST'});await catalog()}));if(item.status!=='ARCHIVED')c.append(button('أرشفة',async()=>{await api('/catalog/'+item.id+'/archive',{method:'POST'});await catalog()},'danger'))}host.append(c)}}
bind('catalog-form',async(d,f)=>{const id=d.id;delete d.id;await api('/catalog'+(id?'/'+id:''),{method:id?'PUT':'POST',body:d});f.reset();await catalog();notify('تم حفظ مسودة العنصر')});$('catalog-new').onclick=()=>{$('catalog-form').reset();$('catalog-editor-title').textContent='إضافة عنصر'};
async function knowledge(){const host=$('faq-list');host.replaceChildren();const rows=await api('/knowledge');if(!rows.length)host.append(el('p','لا توجد معلومات معتمدة بعد.'));for(const r of rows){const c=card(r.question,r.answer+' • '+r.status);if(r.status==='DRAFT'&&canEdit())c.append(button('اعتماد ونشر',async()=>{await api('/knowledge/'+r.id+'/publish',{method:'PATCH'});await knowledge()}));host.append(c)}}
bind('faq-form',async(d,f)=>{await api('/knowledge',{method:'POST',body:d});f.reset();await knowledge()});
async function refreshNotifications(){if(!state.token)return;const notes=await api('/notifications');const visible=notes.filter(x=>Number(x.unread)>0||x.stage==='READY_FOR_AGENT');$('notification-count').textContent=visible.length;const host=$('notification-list');host.replaceChildren();if(!visible.length)host.append(el('p','لا توجد تنبيهات جديدة.'));for(const n of visible.slice(0,15))host.append(button(n.customer_name+' — '+(n.stage==='READY_FOR_AGENT'?'جاهز للتواصل':n.unread+' رسائل غير مقروءة'),()=>{host.hidden=true;return choose('wa-inbox')}))}
$('notifications').onclick=()=>{$('notification-list').hidden=!$('notification-list').hidden;execute(refreshNotifications)};
bind('login-form',async(d,f)=>{const session=await api('/auth/login',{method:'POST',body:d});state.token=session.token;state.role=session.role;const me=await api('/auth/me');state.userId=me.userId;state.tenantId=me.tenantId;$('company-name').textContent=d.tenantSlug;f.reset();state.contacts=await api('/contacts');state.team=canEdit()?await api('/team'):[];document.querySelectorAll('[data-admin]').forEach(n=>n.hidden=!canEdit());$('login').hidden=true;$('app').hidden=false;await choose('overview');await refreshNotifications()});
$('logout').onclick=()=>execute(async()=>{if(builder.hasUnsavedChanges()&&!confirm('هناك تعديلات بوت غير محفوظة. تسجيل الخروج سيفقدها. هل تريد المتابعة؟'))return;if(state.token)await api('/auth/logout',{method:'POST'}).catch(()=>{});state.token='';state.userId='';state.tenantId='';state.contacts=[];state.templateCatalog=[];state.team=[];ctx.commerce.reset();whatsappSignup.reset();advanced.reset();workspace.reset();extensions.reset();builder.reset();insights.reset();for(const id of ['dashboard-metrics','dashboard-ready','inbox-list','thread-context','lead-list','catalog-items','faq-list','team-list','team-invites','template-list','template-parameters','trigger-list','media-list','campaign-list','integration-list','key-list','usage-summary','runtime-jobs'])$(id).replaceChildren();document.querySelectorAll('form').forEach(f=>f.reset());$('notification-list').replaceChildren();$('notification-list').hidden=true;$('app').hidden=true;$('login').hidden=false;notify('')});
document.querySelectorAll('[data-page]').forEach(n=>n.onclick=()=>choose(n.dataset.page));document.querySelectorAll('[data-goto]').forEach(n=>n.onclick=()=>choose(n.dataset.goto));
setInterval(()=>{if(state.token&&!document.hidden)refreshNotifications().catch(()=>{})},20000);
