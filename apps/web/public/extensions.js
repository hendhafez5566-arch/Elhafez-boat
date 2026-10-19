import {emptyState} from './ui-states.js';
export function initExtensions(ctx){
 const {state,api,$,el,button,card,bind,notify,execute}=ctx;let widgetKey='',campaignTemplates=[],stepIndex=0;
 async function ai(){const r=await api('/ai/settings'),f=$('ai-form');f.elements.enabled.value=String(r.enabled);f.elements.instructions.value=r.instructions;f.elements.monthlyLimit.value=r.monthlyLimit;$('ai-provider-status').textContent=r.providerConfigured?'المزود مضبوط في الخادم؛ الاتصال الفعلي يحتاج تحققًا':'بدون مزود خارجي — إجابات مطابقة معتمدة وتحويل آمن'}
 bind('agent-preview-form',async d=>{
  const answer=await api('/ai/agent/preview',{method:'POST',body:{question:d.question}});
  const host=$('agent-preview-result');host.replaceChildren();
  const intents={CLARIFY:'طلب توضيح',HANDOFF:'تحويل لموظف',ANSWER:'إجابة معتمدة',UNKNOWN:'غير محدد'};
   const actions={ASK_CLARIFICATION:'اسأل العميل للتوضيح',HANDOFF:'سلّم المحادثة لموظف',ANSWER:'اعرض الإجابة المعتمدة'};
   host.append(el('h4','الرد المقترح'),el('p',answer.message),el('p','المسار: '+(intents[answer.intent]||'يتطلب مراجعة')+' • المراجع: '+(answer.sourceIds.length?'متاحة للمشغل':'لا توجد')));
  host.append(el('p','الخطوات المتاحة: '+answer.actions.map(a=>actions[a]||'إجراء متخصص').join(' ← ')));
   const technical=el('details');technical.append(el('summary','التفاصيل التقنية للمشغل'),el('code',answer.intent+' • '+answer.actions.join(', ')));host.append(technical);
  if(answer.needsStaff)host.append(el('p','مطلوب تدخل موظف أو توضيح إضافي.'));
  notify('معاينة محلية، بدون اتصال خارجي أو إرسال');
 });
 bind('ai-form',async d=>{await api('/ai/settings',{method:'PUT',body:{enabled:d.enabled==='true',instructions:d.instructions,monthlyLimit:Number(d.monthlyLimit)}});notify('تم حفظ إعدادات المساعد')});
 async function triggers(){const host=$('trigger-list');host.replaceChildren();const [rows,cfg]=await Promise.all([api('/triggers'),api('/flows')]);const select=$('trigger-target');select.replaceChildren();const names={START:'بداية',TEXT:'رسالة',BUTTONS:'أزرار',LIST:'قائمة',INPUT:'جمع بيانات',QUESTION:'سؤال',CONDITION:'شرط',HANDOFF:'موظف',CATALOG:'كتالوج',END:'نهاية'};for(const n of cfg.published?.definition?.nodes||[]){const o=el('option',(n.text||n.caption||names[n.type]||'خطوة').slice(0,40)+' — '+(names[n.type]||'خطوة'));o.value=n.id;select.append(o)}if(!rows.length)emptyState(host,'لا توجد قواعد تشغيل','انشر مسارًا ثم أضف أول قاعدة.');for(const r of rows){const c=card(r.kind==='FIRST_MESSAGE'?'أول محادثة':r.phrase,r.match_mode+' → '+r.target_node);c.append(button('حذف القاعدة',async()=>{await api('/triggers/'+r.id,{method:'DELETE'});await triggers()},'danger'));host.append(c)}}
 const triggerForm=$('trigger-form'),eventType=triggerForm.elements.kind;
 const phrase=triggerForm.elements.phrase,match=triggerForm.querySelector('[name="match_mode"],[name="matchMode"]');
 const syncTrigger=()=>{const keyword=eventType.value==='KEYWORD';if(phrase){phrase.closest('label').hidden=!keyword;phrase.required=keyword;if(!keyword){phrase.value='';phrase.setCustomValidity('')}}if(match)match.closest('label').hidden=!keyword;notify('')};
 eventType.addEventListener('change',syncTrigger);syncTrigger();
 bind('trigger-form',async(d,f)=>{if(d.kind==='KEYWORD'&&!String(d.phrase||'').trim()){f.elements.phrase.focus();throw new Error('اكتب الكلمة أو العبارة المطلوبة لتشغيل القاعدة')}await api('/triggers',{method:'POST',body:{...d,priority:Number(d.priority)}});f.reset();await triggers()});
 async function website(){const r=await api('/widget/settings'),f=$('widget-form');widgetKey=r.widgetKey;f.elements.enabled.value=String(r.enabled);f.elements.title.value=r.title;f.elements.origins.value=r.origins.join('\n');$('widget-code').value='<script src="'+location.origin+'/widget.js" data-key="'+widgetKey+'" defer></script>'}
 bind('widget-form',async d=>{await api('/widget/settings',{method:'PUT',body:{enabled:d.enabled==='true',title:d.title,origins:d.origins.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)}});await website();notify('تم حفظ إعدادات شات الموقع')});$('widget-copy').onclick=()=>execute(async()=>{await navigator.clipboard.writeText($('widget-code').value);notify('تم نسخ كود الموقع')});
 async function media(){const host=$('media-list');host.replaceChildren();const rows=await api('/media');if(!rows.length)emptyState(host,'مكتبة الوسائط فارغة','ارفع ملفًا لاستخدامه في البوت أو القوالب.');for(const m of rows){const c=card(m.name,m.mime+' • '+m.scan_status+' • '+(m.bytes/1024).toFixed(0)+' KB');if(m.url){const link=el('a','فتح الوسائط');link.href=m.url;link.target='_blank';link.rel='noopener noreferrer';c.append(link,button('نسخ رابط الاستخدام',async()=>{await navigator.clipboard.writeText(m.url);notify('استخدم الرابط في عقدة الوسائط أو رأس القالب')}))}else c.append(el('p','الرابط غير متاح قبل اجتياز الفحص وضبط MEDIA_PUBLIC_ORIGIN'));c.append(button('حذف',async()=>{if(confirm('حذف الوسائط؟ يمنع الحذف إذا كانت مستخدمة في إصدار منشور.')){await api('/media/'+m.id,{method:'DELETE'});await media()}},'danger'));host.append(c)}}
 bind('media-form',async(_,f)=>{const uploadSession=state.token;const file=f.elements.file.files[0];if(!file)return;if(file.size>5242880)throw new Error('الحد الأقصى 5 MiB');const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('تعذر قراءة الملف'));reader.readAsDataURL(file)});if(state.token!==uploadSession)throw new Error('انتهت جلسة الرفع السابقة');await api('/media',{method:'POST',body:{name:file.name,base64:encoded}});f.reset();await media()});
 function addStep(offset=0){
  const id=++stepIndex,field=el('fieldset',undefined,'sequence-step');field.dataset.step=String(id);field.append(el('legend','رسالة / متابعة'));
  const template=el('select');template.dataset.template='true';template.required=true;for(const t of campaignTemplates){const o=el('option',t.name+' • '+t.language);o.value=t.id;template.append(o)}const l=el('label','القالب المعتمد');l.append(template);const minutes=el('input');minutes.type='number';minutes.min='0';minutes.step='1440';minutes.value=offset;minutes.required=true;minutes.dataset.offset='true';const ml=el('label','الدقائق من بداية الحملة (1440 = يوم)');ml.append(minutes);const params=el('div');
  function render(){params.replaceChildren();const t=campaignTemplates.find(t=>t.id===template.value);if(!t)return;for(const p of t.components||[]){if(p.type==='BODY'||p.type==='HEADER'&&p.format==='TEXT'){const indexes=[...new Set([...String(p.text||'').matchAll(/{{(\d+)}}/g)].map(m=>Number(m[1])-1))].sort((a,b)=>a-b);for(const i of indexes){const label=el('label',(p.type==='BODY'?'قيمة الرسالة ':'قيمة الرأس ')+(i+1)),input=el('input');input.required=true;input.maxLength=1000;input.dataset.kind=p.type.toLowerCase();input.dataset.index=i;label.append(input);params.append(label)}}else if(p.type==='HEADER'&&['IMAGE','VIDEO','DOCUMENT'].includes(p.format)){const label=el('label','رابط رأس الوسائط HTTPS'),input=el('input');input.type='url';input.required=true;input.dataset.kind='mediaUrl';label.append(input);params.append(label)}else if(p.type==='BUTTONS')for(const [i,b] of p.buttons.entries()){if(b.type==='URL'&&b.url?.includes('{{')||b.type==='QUICK_REPLY'){const label=el('label','قيمة زر '+b.text+(b.type==='QUICK_REPLY'?' — اختياري':'')),input=el('input');input.required=b.type==='URL';input.maxLength=128;input.dataset.kind='buttons';input.dataset.index=i;label.append(input);params.append(label)}}}}
  const baseRender=render;const renderAll=()=>{baseRender();const t=campaignTemplates.find(t=>t.id===template.value);if(t)ctx.commerce.editor(params,t)};
  template.onchange=renderAll;field.append(l,ml,params,button('حذف الخطوة',()=>field.remove(),'danger'));$('campaign-steps').append(field);renderAll();
 }
 function installCampaignAssistant(){
  if($('campaign-quick-start'))return;
  const helper=el('div',undefined,'campaign-quick-start');helper.id='campaign-quick-start';
  helper.append(el('h3','حملتك في خطوة واحدة — جهّز مسودة فقط'),
   el('p','اختار هدف المتابعة. هنملأ الاسم والجمهور وميعاد البداية؛ لازم تختار قالب Meta معتمد وتراجع موافقات العملاء بنفسك. لن نرسل أي شيء تلقائيًا.'));
  const presets=[
   ['متابعة العملاء المهتمين','interested','متابعة العملاء المهتمين'],
   ['تذكير بطلب المساعدة','interested','متابعة طلبات خدمة العملاء'],
   ['إعلان جديد للموافقين فقط','','إعلان خدمات جديدة']
  ];
  for(const [title,tag,name] of presets){
   helper.append(button(title,()=>{
    const form=$('campaign-form');
    if(form.elements.name.value.trim()&&!confirm('استبدال بيانات نموذج الحملة غير المحفوظة؟'))return;
    form.elements.name.value=name;form.elements.tag.value=tag;form.elements.field.value='';form.elements.value.value='';
    const time=new Date(Date.now()+86400000);time.setMinutes(time.getMinutes()-time.getTimezoneOffset());
    form.elements.startAt.value=time.toISOString().slice(0,16);
    notify('اتجهزت المسودة في النموذج. اختار القالب المعتمد، احفظ، وبعد المراجعة قرر بدء الحملة بنفسك.');
   },'secondary'));
  }
  $('campaign-form').prepend(helper);
 }
 async function campaigns(){installCampaignAssistant();const host=$('campaign-list');host.replaceChildren();const [rows,t]=await Promise.all([api('/campaigns'),api('/whatsapp/templates')]);campaignTemplates=t;await ctx.commerce.load();if(!$('campaign-steps').children.length)addStep(0);if(!rows.length)host.append(el('p','لا توجد حملات. أضف قالبًا معتمدًا وموافقات العملاء قبل إنشاء الحملة.'));for(const r of rows){const c=card(r.name,r.status+' • إجمالي الخطوات للعملاء: '+r.total+' • أرسلت: '+r.sent+' • تخطيت: '+r.skipped+' • فشل: '+r.failed);if(r.status==='DRAFT')c.append(button('بدء الحملة',async()=>{if(!confirm('بدء الحملة للعملاء الموافقين المطابقين للشريحة؟'))return;const result=await api('/campaigns/'+r.id+'/launch',{method:'POST'});notify('تم تجهيز '+result.recipients+' عميل؛ الإرسال عبر الطابور');await campaigns()},'primary'));if(['DRAFT','ACTIVE'].includes(r.status))c.append(button('إلغاء الرسائل المتبقية',async()=>{await api('/campaigns/'+r.id+'/cancel',{method:'POST'});await campaigns()},'danger'));host.append(c)}}
 $('campaign-add-step').onclick=()=>{const all=[...$('campaign-steps').querySelectorAll('[data-offset]')];if(all.length>=10){notify('الحد الأقصى 10 خطوات','error');return}addStep(Number(all.at(-1)?.value||0)+1440)};
 bind('campaign-form',async(d,f)=>{const steps=[...$('campaign-steps').children].map(field=>{const parameters={body:[],header:[],buttons:{}};for(const input of field.querySelectorAll('[data-kind]')){if(input.dataset.kind==='mediaUrl')parameters.mediaUrl=input.value;else if(input.value)parameters[input.dataset.kind][input.dataset.index]=input.value}const d=Object.fromEntries([...field.querySelectorAll('[name]')].filter(n=>n.type!=='checkbox'||n.checked).map(n=>[n.name,n.value]));ctx.commerce.read(d,parameters);return {templateId:field.querySelector('[data-template]').value,offsetMinutes:Number(field.querySelector('[data-offset]').value),parameters}});await api('/campaigns',{method:'POST',body:{name:d.name,startAt:new Date(d.startAt).toISOString(),segment:{tag:d.tag,field:d.field,value:d.value},steps}});f.reset();$('campaign-steps').replaceChildren();await campaigns();notify('تم حفظ المسودة؛ راجعها قبل البدء')});
 async function integrations(){const host=$('integration-list');host.replaceChildren();for(const r of await api('/integrations')){const c=card(r.name,r.url+' • '+(r.enabled?'مفعّل':'متوقف')+' • '+(r.authMode||'NONE'));c.append(el('p','معرّف عقدة Webhook: '+r.id));if(r.authMode!=='NONE')c.append(button('استبدال سر التكامل',async()=>{const secret=prompt('السر الجديد — لن يظهر بعد حفظه');if(!secret)return;await api('/integrations/'+r.id,{method:'PATCH',body:{enabled:r.enabled,secret}});notify('تم تشفير السر الجديد وحفظه')}));c.append(button(r.enabled?'إيقاف':'تفعيل',async()=>{await api('/integrations/'+r.id,{method:'PATCH',body:{enabled:!r.enabled}});await integrations()}));host.append(c)}$('key-form').hidden=state.role!=='OWNER';if(state.role==='OWNER')await keys()}
 async function keys(){const host=$('key-list');host.replaceChildren();for(const k of await api('/access-keys')){const c=card(k.name,k.scopes.join(' • ')+' • '+(k.revoked_at?'ملغى':'فعال حتى '+new Date(k.expires_at).toLocaleDateString('ar-EG')));if(!k.revoked_at)c.append(button('إلغاء المفتاح',async()=>{await api('/access-keys/'+k.id,{method:'DELETE'});await keys()},'danger'));host.append(c)}}
 bind('integration-form',async(d,f)=>{await api('/integrations',{method:'POST',body:d});f.reset();await integrations()});bind('key-form',async d=>{const r=await api('/access-keys',{method:'POST',body:{name:d.name,scopes:[d.scope]}});$('key-created').textContent=r.key;await keys();notify('المفتاح يظهر مرة واحدة؛ احفظه بأمان')});
 async function usage(){const host=$('usage-summary');host.replaceChildren();$('runtime-jobs').replaceChildren();const [u,jobs]=await Promise.all([api('/usage'),api('/runtime/jobs')]);for(const [label,value] of [['رسائل اليوم','المستخدم: '+u.inbound+' — الحد: '+u.daily_inbound],['قوالب اليوم','المستخدم: '+u.templates+' — الحد: '+u.daily_templates],['الوسائط MiB','المستخدم: '+(Number(u.stored_bytes)/1048576).toFixed(1)+' — الحد: '+(Number(u.media_bytes)/1048576).toFixed(1)]])host.append(card(label,value));for(const [kind,rows] of Object.entries(jobs)){const block=el('section');block.append(el('h3',{health:'نبض العامل',connectors:'مزامنة الموصلات',social:'رسائل القنوات',delays:'استكمال المحادثات',webhooks:'التكاملات',outbox:'رسائل واتساب'}[kind]));if(!rows.length)block.append(el('p','لا توجد سجلات.'));const statusName={PENDING:'قيد الانتظار',PROCESSING:'جارٍ الإرسال',SENT:'تم الإرسال',FAILED:'فشل الإرسال',UNCERTAIN:'مصير غير مؤكد — لا تكرر الإرسال',DONE:'مكتمل'};
    const errorName={'Provider rejected message':'رفض مزود واتساب الإرسال — افحص رمز الربط والصلاحيات','Delivery outcome unknown; reconcile before resend':'نتيجة التسليم غير مؤكدة — راجع Meta قبل أي إعادة','Provider rate limited':'حد الإرسال لدى المزود؛ انتظر'};
    const list=el('div');block.append(list);
    const statusSelect=el('select');statusSelect.setAttribute('aria-label','تصفية حالة '+kind);
    for(const [value,title] of [['ALL','كل الحالات'],['FAILED','فشل'],['PENDING','قيد الانتظار'],['UNCERTAIN','غير مؤكدة'],['SENT','تم الإرسال']]){
     const option=el('option',title);option.value=value;statusSelect.append(option)
    }
    if(kind==='outbox')block.insertBefore(statusSelect,list);
    const draw=()=>{
      list.replaceChildren();
      const subset=rows.filter(row=>kind!=='outbox'||statusSelect.value==='ALL'||row.status===statusSelect.value);
      if(!subset.length)list.append(el('p','لا توجد سجلات مطابقة للفلتر.','muted'));
      for(const row of subset){
       const id=String(row.id||row.conversation_id||''),error=String(row.error||row.last_error||row.last_error_code||'');
       const when=row.due_at||row.next_attempt_at||row.last_seen_at;
       const display=card(kind==='outbox'?'رسالة واتساب':kind==='health'?'حالة العامل':'عملية مسجلة',
        [statusName[row.status]||row.status,errorName[error]||error,when?new Date(when).toLocaleString('ar-EG'):null].filter(Boolean).join(' • '));
       const details=el('details');details.append(el('summary','تفاصيل تقنية'),el('code',id));display.append(details);list.append(display);
      }
    };
    statusSelect.onchange=draw;draw();$('runtime-jobs').append(block)}}
 return {load:page=>({triggers,website,media,campaigns,integrations,usage,'ai-settings':ai}[page])(),reset(){widgetKey='';campaignTemplates=[];$('key-created').textContent='';$('widget-code').value='';$('campaign-steps').replaceChildren();$('integration-form').reset()}};
}
