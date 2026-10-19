/** Independent bots backed by tenant-authorized endpoints. No provider connection is implied. */
export function initBotManager({state,api,execute,notify,el,button,canEdit},openBuilder){
 const page=el('section',undefined,'page');page.id='bots';page.hidden=true;
 document.getElementById('flow-builder').before(page);
 const title=el('h2','إدارة البوتات'),intro=el('p','أنشئ مساعدًا مستقلًا لكل تجربة. موارد الشركة مشتركة، ومسودة كل بوت وإصداراته مستقلة.');
 const form=el('form',undefined,'bot-create-form');
 const label=el('label','اسم البوت'),name=el('input');name.name='name';name.required=true;name.maxLength=100;name.placeholder='مثال: مساعد خدمة العملاء';label.append(name);
 const template=el('select');template.name='templateId';const templateLabel=el('label','كيف تحب تبدأ؟');templateLabel.append(template);
 const preview=el('details'),previewTitle=el('summary','معاينة القالب قبل الإنشاء'),previewBody=el('div');preview.append(previewTitle,previewBody);let templates=[];
 template.onchange=()=>{previewBody.replaceChildren();const selected=templates.find(t=>t.id===template.value);if(selected){previewBody.append(el('p',selected.description));for(const n of selected.definition.nodes){if(n.text)previewBody.append(el('p',n.text));if(n.choices)previewBody.append(el('p',n.choices.map(c=>c.title).join(' / ')))}}};
 const submit=el('button','إنشاء بوت','primary');submit.type='submit';form.append(label,templateLabel,submit,preview);
 const search=el('input');search.type='search';search.placeholder='ابحث باسم البوت';search.setAttribute('aria-label','البحث في البوتات');
 const status=el('p');status.setAttribute('role','status');const list=el('div',undefined,'bot-grid');
 page.append(title,intro,form,search,status,list);let bots=[];
 function render(){
  list.replaceChildren();const filtered=bots.filter(b=>b.name.includes(search.value.trim()));
  status.textContent=!bots.length?'لا توجد بوتات بعد. ابدأ باسم مناسب ثم أضف أول رسالة.':!filtered.length?'لا توجد نتائج مطابقة.':`${filtered.length} بوت — الإصدارات المنشورة لا تعني اتصال قناة حقيقية`;
  for(const bot of filtered){
   const card=el('article',undefined,'card bot-card');card.dataset.botId=bot.id;
   card.append(el('h3',bot.name),el('p',bot.archivedAt?'مؤرشف':bot.publishedVersion?'إصدار منشور '+bot.publishedVersion:'مسودة'),el('p',bot.legacyDefault?'البوت الأساسي — يحافظ على القنوات والسجل السابق':'مستقل — لم يُربط بقناة بعد'));
   const actions=el('div',undefined,'bot-card-actions');
   actions.append(button(canEdit()&&!bot.archivedAt?'فتح الأتمتة':'عرض المحادثة',async()=>{await openBuilder(bot)}));
   if(canEdit()&&!bot.archivedAt){
    actions.append(button('توجيه القنوات',async()=>{
     const routes=await api('/bots/'+bot.id+'/routes');
     const panel=el('section',undefined,'bot-routing');panel.append(el('h4','قنوات هذا البوت'),el('p','التوجيه للمحادثات الجديدة فقط؛ الجلسات السابقة تظل على بوتها. لا يتم تسجيل الدخول إلى أي مزود.'));
     for(const route of routes){const row=el('div');row.append(el('span',route.channel),button('إزالة التوجيه',async()=>{if(!confirm('إزالة التوجيه للمحادثات الجديدة؟'))return;await api('/bots/'+bot.id+'/routes',{method:'DELETE',body:route});panel.remove();notify('تمت إزالة التوجيه؛ الجلسات الحالية محفوظة')}));panel.append(row)}
     if(!routes.length)panel.append(el('p','لا توجد قنوات موجهة لهذا البوت.'));
     const select=el('select');select.setAttribute('aria-label','القناة المتاحة للتوجيه');
     const widget=await api('/widget/settings');
     const accounts=await api('/whatsapp/signup/accounts');
     const social=await api('/channels/accounts');
     const available=[...(widget.enabled?[{channel:'WEBSITE',accountId:null,label:'شات الموقع المفعّل'}]:[]),...accounts.filter(a=>a.status==='CONNECTED').map(a=>({channel:'WHATSAPP',accountId:a.id,label:'واتساب — '+(a.displayPhone||a.id)})),...social.filter(a=>a.enabled).map(a=>({channel:a.channel,accountId:a.id,label:a.channel}))];
     for(const [i,a] of available.entries()){const option=el('option',a.label);option.value=String(i);select.append(option)}
     if(available.length)panel.append(select,button('توجيه إلى هذا البوت',async()=>{await api('/bots/'+bot.id+'/routes',{method:'POST',body:available[Number(select.value)]});panel.remove();notify('تم حفظ توجيه القناة للمحادثات الجديدة')}));
     else panel.append(el('p','فعّل شات الموقع أو أضف حسابًا رسميًا من القنوات أولًا. لا يوجد اتصال وهمي.'));
     panel.append(button('إغلاق',()=>panel.remove()));card.querySelector('.bot-routing')?.remove();card.append(panel);
    }));
    actions.append(button('كلمات بدء المحادثة',async()=>{
     const [triggers,cfg]=await Promise.all([api('/bots/'+bot.id+'/triggers'),api('/bots/'+bot.id+'/flows')]);
     const panel=el('section',undefined,'bot-triggers');panel.append(el('h4','لما العميل يكتب…'));
     for(const t of triggers)panel.append(el('p',t.kind==='FIRST_MESSAGE'?'أول رسالة':t.phrase),button('حذف القاعدة',async()=>{await api('/bots/'+bot.id+'/triggers/'+t.id,{method:'DELETE'});panel.remove();notify('تم حذف قاعدة التشغيل')}));
     if(cfg.published){
      const form=el('form'),phrase=el('input'),target=el('select');phrase.required=true;phrase.maxLength=80;
      const phraseLabel=el('label','الكلمة التي يكتبها العميل');phraseLabel.append(phrase);
      const targetLabel=el('label','ابدأ من');targetLabel.append(target);
      for(const n of cfg.published.definition.nodes){const option=el('option',n.text?.slice(0,60)||(n.type==='START'?'بداية المحادثة':n.id));option.value=n.id;target.append(option)}
      const save=el('button','حفظ قاعدة التشغيل','primary');save.type='submit';form.append(phraseLabel,targetLabel,save);
      form.onsubmit=e=>{e.preventDefault();execute(async()=>{save.disabled=true;try{await api('/bots/'+bot.id+'/triggers',{method:'POST',body:{kind:'KEYWORD',phrase:phrase.value,matchMode:'EXACT',targetNode:target.value,priority:0}});panel.remove();notify('تم حفظ القاعدة لهذا البوت فقط')}finally{save.disabled=false}})};panel.append(form);
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
 form.onsubmit=e=>{e.preventDefault();execute(async()=>{submit.disabled=true;try{const bot=await api('/bots',{method:'POST',body:{name:name.value,templateId:template.value||'blank'}});name.value='';await openBuilder(bot);notify('تم إنشاء البوت كمسودة مستقلة. أضف رسالة ثم جرّب المحادثة.')}finally{submit.disabled=false}})};
 async function load(){form.hidden=!canEdit();status.textContent='جارٍ تحميل البوتات…';try{[bots,templates]=state.demo?[[],[]]:await Promise.all([api('/bots'),api('/bots/templates')]);const selected=template.value;template.replaceChildren();for(const t of templates){const option=el('option',t.name);option.value=t.id;template.append(option)}if(selected)template.value=selected;template.onchange();render()}catch(error){list.replaceChildren();status.textContent='تعذر تحميل البوتات. حاول مجددًا.';list.append(button('إعادة المحاولة',load));throw error}}
 return {load};
}
