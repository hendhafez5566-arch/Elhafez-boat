import {mountBotSetup} from './bot-setup.js';
/** Independent bots backed by tenant-authorized endpoints. No provider connection is implied. */
export function initBotManager({state,api,execute,notify,el,button,canEdit},openBuilder,canStart=()=>true){
 const page=el('section',undefined,'page');page.id='bots';page.hidden=true;
 document.getElementById('flow-builder').before(page);
 const title=el('h2','بوتات شركتك'),intro=el('p','أنشئ مساعدًا مستقلًا لكل تجربة. موارد الشركة مشتركة، ومسودة كل بوت وإصداراته مستقلة.');
 const form=el('form',undefined,'bot-create-form');
 const label=el('label','اسم البوت'),name=el('input');name.name='name';name.required=true;name.maxLength=100;name.placeholder='مثال: مساعد خدمة العملاء';label.append(name);
 const template=el('select');template.name='templateId';const templateLabel=el('label','كيف تحب تبدأ؟');templateLabel.append(template);
 const preview=el('details'),previewTitle=el('summary','معاينة القالب قبل الإنشاء'),previewBody=el('div');preview.append(previewTitle,previewBody);let templates=[];
 template.onchange=()=>{previewBody.replaceChildren();const selected=templates.find(t=>t.id===template.value);if(selected){previewBody.append(el('p',selected.description));for(const n of selected.definition.nodes){if(n.text)previewBody.append(el('p',n.text));if(n.choices)previewBody.append(el('p',n.choices.map(c=>c.title).join(' / ')))}}};
 const submit=el('button','إنشاء بوت','primary');submit.type='submit';form.append(label,templateLabel,submit,preview);
 const search=el('input');search.type='search';search.placeholder='ابحث باسم البوت';search.setAttribute('aria-label','البحث في البوتات');
 const status=el('p');status.setAttribute('role','status');const list=el('div',undefined,'bot-grid');
 const setup=mountBotSetup({host:page,api,el,button,notify,openBuilder,canStart});
 const create=button('إنشاء بوت خطوة بخطوة',()=>setup.start(),'primary');
 const gallery=el('section',undefined,'template-gallery'),gallerySearch=el('input'),galleryList=el('div',undefined,'template-gallery-grid');gallerySearch.type='search';gallerySearch.placeholder='ابحث عن قالب مناسب';gallerySearch.setAttribute('aria-label','البحث في قوالب البوت');gallery.append(el('h3','اختر نقطة بداية'),gallerySearch,galleryList);
 function renderGallery(){galleryList.replaceChildren();const q=gallerySearch.value.trim();for(const t of templates.filter(t=>(t.name+' '+t.description).includes(q))){const card=el('article',undefined,'card template-card');card.dataset.templateId=t.id;const preview=el('details');preview.append(el('summary','معاينة المحادثة'));for(const n of t.definition.nodes){if(n.text)preview.append(el('p',n.text));if(n.choices)preview.append(el('p',n.choices.map(c=>c.title).join(' / ')))}card.append(el('h4',t.name),el('p',t.description),preview);if(canEdit())card.append(button('استخدم هذا القالب',()=>setup.start(t.id),'primary'));galleryList.append(card)}if(!galleryList.children.length)galleryList.append(el('p','لا توجد قوالب مطابقة. جرّب كلمة أخرى.'));}
 gallerySearch.oninput=renderGallery;
 const quick=el('details',undefined,'bot-quick-create');quick.append(el('summary','إنشاء سريع من قالب جاهز'),form);
 page.append(title,intro,create,gallery,quick,search,status,list);let bots=[];
 function render(){
  list.replaceChildren();const filtered=bots.filter(b=>b.name.includes(search.value.trim()));
  status.textContent=!bots.length?'لا توجد بوتات بعد. ابدأ باسم مناسب ثم أضف أول رسالة.':!filtered.length?'لا توجد نتائج مطابقة.':`${filtered.length} بوت — الإصدارات المنشورة لا تعني اتصال قناة حقيقية`;
  for(const bot of filtered){
   const card=el('article',undefined,'card bot-card');card.dataset.botId=bot.id;
   card.append(el('h3',bot.name),el('p',bot.archivedAt?'مؤرشف':bot.publishedVersion?'إصدار منشور '+bot.publishedVersion:'مسودة'),el('p',bot.routes?.length?'قنوات موجّهة: '+bot.routes.map(r=>r.channel).join('، '):bot.legacyDefault?'البوت الأساسي — يحافظ على القنوات والسجل السابق':'مستقل — لم يُربط بقناة بعد'));
   if(bot.updatedAt)card.append(el('small','آخر تعديل: '+new Date(bot.updatedAt).toLocaleString('ar-EG')));
   if(canEdit())card.append(el('p','أنشئ بواسطة: '+(bot.createdBy?(state.team?.find(m=>m.id===bot.createdBy)?.email||'عضو في الشركة'):'ترحيل البوت الأساسي')));
   const actions=el('div',undefined,'bot-card-actions');
   actions.append(button(canEdit()&&!bot.archivedAt?'فتح الأتمتة':'عرض المحادثة',async()=>{await openBuilder(bot)}));
   actions.append(button('النشاط وجمع البيانات',async()=>{
    const data=await api('/bots/'+bot.id+'/insights'),panel=el('section',undefined,'bot-insights');
    panel.append(el('h4','نشاط هذا البوت'),el('p',`${data.sessions} جلسة محفوظة • ${data.humanSessions} لدى الموظفين • ${data.capturedSessions} تحتوي إجابات`),el('p','هذه إحصاءات الجلسات المحفوظة، وليست عدد أشخاص فريدين أو إثبات تسليم رسائل.'));
    if(data.lastActivityAt)panel.append(el('p','آخر نشاط: '+new Date(data.lastActivityAt).toLocaleString('ar-EG')));
    for(const f of data.fields)panel.append(el('p',f.field+' — '+f.sessions+' جلسة'));
    if(!data.fields.length)panel.append(el('p','لم تُجمع إجابات من عملاء بعد. تجربة المحادثة لا تنشئ بيانات عملاء.'));
    panel.append(button('إغلاق',()=>panel.remove()));card.querySelector('.bot-insights')?.remove();card.append(panel);
   }));
   if(canEdit()&&bot.archivedAt)actions.append(button('استعادة البوت',async()=>{await api('/bots/'+bot.id,{method:'PATCH',body:{archive:false}});await load();notify('تمت استعادة البوت دون تغيير المسودة أو الإصدارات')}));
   if(canEdit()&&!bot.archivedAt){
    actions.append(button('توجيه القنوات',async()=>{
     const routes=await api('/bots/'+bot.id+'/routes');
     const panel=el('section',undefined,'bot-routing');panel.append(el('h4','قنوات هذا البوت'),el('p','التوجيه للمحادثات الجديدة فقط؛ الجلسات السابقة تظل على بوتها. لا يتم تسجيل الدخول إلى أي مزود.'));
     for(const route of routes){const row=el('div');row.append(el('span',route.channel),button('إزالة التوجيه',async()=>{if(!confirm('إزالة التوجيه للمحادثات الجديدة؟'))return;await api('/bots/'+bot.id+'/routes',{method:'DELETE',body:route});panel.remove();await load();notify('تمت إزالة التوجيه؛ الجلسات الحالية محفوظة')}));panel.append(row)}
     if(!routes.length)panel.append(el('p','لا توجد قنوات موجهة لهذا البوت.'));
     const select=el('select');select.setAttribute('aria-label','القناة المتاحة للتوجيه');
     const widget=await api('/widget/settings');
     const accounts=await api('/whatsapp/signup/accounts');
     const social=await api('/channels/accounts');
     const available=[...(widget.enabled?[{channel:'WEBSITE',accountId:null,label:'شات الموقع المفعّل'}]:[]),...accounts.filter(a=>a.status==='CONNECTED'&&a.authorization==='VERIFIED'&&a.subscriptionVerifiedAt&&(!a.expiresAt||new Date(a.expiresAt).getTime()>Date.now())).map(a=>({channel:'WHATSAPP',accountId:a.id,label:'واتساب — '+(a.displayPhone||a.id)})),...social.filter(a=>a.enabled).map(a=>({channel:a.channel,accountId:a.id,label:a.channel}))];
     for(const [i,a] of available.entries()){const option=el('option',a.label);option.value=String(i);select.append(option)}
     if(available.length)panel.append(select,button('توجيه إلى هذا البوت',async()=>{await api('/bots/'+bot.id+'/routes',{method:'POST',body:available[Number(select.value)]});panel.remove();await load();notify('تم حفظ توجيه القناة للمحادثات الجديدة')}));
     else panel.append(el('p','فعّل شات الموقع أو أضف حسابًا رسميًا من القنوات أولًا. لا يوجد اتصال وهمي.'));
     panel.append(button('إغلاق',()=>panel.remove()));card.querySelector('.bot-routing')?.remove();card.append(panel);
    }));
    actions.append(button('كلمات بدء المحادثة',async()=>{
     const [triggers,cfg]=await Promise.all([api('/bots/'+bot.id+'/triggers'),api('/bots/'+bot.id+'/flows')]);
     const panel=el('section',undefined,'bot-triggers');panel.append(el('h4','لما العميل يكتب…'));
     for(const t of triggers)panel.append(el('p',t.kind==='FIRST_MESSAGE'?'أول رسالة':t.phrase),button('حذف القاعدة',async()=>{await api('/bots/'+bot.id+'/triggers/'+t.id,{method:'DELETE'});panel.remove();notify('تم حذف قاعدة التشغيل')}));
     if(cfg.published){
      const form=el('form'),phrase=el('input'),target=el('select'),kind=el('select'),match=el('select');phrase.required=true;phrase.maxLength=80;
      for(const [value,text] of [['KEYWORD','عندما يكتب العميل كلمة'],['FIRST_MESSAGE','عند أول رسالة في المحادثة']]){const o=el('option',text);o.value=value;kind.append(o)}
      for(const [value,text] of [['EXACT','نفس الكلمة بالضبط'],['CONTAINS','الرسالة تحتوي على الكلمة']]){const o=el('option',text);o.value=value;match.append(o)}
      kind.onchange=()=>{phrase.required=kind.value==='KEYWORD';phraseLabel.hidden=kind.value==='FIRST_MESSAGE';match.hidden=kind.value==='FIRST_MESSAGE'};kind.setAttribute('aria-label','متى تبدأ المحادثة');match.setAttribute('aria-label','طريقة مطابقة الكلمة');
      const phraseLabel=el('label','الكلمة التي يكتبها العميل');phraseLabel.append(phrase);
      const targetLabel=el('label','ابدأ من');targetLabel.append(target);
      for(const n of cfg.published.definition.nodes){const option=el('option',n.text?.slice(0,60)||(n.type==='START'?'بداية المحادثة':n.id));option.value=n.id;target.append(option)}
      const save=el('button','حفظ قاعدة التشغيل','primary');save.type='submit';form.append(kind,phraseLabel,match,targetLabel,save);
      form.onsubmit=e=>{e.preventDefault();execute(async()=>{save.disabled=true;try{await api('/bots/'+bot.id+'/triggers',{method:'POST',body:{kind:kind.value,phrase:kind.value==='FIRST_MESSAGE'?'':phrase.value,matchMode:match.value,targetNode:target.value,priority:0}});panel.remove();notify('تم حفظ القاعدة لهذا البوت فقط')}finally{save.disabled=false}})};panel.append(form);
     }else panel.append(el('p','انشر مسودة صالحة أولًا لتحديد نقطة بدء ثابتة.'));
     panel.append(button('إغلاق',()=>panel.remove()));card.querySelector('.bot-triggers')?.remove();card.append(panel);
    }));
    actions.append(button('تغيير الاسم',async()=>{const next=prompt('اسم البوت',bot.name);if(next===null)return;await api('/bots/'+bot.id,{method:'PATCH',body:{name:next}});await load()}));
    if(!bot.legacyDefault)actions.append(button('أرشفة',async()=>{if(!confirm('أرشفة البوت؟ تظل المسودة والإصدارات محفوظة.'))return;await api('/bots/'+bot.id,{method:'PATCH',body:{archive:true}});await load()}));
   }
   card.append(actions);list.append(card);
  }
 }
 search.oninput=render;
 form.onsubmit=e=>{e.preventDefault();if(!canStart()){notify('احفظ تعديلات البوت الحالي أولًا.','error');return}execute(async()=>{submit.disabled=true;try{const bot=await api('/bots',{method:'POST',body:{name:name.value,templateId:template.value||'blank'}});name.value='';await openBuilder(bot);notify('تم إنشاء البوت كمسودة مستقلة. أضف رسالة ثم جرّب المحادثة.')}finally{submit.disabled=false}})};
 async function load(){form.hidden=!canEdit();quick.hidden=!canEdit();create.hidden=!canEdit();status.textContent='جارٍ تحميل البوتات…';try{[bots,templates]=state.demo?[[],[]]:await Promise.all([api('/bots'),api('/bots/templates')]);const selected=template.value;template.replaceChildren();for(const t of templates){const option=el('option',t.name);option.value=t.id;template.append(option)}if(selected)template.value=selected;template.onchange();setup.setTemplates(templates);renderGallery();render()}catch(error){list.replaceChildren();status.textContent='تعذر تحميل البوتات. حاول مجددًا.';list.append(button('إعادة المحاولة',load));throw error}}
 return {load};
}
