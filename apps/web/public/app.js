import {initBotManager} from './bot-manager.js';
import {initWhatsAppSignup} from './whatsapp-signup.js';
import {initCommerce} from './commerce-ui.js';
import {initAdvanced} from './advanced-ui.js';
import {initFlowBuilder} from './flow-builder.js';
import {initInsights} from './insights-ui.js';
import {initWorkspace} from './workspace-ui.js';
import {initExtensions} from './extensions.js';
import {initVesselWorkspace} from './vessel.js';
import {initVesselPages} from './vessel-pages.js';
const $=id=>document.getElementById(id);
const el=(tag,text,klass)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(klass)n.className=klass;return n};
const state={token:'',role:'',tenantId:'',userId:'',demo:false,page:'overview',team:[],contacts:[]};
const canEdit=()=>['OWNER','MANAGER'].includes(state.role);
const uiErrorTranslations={
 'Flow has unreachable nodes':'يوجد خطوات غير متصلة بالمسار الرئيسي. اربطها من مخارج الرسائل قبل النشر.',
 'Flow contains an automatic loop without customer input':'يوجد مسار دائري بدون سؤال أو اختيار للعميل. أضف انتظارًا لإجابة العميل.',
 'Invalid number of options':'عدد الاختيارات غير صحيح؛ الأزرار حتى 3 والقوائم حتى 10، وبحد أدنى اختيار واحد.',
 'Choice title exceeds WhatsApp limit':'عنوان الاختيار طويل جدًا. استخدم 20 حرفًا للزر أو 24 حرفًا للقائمة.',
 'Choice description exceeds limit':'وصف عنصر القائمة يجب ألا يزيد عن 72 حرفًا.',
 'Node links to missing':'هناك رابط يؤدي إلى خطوة محذوفة. أعد توصيل المسار.',
 'Flow requires 2–100 nodes':'عدد الخطوات المسموح من 2 إلى 100.',
 'Missing choice destination':'اختر الخطوة التي يُنقل إليها العميل بعد الضغط على الاختيار.',
  'Invalid trigger':'اكتب كلمة تشغيل صالحة وحدد الخطوة الهدف قبل حفظ القاعدة.',
  'HTTPS URL required':'اكتب رابطًا آمنًا يبدأ بـ https:// في حقل الرابط.',
  'Draft changed in another session':'المسودة اتعدلت في جلسة أخرى. انسخ تعريف البوت أولًا للاحتفاظ بتغييراتك، ثم راجع آخر إصدار قبل إعادة الحفظ.'
};
function notify(message,type='success'){
 const n=$('notice'),raw=String(message||'');
 n.hidden=!raw;n.className='notice '+type;
 n.replaceChildren();if(!raw)return;
 n.append(document.createTextNode(uiErrorTranslations[raw]||Object.entries(uiErrorTranslations).find(([key])=>raw.includes(key))?.[1]||raw));
 const close=document.createElement('button');close.type='button';close.className='notice-close';close.textContent='×';close.setAttribute('aria-label','إغلاق التنبيه');
 close.onclick=()=>{n.hidden=true;n.replaceChildren()};n.append(close);
}
async function execute(fn){try{return await fn()}catch(e){notify(e.message||'تعذر إتمام العملية','error')}}
async function api(path,{method='GET',body}={}){const token=state.token;const r=await fetch('/api/v1'+path,{method,headers:{...(/^[A-Za-z0-9_-]{43}$/.test(token)?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{}),'x-boat-csrf':'1'},body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json().catch(()=>({error:'تعذر قراءة رد الخادم'}));if(token!==state.token)throw new Error('انتهت الجلسة السابقة');if(!r.ok){const e=new Error(d.error||'تعذر الطلب');e.status=r.status;throw e}return d}
function button(text,action,klass='secondary'){const b=el('button',text,klass);b.type='button';b.onclick=()=>execute(action);return b}
function card(title,text){const c=el('article',undefined,'card');c.append(el('strong',title));if(text)c.append(el('p',text));return c}
function bind(id,action){$(id).onsubmit=e=>{e.preventDefault();const f=e.currentTarget,submit=f.querySelector('button.primary,button.secondary');if(submit)submit.disabled=true;execute(async()=>{try{await action(Object.fromEntries(new FormData(f)),f)}finally{if(submit)submit.disabled=false}})}}
document.addEventListener('invalid',event=>{
  const control=event.target;
  if(!(control instanceof HTMLInputElement||control instanceof HTMLSelectElement||control instanceof HTMLTextAreaElement))return;
  const validity=control.validity;
  const message=validity.valueMissing?'هذا الحقل مطلوب. أدخل البيانات أولًا.':validity.typeMismatch&&control.type==='email'?'اكتب بريدًا إلكترونيًا صحيحًا يحتوي على @.':validity.typeMismatch?'تأكد من صيغة القيمة المطلوبة.':validity.patternMismatch?'القيمة لا تطابق الصيغة المطلوبة لهذا الحقل.':validity.rangeUnderflow||validity.rangeOverflow?'القيمة خارج الحدود المسموحة.':'راجع البيانات المدخلة.';
  control.setCustomValidity(message);
 },true);
 document.addEventListener('input',event=>event.target?.setCustomValidity?.(''),true);
 document.addEventListener('change',event=>event.target?.setCustomValidity?.(''),true);
 const ctx={state,api,notify,execute,canEdit,$,el,button,card,bind};
ctx.commerce=initCommerce(ctx);
const whatsappSignup=initWhatsAppSignup(ctx);
const advanced=initAdvanced(ctx),workspace=initWorkspace(ctx),extensions=initExtensions(ctx),builder=initFlowBuilder(ctx),insights=initInsights(ctx);

const bots=initBotManager(ctx,async bot=>{if(builder.hasUnsavedChanges()){notify('احفظ تعديلات البوت الحالي قبل فتح بوت آخر.','error');return;}state.botId=bot.id;state.botName=bot.name;state.editorMode=bot.editorMode||null;await choose('flow-builder')},()=>!builder.hasUnsavedChanges());
const botsNav=button('إدارة البوتات',()=>choose('bots'),'nav');botsNav.dataset.page='bots';document.querySelector('.sidebar nav').prepend(botsNav);
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
 const priceInput=catalogForm.elements.namedItem('priceText');
 if(priceInput){
   const currencySelect=el('select');
   currencySelect.id='catalog-price-currency';
   currencySelect.setAttribute('aria-label','عملة السعر المعلن عند كتابة أرقام فقط');
   for(const [value,label] of [['','العملة (اختياري للنصوص)'],['جنيه مصري','جنيه مصري EGP'],['ريال سعودي','ريال سعودي SAR'],['دولار أمريكي','دولار أمريكي USD'],['يورو','يورو EUR']]){
     const option=el('option',label);option.value=value;currencySelect.append(option);
   }
   priceInput.closest('label')?.append(currencySelect);
 }

// Native media file upload stays bound to the same FormData and validation.
const mediaFile=$('media-form')?.querySelector('input[type="file"]');
if(mediaFile){
  const fileButton=el('button','اختيار ملف من الجهاز','secondary');fileButton.type='button';fileButton.classList.add('media-file-button');
  const fileName=el('span','لم يتم اختيار ملف','media-file-name');
  fileButton.onclick=()=>mediaFile.click();
  mediaFile.addEventListener('change',()=>{fileName.textContent=mediaFile.files?.[0]?.name||'لم يتم اختيار ملف'});
  mediaFile.classList.add('media-accessible-input');
  mediaFile.parentElement.after(fileButton,fileName);
  const note=$('media-form').nextElementSibling;
  if(note?.textContent?.includes('MEDIA_PUBLIC_ORIGIN')){
    const details=el('details',undefined,'media-technical-details');
    note.before(details);details.append(el('summary','تفاصيل فنية للمشغل'),note);
  }
}
// First-time company owners see the 9 everyday destinations; advanced settings remain
// one disclosure away. This only reorganizes navigation, not API permissions.
const nav=document.querySelector('.sidebar nav');
const basics=new Set(['bots','overview','flow-builder','wa-inbox','leads','catalog','analytics','website','settings','team']);
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
async function choose(page){if(!names[page])return;if(page!=='flow-builder'){document.body.classList.remove('studio-focus','bot-studio');const preview=document.querySelector('.builder-preview-dialog[open]');if(preview?.close)preview.close();const focus=document.querySelector('.builder-view-actions button:last-child');if(focus)focus.textContent='ملء الشاشة';}if(!basics.has(page)&&!mobileNavQuery.matches)advancedNav.open=true;else advancedNav.open=false;if(!canEdit()&&document.querySelector('[data-page="'+page+'"]')?.dataset.admin)return;state.page=page;window.scrollTo(0,0);if(page==='flow-builder'&&state.botId)history.replaceState(null,'','#bot/'+state.botId);else if(location.hash.startsWith('#bot/'))history.replaceState(null,'',location.pathname+location.search);const alerts=$('notification-list');if(alerts){alerts.hidden=true;$('notifications').setAttribute('aria-expanded','false')}$('page-title').textContent=names[page];document.querySelectorAll('.page').forEach(n=>n.hidden=n.id!==page);document.querySelectorAll('[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===page));notify('');await execute(async()=>{if(page==='bots')await bots.load();else if(page==='flow-builder')await builder.load();else if(page==='analytics')await insights.load();else if(page==='wa-connect')await whatsappSignup.load();else if(['wa-inbox','leads','templates','team'].includes(page))await workspace.load(page);else if(['connectors','channels','privacy','comment-automation'].includes(page))await advanced.load(page);else if(['triggers','campaigns','media','website','integrations','usage','ai-settings'].includes(page))await extensions.load(page);else if(page==='catalog')await catalog();else if(page==='settings')await knowledge();else await dashboard()})}
ctx.choose=choose;
document.addEventListener('boat-open-bots',()=>choose('bots'));
async function onboardingProgress(){
 const host=$('getting-started');host.replaceChildren();host.hidden=!canEdit();
 if(!canEdit())return;
 const [bots,items,widget]=await Promise.all([api('/bots'),api('/catalog'),api('/widget/settings')]);
 const steps=[
  {name:'أنشئ بوتك الأول وانشر إصدارًا صالحًا',ready:bots.some(b=>b.publishedVersion),page:'bots',action:'إدارة البوتات'},
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
async function catalog(){
 const host=$('catalog-items');host.replaceChildren();
 const rows=await api('/catalog');
 const stateLabel={DRAFT:'مسودة',PUBLISHED:'منشور',ARCHIVED:'مؤرشف'};
 if(!rows.length)host.append(el('p','الكتالوج فارغ. استخدم «إضافة منتج أو خدمة» لإنشاء أول عنصر.','vessel-catalog-blank'));
 for(const item of rows){
   const c=card(item.title);
   c.classList.add('catalog-item-card');
   const status=el('span',stateLabel[item.status]||'غير معروف','catalog-state');
   status.dataset.status=item.status;
   const header=el('div',undefined,'catalog-item-header');header.append(status);
   c.append(header);
   if(item.categoryLabel)c.append(el('small',item.categoryLabel,'catalog-category'));
   if(item.description)c.append(el('p',item.description));
   if(item.priceText){
     const value=item.priceText.trim();
     const numericOnly=/^[0-9٠-٩]+(?:[.,٬٫][0-9٠-٩]+)*$/.test(value);
     c.append(el('p','السعر: '+value+(numericOnly?' — العملة غير محددة':''),'catalog-price'));
   }
   if(canEdit()){
     const actions=el('div',undefined,'catalog-item-actions');
     actions.append(button('تعديل',()=>{
       const f=$('catalog-form');
       for(const key of ['id','kind','title','categoryLabel','description','priceText','imageUrl','externalUrl'])
         f.elements.namedItem(key).value=item[key]||'';
       $('catalog-editor-title').textContent='تعديل — الحفظ يعيد العنصر لمسودة';
       f.scrollIntoView({block:'center'});
     }));
     if(item.status!=='PUBLISHED'&&item.status!=='ARCHIVED')actions.append(button('اعتماد ونشر',async()=>{
       if(!confirm('هل راجعت بيانات هذا العنصر وتريد نشره للعملاء؟'))return;
       await api('/catalog/'+item.id+'/publish',{method:'POST'});await catalog();
     },'primary'));
     if(item.status!=='ARCHIVED'){
       const extra=el('details',undefined,'catalog-item-extra');
       const summary=el('summary','المزيد من الإجراءات');extra.append(summary,button('أرشفة العنصر',async()=>{
         if(!confirm('أرشفة هذا العنصر وإيقاف ظهوره في الكتالوج المنشور؟'))return;
         await api('/catalog/'+item.id+'/archive',{method:'POST'});await catalog();
       },'danger'));
       actions.append(extra);
     }
     c.append(actions);
   }
   host.append(c);
 }
}
bind('catalog-form',async(d,f)=>{if(/(^|\s)-\s*[0-9٠-٩]/.test(d.priceText||'')){f.elements.priceText.focus();throw new Error('السعر لا يمكن أن يكون سالبًا. اكتب سعرًا صحيحًا أو «عند الطلب».')}const price=String(d.priceText||'').trim(),currency=$('catalog-price-currency')?.value||'';
 if(/^[0-9٠-٩]+(?:[.,٬٫][0-9٠-٩]+)*$/.test(price)){
   if(!currency){f.elements.priceText.focus();throw new Error('اكتب العملة مع السعر أو اخترها من قائمة العملات، أو استخدم «عند الطلب».')}
   d.priceText=price+' '+currency;
 }
 const id=d.id;delete d.id;await api('/catalog'+(id?'/'+id:''),{method:id?'PUT':'POST',body:d});f.reset();$('catalog-editor-title').textContent='إضافة عنصر';await catalog();notify('تم حفظ مسودة العنصر')});$('catalog-new').onclick=()=>{$('catalog-form').reset();$('catalog-editor-title').textContent='إضافة عنصر'};
async function knowledge(){const host=$('faq-list');host.replaceChildren();const rows=await api('/knowledge');if(!rows.length)host.append(el('p','لا توجد معلومات معتمدة بعد.'));for(const r of rows){const c=card(r.question,r.answer+' • '+r.status);if(r.status==='DRAFT'&&canEdit()){
    c.append(button('تعديل المسودة',()=>{
      host.querySelectorAll('.faq-inline-editor').forEach(editor=>editor.remove());$('faq-form').hidden=true;
      const edit=el('form',undefined,'faq-inline-editor'),question=el('textarea'),answer=el('textarea');
      question.value=r.question;question.maxLength=300;question.minLength=5;question.required=true;question.setAttribute('aria-label','سؤال المعرفة');
      answer.value=r.answer;answer.maxLength=2000;answer.minLength=5;answer.required=true;answer.setAttribute('aria-label','إجابة المعرفة');
      const save=el('button','حفظ التعديل','primary');save.type='submit';
      edit.append(question,answer,save,button('إلغاء',()=>{edit.remove();$('faq-form').hidden=false}));
      edit.onsubmit=event=>{event.preventDefault();execute(async()=>{if(!edit.reportValidity())return;await api('/knowledge/'+r.id,{method:'PUT',body:{question:question.value,answer:answer.value}});await knowledge();$('faq-form').hidden=false;notify('تم تعديل المسودة دون نشرها')})};
      c.append(edit);question.focus();
    }),button('اعتماد ونشر',async()=>{await api('/knowledge/'+r.id+'/publish',{method:'PATCH'});await knowledge()}));
   }host.append(c)}}
bind('faq-form',async(d,f)=>{await api('/knowledge',{method:'POST',body:d});f.reset();await knowledge();f.hidden=true});
async function refreshNotifications(){if(!state.token)return;const notes=await api('/notifications');const visible=notes.filter(x=>Number(x.unread)>0||x.stage==='READY_FOR_AGENT');$('notification-count').textContent=visible.length;const host=$('notification-list');host.replaceChildren();if(!visible.length)host.append(el('p','لا توجد تنبيهات جديدة.'));for(const n of visible.slice(0,15))host.append(button(n.customer_name+' — '+(n.stage==='READY_FOR_AGENT'?'جاهز للتواصل':n.unread+' رسائل غير مقروءة'),()=>{host.hidden=true;return choose('wa-inbox')}))}
const notificationPanel=$('notification-list');
$('notifications').setAttribute('aria-expanded','false');
const closeNotifications=()=>{notificationPanel.hidden=true;$('notifications').setAttribute('aria-expanded','false')};
$('notifications').onclick=()=>{const open=notificationPanel.hidden;notificationPanel.hidden=!open;$('notifications').setAttribute('aria-expanded',String(open));if(open)execute(refreshNotifications)};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!notificationPanel.hidden){closeNotifications();$('notifications').focus()}});
document.addEventListener('click',event=>{if(!notificationPanel.hidden&&!notificationPanel.contains(event.target)&&!$('notifications').contains(event.target))closeNotifications()});
bind('login-form',async(d,f)=>{const session=await api('/auth/login',{method:'POST',body:d});state.token=session.token;state.role=session.role;const me=await api('/auth/me');state.userId=me.userId;state.tenantId=me.tenantId;$('company-name').textContent=d.tenantSlug;sessionStorage.setItem('eb-tenant-label',d.tenantSlug);f.reset();state.contacts=await api('/contacts');state.team=canEdit()?await api('/team'):[];document.querySelectorAll('[data-admin]').forEach(n=>n.hidden=!canEdit());await choose('overview');await refreshNotifications();document.body.dataset.authReady='true';$('login').hidden=true;$('app').hidden=false});
$('logout').onclick=()=>execute(async()=>{if(builder.hasUnsavedChanges()&&!confirm('هناك تعديلات بوت غير محفوظة. تسجيل الخروج سيفقدها. هل تريد المتابعة؟'))return;await api('/auth/logout',{method:'POST'}).catch(()=>{});sessionStorage.removeItem('eb-tenant-label');state.token='';state.userId='';state.tenantId='';state.botId=null;state.botName='';delete document.body.dataset.authReady;state.contacts=[];state.templateCatalog=[];state.team=[];ctx.commerce.reset();whatsappSignup.reset();advanced.reset();workspace.reset();extensions.reset();builder.reset();insights.reset();for(const id of ['dashboard-metrics','dashboard-ready','inbox-list','thread-context','lead-list','catalog-items','faq-list','team-list','team-invites','template-list','template-parameters','trigger-list','media-list','campaign-list','integration-list','key-list','usage-summary','runtime-jobs'])$(id).replaceChildren();document.querySelectorAll('form').forEach(f=>f.reset());$('notification-list').replaceChildren();$('notification-list').hidden=true;$('app').hidden=true;$('login').hidden=false;notify('')});
document.querySelectorAll('[data-page]').forEach(n=>n.onclick=()=>choose(n.dataset.page));document.querySelectorAll('[data-goto]').forEach(n=>n.onclick=()=>choose(n.dataset.goto));
initVesselWorkspace();
initVesselPages();
// Restore a valid same-origin server session without persisting bearer tokens in web storage.
void (async()=>{
  try{
    const me=await api('/auth/me');
    if(state.token)return;
    state.token='cookie-session';state.role=me.role;state.userId=me.userId;state.tenantId=me.tenantId;
    $('company-name').textContent=sessionStorage.getItem('eb-tenant-label')||'مساحة شركتك';
    state.contacts=await api('/contacts');state.team=canEdit()?await api('/team'):[];
    document.querySelectorAll('[data-admin]').forEach(n=>n.hidden=!canEdit());
    const requestedBot=/^#bot\/([a-f0-9-]{36})$/.exec(location.hash)?.[1];
    if(requestedBot){const available=await api('/bots');const selected=available.find(b=>b.id===requestedBot);if(selected){state.botId=selected.id;state.botName=selected.name}}
    await choose(state.botId?'flow-builder':'overview');await refreshNotifications();document.body.dataset.authReady='true';
    $('login').hidden=true;$('app').hidden=false;
  }catch{
    if(state.token==='cookie-session'){state.token='';$('app').hidden=true;$('login').hidden=false}
  }
})();
setInterval(()=>{if(state.token&&!document.hidden)refreshNotifications().catch(()=>{})},20000);
