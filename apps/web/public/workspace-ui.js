import {emptyState,filterBar,statusChip} from './ui-states.js';
export function initWorkspace(ctx){
 const {state,api,$,el,button,card,bind,notify,canEdit,execute}=ctx;let threads=[],selected=null,templates=[],members=[];
 const options=(select,rows,label)=>{select.replaceChildren();for(const r of rows){const o=el('option',label(r));o.value=r.id;select.append(o)}};
 function renderThreads(){const host=$('inbox-list');host.replaceChildren();const q=$('inbox-search').value.trim().toLowerCase(),filter=$('inbox-filter').value;for(const t of threads.filter(t=>(t.customer_name+' '+(t.phone||'')).toLowerCase().includes(q)&&(filter==='ALL'||filter==='UNREAD'&&Number(t.unread_count)>0||filter==='MINE'&&t.assigned_user_id===state.userId||filter===t.status))){const b=button(t.customer_name,()=>thread(t),'thread'+(selected?.id===t.id?' active':''));b.append(el('small',t.channel+' • '+t.status+(t.unread_count?' • '+t.unread_count+' غير مقروءة':'')));host.append(b)}if(!host.children.length)emptyState(host,'لا توجد محادثات مطابقة','جرّب تعديل البحث أو الفلتر.')}
 async function inbox(){selected=null;$('thread-tools').hidden=true;$('thread-messages').replaceChildren();emptyState($('thread-messages'),'اختار محادثة من القائمة','ستظهر الرسائل والسجل والردود هنا، من غير أي إرسال قبل ما تختار محادثة.');$('thread-title').textContent='اختار محادثة';$('inbox-list').replaceChildren();threads=await api('/whatsapp/inbox');renderThreads()}
 async function thread(t){selected=t;renderThreads();$('thread-title').textContent=t.customer_name+' — '+t.channel;const context=$('thread-context');context.replaceChildren();if(t.custom_fields)for(const [k,v] of Object.entries(t.custom_fields))context.append(el('span',k+': '+String(v)+'  '));const host=$('thread-messages');host.replaceChildren();const messages=await api('/whatsapp/inbox/'+t.id+'/messages');if(selected?.id!==t.id)return;for(const m of messages){const b=el('div',undefined,'bubble '+(m.kind==='INBOUND'?'incoming':m.kind==='INTERNAL_NOTE'?'internal':'outgoing'));b.append(el('p',m.body),el('small',m.kind==='INTERNAL_NOTE'?'ملاحظة داخلية':m.message_source==='BUSINESS_APP'?'من تطبيق واتساب بيزنس':m.imported_history?'سجل سابق — لا يشغّل البوت':m.delivery_status||m.kind));host.append(b)}host.scrollTop=host.scrollHeight;t.unread_count=0;renderThreads();$('thread-tools').hidden=state.role==='VIEWER';$('thread-take').textContent=t.status==='HUMAN'?'تسليم للبوت':'استلام';$('reply-form').querySelector('button.primary').disabled=t.status!=='HUMAN';$('thread-assignee').hidden=!canEdit();$('thread-assign').hidden=!canEdit();options($('thread-assignee'),state.team.filter(m=>m.role!=='VIEWER'),m=>m.email);if(t.assigned_user_id)$('thread-assignee').value=t.assigned_user_id;await replies()}
 async function replies(){const rows=await api('/saved-replies');const s=$('reply-saved');s.replaceChildren();const empty=el('option','اختار ردًا محفوظًا');empty.value='';s.append(empty);const host=$('saved-reply-list');host.replaceChildren();for(const r of rows){const o=el('option',r.title);o.value=r.body;s.append(o);const c=card(r.title,r.body);if(canEdit())c.append(button('تعديل',async()=>{const title=prompt('عنوان الرد',r.title);if(!title)return;const body=prompt('نص الرد',r.body);if(!body)return;await api('/saved-replies/'+r.id,{method:'PUT',body:{title,body}});await replies()}),button('حذف',async()=>{await api('/saved-replies/'+r.id,{method:'DELETE'});await replies()},'danger'));host.append(c)}}
 async function changeStatus(status,assignedUserId){if(!selected)return;const id=selected.id;await api('/whatsapp/inbox/'+id+'/handoff',{method:'PATCH',body:{status,...(assignedUserId?{assignedUserId}:{})}});threads=await api('/whatsapp/inbox');const t=threads.find(t=>t.id===id);if(t)await thread(t);else await inbox()}
 $('inbox-refresh').onclick=()=>execute(inbox);$('inbox-search').oninput=renderThreads;$('inbox-filter').onchange=renderThreads;
 $('thread-take').onclick=()=>execute(()=>changeStatus(selected?.status==='HUMAN'?'OPEN':'HUMAN'));$('thread-close').onclick=()=>execute(()=>changeStatus('CLOSED'));$('thread-assign').onclick=()=>execute(()=>changeStatus('HUMAN',$('thread-assignee').value));
 $('thread-note').onclick=()=>execute(async()=>{if(!selected)return;const body=prompt('ملاحظة داخلية لا تُرسل للعميل');if(body){await api('/whatsapp/inbox/'+selected.id+'/notes',{method:'POST',body:{body}});await thread(selected)}});
 bind('reply-form',async(d,f)=>{if(!selected)return;const result=await api('/whatsapp/inbox/'+selected.id+'/reply',{method:'POST',body:d});f.reset();await thread(selected);notify(result.available?'الرد متاح للزائر في محادثة الموقع':'الرد في طابور واتساب — التسليم لم يُؤكد بعد')});
 $('reply-saved').onchange=()=>{$('reply-form').elements.body.value=$('reply-saved').value};$('reply-save').onclick=()=>execute(async()=>{const body=$('reply-form').elements.body.value.trim(),title=prompt('عنوان الرد المحفوظ');if(!body||!title)return;await api('/saved-replies',{method:'POST',body:{title,body}});await replies()});
 async function leads(){
  const host=$('lead-list');host.replaceChildren();
  let response=await api('/leads/page'),rows=response.items;let pageNumber=1,requestId=0,searchTimer;
  if(!rows.length){emptyState(host,'لا يوجد عملاء مهتمون حتى الآن','ستظهر هنا المتابعات الجديدة بعد نشر البوت.');return}
  const filter=el('select');filter.setAttribute('aria-label','تصفية العملاء حسب مرحلة المتابعة');
  for(const [value,title] of [['ALL','كل المراحل'],['READY_FOR_AGENT','جاهزون للموظف'],['INTERESTED','مهتمون'],['CONTACTED','تم التواصل'],['CLOSED','مغلقون']]){
   const option=el('option',title);option.value=value;filter.append(option);
  }
  const summary=el('p','أولوية العميل تقدير واضح من اهتمامه وحداثة المحادثة، وليست توقعًا آليًا للبيع.','muted');
  const search=el('input');search.placeholder='ابحث باسم العميل أو هاتفه أو الاحتياج';search.setAttribute('aria-label','بحث العملاء');
  const order=el('select');order.setAttribute('aria-label','ترتيب العملاء');
  for(const [value,title] of [['priority','الأعلى أولوية'],['recent','الأحدث'],['due','الأقرب متابعة']]){const o=el('option',title);o.value=value;order.append(o)}
  host.append(filterBar(search,filter,order,button('تحديث',()=>leads(),'secondary')),summary);
  const results=el('div',undefined,'cards');host.append(results);
  async function showTasks(container,lead){
   container.replaceChildren();const tasks=await api('/leads/'+lead.id+'/tasks');
   if(!tasks.length)emptyState(container,'لا توجد مهام متابعة','أضف موعدًا واضحًا للخطوة القادمة.');
   for(const task of tasks){
    const taskRow=el('div',undefined,'crm-task');
    const date=new Date(task.dueAt),overdue=task.status==='OPEN'&&date.getTime()<Date.now();
    taskRow.append(el('span',task.description+' — '+date.toLocaleString('ar-EG')+(overdue?' • متأخرة':'')));
    if(task.status==='OPEN'&&state.role!=='VIEWER')taskRow.append(button('تم التنفيذ',async()=>{
     await api('/leads/'+lead.id+'/tasks/'+task.id+'/complete',{method:'POST'});await showTasks(container,lead);notify('تم إتمام المتابعة');
    }));
    else taskRow.append(el('small',task.status==='DONE'?'تمت المتابعة':'قيد المتابعة'));
    container.append(taskRow);
   }
   if(state.role==='VIEWER')return;
   const form=el('form',undefined,'crm-followup-form');
   const description=el('input');description.placeholder='مهمة الموظف: اتصال، تأكيد التفاصيل، متابعة السعر...';description.maxLength=500;description.required=true;
   const due=el('input');due.type='datetime-local';due.required=true;const future=new Date(Date.now()+86400000);future.setMinutes(future.getMinutes()-future.getTimezoneOffset());due.value=future.toISOString().slice(0,16);
   const descriptionLabel=el('label');descriptionLabel.append(el('span','المتابعة المطلوبة'),description);
   const dateLabel=el('label');dateLabel.append(el('span','موعد المتابعة'),due);
   const submit=el('button','إضافة تذكير متابعة','primary');submit.type='submit';
   form.append(descriptionLabel,dateLabel,submit);
   form.onsubmit=e=>{e.preventDefault();execute(async()=>{
    if(!description.value.trim())throw new Error('اكتب مهمة المتابعة');
    submit.disabled=true;
    try{await api('/leads/'+lead.id+'/tasks',{method:'POST',body:{description:description.value.trim(),dueAt:new Date(due.value).toISOString()}});await showTasks(container,lead);notify('اتسجلت مهمة متابعة للموظفين داخل المنصة، بدون إرسال رسالة تلقائية');}
    finally{submit.disabled=false}
   })};
   container.append(form);
  }
  function render(){
   results.replaceChildren();
   const found=rows.filter(r=>(filter.value==='ALL'||r.stage===filter.value)&&
    (r.customer_name+' '+(r.phone||'')+' '+JSON.stringify(r.custom_fields||{})).toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
   found.sort((a,b)=>order.value==='recent'?new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime():
    order.value==='due'?(a.next_followup_at?new Date(a.next_followup_at).getTime():Infinity)-(b.next_followup_at?new Date(b.next_followup_at).getTime():Infinity):
    Number(b.priorityScore||0)-Number(a.priorityScore||0));
   for(const l of found){
    const friendly={customer_need:'الاحتياج',customer_name:'الاسم',customer_phone:'الهاتف',interest:'الاهتمام',customer_email:'البريد',customer_city:'المدينة'};
    const fields=Object.entries(l.custom_fields||{}).map(([k,v])=>{
      const title=friendly[k]||(k.startsWith('choice_')?'اختيار العميل':k.replace(/[_@-]/g,' '));
      return title+': '+String(v);
    }).join(' • ');
    const stageNames={READY_FOR_AGENT:'جاهز للموظف',INTERESTED:'مهتم',CONTACTED:'تم التواصل',CLOSED:'مغلق'};
    const c=el('article',undefined,'card crm-lead-card vessel-lead-card');
     const head=el('header',undefined,'vessel-lead-head');
     const avatar=el('span',(l.customer_name||'؟').trim().slice(0,1),'vessel-lead-avatar');
     const identity=el('div',undefined,'vessel-lead-identity');
     identity.append(el('strong',l.customer_name),el('p',[l.catalog_title,l.phone,fields].filter(Boolean).join(' • ')));
     head.append(avatar,identity,statusChip(stageNames[l.stage]||l.stage,l.stage==='CLOSED'?'neutral':l.stage==='READY_FOR_AGENT'?'success':'warning'));
     c.append(head);
    const badge=el('div','أولوية متابعة: '+Number(l.priorityScore||0)+'/100'+(l.open_tasks?' • مهام مفتوحة: '+l.open_tasks:''),'crm-lead-score');
    c.append(badge);
    if(l.next_followup_at)c.append(el('p','المتابعة القادمة: '+new Date(l.next_followup_at).toLocaleString('ar-EG'),'muted'));
    c.append(button('افتح المحادثة',async()=>{await ctx.choose('wa-inbox');const related=threads.find(t=>t.id===l.conversation_id);if(related)await thread(related);else notify('المحادثة غير متاحة ضمن قائمة الوارد الحالية.','error')},'primary'));
    c.append(button('ملف العميل',async()=>{
     const profile=await api('/leads/'+l.id+'/profile'),panel=el('section',undefined,'crm-profile');
     panel.append(el('h3',profile.full_name),el('p',profile.phone||'لا يوجد هاتف مسجل'),el('p',profile.do_not_contact?'العميل أوقف التواصل':'لم يوقف العميل التواصل'),el('p','القناة: '+profile.channel+(profile.bot_name?' • البوت: '+profile.bot_name:'')));
     for(const [field,value] of Object.entries(profile.custom_fields||{}))panel.append(el('p',(friendly[field]||field)+': '+String(value)));
     panel.append(el('h4','آخر نشاط في المحادثة'));
     for(const m of profile.messages){const row=el('article',undefined,'bubble '+(m.kind==='INTERNAL_NOTE'?'internal':m.kind==='INBOUND'?'incoming':'outgoing'));row.append(el('small',m.kind==='INTERNAL_NOTE'?'ملاحظة داخلية':m.kind==='INBOUND'?'العميل':'الفريق / البوت'),el('p',m.body),el('small',new Date(m.created_at).toLocaleString('ar-EG')));panel.append(row)}
     if(!profile.messages.length)panel.append(el('p','لا توجد رسائل محفوظة لهذه المحادثة.'));
     panel.append(button('إغلاق الملف',()=>panel.remove()));c.querySelector('.crm-profile')?.remove();c.append(panel);
    }));
    const more=el('details',undefined,'crm-lead-more');more.append(el('summary','إدارة العميل والمتابعة'));c.append(more);
    if(['OWNER','MANAGER'].includes(state.role)&&state.team?.length&&l.stage!=='CLOSED'){
     const staff=el('select');staff.setAttribute('aria-label','موظف المتابعة');
     const empty=el('option','تعيين موظف');empty.value='';staff.append(empty);
     for(const m of state.team.filter(member=>member.role!=='VIEWER')){const option=el('option',m.email);option.value=m.id;staff.append(option)}
     staff.value=l.assigned_user_id||'';
     more.append(staff,button('حفظ المسؤول',async()=>{if(!staff.value)throw new Error('اختار موظفًا');await api('/leads/'+l.id+'/assign',{method:'PATCH',body:{userId:staff.value}});await leads();notify('تم تحديد الموظف بدون إرسال رسالة للعميل')}));
    }
    if(state.role!=='VIEWER')for(const [stage,label] of [['READY_FOR_AGENT','جاهز للموظف'],['CONTACTED','تم التواصل'],['CLOSED','إغلاق']]){
     if(stage===l.stage)continue;
     more.append(button(label,async()=>{await api('/leads/'+l.id+'/stage',{method:'PATCH',body:{stage}});await leads()}));
    }
    const taskPane=el('div',undefined,'crm-tasks-panel');taskPane.hidden=true;
    more.append(button('مواعيد المتابعة',async()=>{taskPane.hidden=!taskPane.hidden;if(!taskPane.hidden)await showTasks(taskPane,l)},'secondary'),taskPane);
    results.append(c);
   }
   if(!results.children.length)emptyState(results,'لا توجد نتائج','جرّب تغيير الفلتر أو البحث.');
  }
  const pagination=el('div',undefined,'crm-pagination'),pageLabel=el('span');pageLabel.setAttribute('role','status');
  const previous=button('السابق',async()=>{pageNumber--;await fetchPage()}),next=button('التالي',async()=>{pageNumber++;await fetchPage()});
  pagination.append(previous,pageLabel,next,button('مسح الفلاتر',async()=>{search.value='';filter.value='ALL';order.value='priority';pageNumber=1;await fetchPage()}));host.append(pagination);
  function pageStatus(){previous.disabled=response.page<=1;next.disabled=response.page>=response.pages;pageLabel.textContent='صفحة '+response.page+' من '+response.pages+' — '+response.total+' عميل'}
  async function fetchPage(){const request=++requestId;pageLabel.textContent='جارٍ التحميل…';try{const result=await api('/leads/page?'+new URLSearchParams({page:String(pageNumber),search:search.value.trim(),stage:filter.value,order:order.value}));if(request!==requestId)return;response=result;rows=result.items;pageNumber=result.page;render();pageStatus()}catch(error){if(request!==requestId)return;pageLabel.textContent='تعذر تحميل النتائج. استخدم تحديث للمحاولة.';throw error}}
  filter.onchange=order.onchange=()=>{pageNumber=1;execute(fetchPage)};search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{pageNumber=1;execute(fetchPage)},250)};render();pageStatus();
 }
 $('leads-refresh').onclick=()=>execute(leads);
 async function connection(){const host=$('wa-connections');host.replaceChildren();const rows=await api('/whatsapp/connection');if(!rows.length)emptyState(host,'لا يوجد رقم متصل','يمكن لمالك الشركة إضافة اتصال عند الجاهزية.');for(const r of rows){const c=card(r.displayPhone||r.phoneNumberId,r.status==='CONNECTED'?'اعتماد محفوظ — يلزم فحص الاتصال':'مفصول محليًا');if(state.role==='OWNER'&&r.status==='CONNECTED')c.append(button('فحص الاتصال الآن',async()=>{const d=await api('/whatsapp/connection/'+r.id+'/diagnose',{method:'POST'});notify(d.verified?(d.subscribed?'تم التحقق من الرقم واشتراك التطبيق؛ وصول الرسائل يحتاج تجربة فعلية':d.appConfigured?'الرقم صحيح؛ اشتراك التطبيق غير مؤكد. راجع إعدادات Webhook في Meta':'الرقم صحيح؛ اضبط META_APP_ID على الخادم لفحص اشتراك التطبيق'):'الرقم مفصول')}),button('فصل الاتصال',async()=>{if(confirm('فصل الرقم محليًا وإيقاف استقبال وإرسال المنصة؟ هذا لا يحذف الرقم أو يلغي الاشتراك في Meta. يمكن إعادة ربطه بنفس الشركة. الرسائل المنتظرة ستُوقف؛ الرسالة الجاري إرسالها قد تصل ولا يمكن سحبها.')){await api('/whatsapp/connection/'+r.id,{method:'DELETE'});await connection()}},'danger'));host.append(c)}}
 bind('wa-form',async(d,f)=>{await api('/whatsapp/connection',{method:'POST',body:d});f.reset();await connection();notify('تم حفظ اتصال الرقم؛ تحقق من Webhook في Meta')});
 async function team(){const host=$('team-list'),invites=$('team-invites');host.replaceChildren();invites.replaceChildren();const [users,invitations]=await Promise.all([api('/team'),api('/team/invitations')]);members=users;state.team=users;for(const m of users){const titles={OWNER:'مالك الشركة',MANAGER:'مدير',AGENT:'موظف',VIEWER:'مشاهدة فقط'};const c=card(m.email,titles[m.role]||m.role);if(state.role==='OWNER'&&m.role!=='OWNER'){const select=el('select');options(select,[{id:'MANAGER'},{id:'AGENT'},{id:'VIEWER'}],x=>titles[x.id]||x.id);select.value=m.role;c.append(select,button('حفظ الدور',async()=>{await api('/team/members/'+m.id+'/role',{method:'PATCH',body:{role:select.value}});await team()}))}host.append(c)}for(const inv of invitations){const c=card(inv.email,inv.role+' • '+inv.status);if(inv.status==='PENDING')c.append(button('إلغاء الدعوة',async()=>{await api('/team/invitations/'+inv.id+'/revoke',{method:'POST'});await team()},'danger'));invites.append(c)}}
 bind('invite-form',async(d,f)=>{const r=await api('/team/invitations',{method:'POST',body:d});$('invite-result').textContent=location.origin+'/join.html#team.'+r.inviteToken;f.elements.email.value='';await team();notify('رابط الدعوة يظهر مرة واحدة. شاركه بأمان مع الموظف.')});
 function placeholders(text=''){return [...new Set([...text.matchAll(/{{(\d+)}}/g)].map(m=>Number(m[1])))].sort((a,b)=>a-b)}
 function parameterEditor(){
  const host=$('template-parameters');host.replaceChildren();
  const t=templates.find(x=>x.id===$('send-template').value);
  if(!t)return;
  const field=(container,title,name,required=false,maxLength=1000,type='text')=>{
    const label=el('label',title),input=el('input');input.name=name;input.required=required;input.maxLength=maxLength;input.type=type;
    if(type==='url')input.placeholder='https://example.com/media.jpg';
    label.append(input);container.append(label);
  };
  for(const p of t.components||[]){
    if(p.type==='BODY'||p.type==='HEADER'&&p.format==='TEXT'){
      for(const i of placeholders(p.text))field(host,(p.type==='BODY'?'قيمة الرسالة ':'قيمة الرأس ')+i,p.type.toLowerCase()+'_'+(i-1),true);
    }else if(p.type==='HEADER'&&['IMAGE','VIDEO','DOCUMENT'].includes(p.format)){
      field(host,'رابط الوسائط HTTPS','mediaUrl',true,2048,'url');
    }else if(p.type==='BUTTONS'){
      for(const [i,b] of (p.buttons||[]).entries()){
        if(b.type==='URL'&&b.url?.includes('{{')||b.type==='QUICK_REPLY')
          field(host,b.type==='URL'?'قيمة رابط '+b.text:'إجراء زر '+b.text+' (اختياري)',
            'button_'+i,b.type==='URL',b.type==='URL'?200:128);
      }
    }else if(p.type==='CAROUSEL'&&!p.cards?.some(c=>c.components?.some(h=>h.format==='PRODUCT'))){
      for(const [i,card] of (p.cards||[]).entries()){
        const pane=el('fieldset',undefined,'template-carousel-card');
        pane.append(el('legend','بطاقة '+(i+1)+' — حسب قالب Meta المعتمد'));
        const catalogSelect=el('select');const empty=el('option','ملء الصورة من الكتالوج المعتمد — اختياري');empty.value='';catalogSelect.append(empty);
        for(const item of state.templateCatalog||[]){const option=el('option',item.title);option.value=item.id;catalogSelect.append(option)}
        catalogSelect.onchange=()=>{const item=(state.templateCatalog||[]).find(x=>x.id===catalogSelect.value);if(!item)return;const media=pane.querySelector('[name="card_'+i+'_mediaUrl"]');if(media&&item.imageUrl)media.value=item.imageUrl;notify('تم اختيار صورة من الكتالوج؛ أدخل متغيرات القالب المعتمد وراجع النص قبل الإرسال')};pane.append(catalogSelect);

        for(const component of card.components||[]){
          if(component.type==='HEADER'&&['IMAGE','VIDEO'].includes(component.format)){
            field(pane,'رابط صورة/فيديو البطاقة HTTPS','card_'+i+'_mediaUrl',true,2048,'url');
          }else if(component.type==='BODY'){
            for(const n of placeholders(component.text))
              field(pane,'متغير نص البطاقة '+n,'card_'+i+'_body_'+(n-1),true);
          }else if(component.type==='BUTTONS'){
            for(const [j,b] of (component.buttons||[]).entries()){
              if(b.type==='URL'&&b.url?.includes('{{')||b.type==='QUICK_REPLY')
                field(pane,b.type==='URL'?'متغير رابط الزر '+(j+1):'الرد السريع للزر '+(j+1)+' (اختياري)',
                  'card_'+i+'_button_'+j,b.type==='URL',b.type==='URL'?200:128);
            }
          }
        }
        host.append(pane);
      }
    }
  }
  ctx.commerce.editor(host,t,{mediaCards:false});
}
function values(d){
 const out={body:[],header:[],buttons:{}},cards=[];
 for(const [k,v] of Object.entries(d)){
  if(k.startsWith('body_named_')||k.startsWith('header_named_'))continue;
  if(k.startsWith('body_'))out.body[Number(k.slice(5))]=v;
  else if(k.startsWith('header_'))out.header[Number(k.slice(7))]=v;
  else if(k.startsWith('button_')&&v)out.buttons[k.slice(7)]=v;
  else if(k==='mediaUrl'&&v)out.mediaUrl=v;
  else{
    const card=/^card_(\d+)_(mediaUrl|body_\d+|button_\d+)$/.exec(k);
    if(!card)continue;
    const i=Number(card[1]),field=card[2];
    if(!cards[i])cards[i]={mediaUrl:'',body:[],buttons:{}};
    if(field==='mediaUrl')cards[i].mediaUrl=v;
    else if(field.startsWith('body_'))cards[i].body[Number(field.slice(5))]=v;
    else if(field.startsWith('button_')&&v)cards[i].buttons[field.slice(7)]=v;
  }
 }
 if(cards.length)out.cards=cards;
 return ctx.commerce.read(d,out);
}
 async function templatePage(){const host=$('template-list');host.replaceChildren();const [accounts,t,contacts]=await Promise.all([api('/whatsapp/connection'),api('/whatsapp/templates'),api('/contacts')]);templates=t;state.contacts=contacts;await ctx.commerce.load();state.templateCatalog=(await api('/catalog')).filter(x=>x.status==='PUBLISHED');options($('template-account'),accounts.filter(a=>a.status==='CONNECTED').map(a=>({...a,id:a.id})),a=>a.displayPhone||a.phoneNumberId);options($('consent-contact'),contacts.filter(c=>c.phone),c=>c.full_name+' • '+c.phone);options($('send-contact'),contacts.filter(c=>c.phone),c=>c.full_name+' • '+c.phone);options($('send-template'),t,t=>t.name+' • '+t.language);if(!t.length)host.append(el('p','لا توجد قوالب معتمدة محفوظة.'));for(const r of t)host.append(card(r.name,r.language+' • '+r.category+' • آخر تحقق '+new Date(r.lastVerifiedAt).toLocaleString('ar-EG')));parameterEditor()}
 $('send-template').onchange=parameterEditor;
 bind('template-register',async(d,f)=>{await api('/whatsapp/templates',{method:'POST',body:d});f.elements.name.value='';await templatePage()});bind('consent-form',async d=>{await api('/contacts/'+d.contactId+'/marketing-consent',{method:'PATCH',body:{optIn:d.optIn==='true',evidence:d.evidence}});notify('تم تسجيل الموافقة ودليلها')});bind('template-send',async d=>{if(!confirm('إرسال القالب لهذا العميل وفق موافقته المسجلة؟'))return;await api('/whatsapp/templates/send',{method:'POST',body:{contactId:d.contactId,templateId:d.templateId,parameters:values(d),scheduleAt:d.scheduleAt?new Date(d.scheduleAt).toISOString():undefined}});notify('تمت إضافة الرسالة للطابور؛ ليست تأكيد تسليم')});
 let polling=false;
 setInterval(()=>{if(polling||!state.token||state.page!=='wa-inbox'||document.hidden)return;polling=true;const session=state.token,id=selected?.id;
  (async()=>{const fresh=await api('/whatsapp/inbox');if(session!==state.token)return;threads=fresh;renderThreads();if(!id||selected?.id!==id)return;const messages=await api('/whatsapp/inbox/'+id+'/messages');if(selected?.id!==id||session!==state.token)return;const host=$('thread-messages');const signature=messages.map(m=>m.id+':'+m.delivery_status).join('|');if(host.dataset.signature===signature)return;const atBottom=host.scrollHeight-host.scrollTop-host.clientHeight<70;host.dataset.signature=signature;host.replaceChildren();for(const m of messages){const b=el('div',undefined,'bubble '+(m.kind==='INBOUND'?'incoming':m.kind==='INTERNAL_NOTE'?'internal':'outgoing'));b.append(el('p',m.body),el('small',m.kind==='INTERNAL_NOTE'?'ملاحظة داخلية':m.message_source==='BUSINESS_APP'?'من تطبيق واتساب بيزنس':m.imported_history?'سجل سابق — لا يشغّل البوت':m.delivery_status||m.kind));host.append(b)}if(atBottom)host.scrollTop=host.scrollHeight;const current=fresh.find(t=>t.id===id);if(current&&current.status!==selected.status){selected=current;$('thread-take').textContent=current.status==='HUMAN'?'تسليم للبوت':'استلام';$('reply-form').querySelector('button.primary').disabled=current.status!=='HUMAN'}
  })().catch(()=>{}).finally(()=>{polling=false});
 },5000);
 return {load:page=>({'wa-inbox':inbox,leads,templates:templatePage,team,'wa-connect':connection}[page])(),reset(){threads=[];selected=null;templates=[];members=[];$('thread-tools').hidden=true;$('thread-messages').replaceChildren();$('invite-result').textContent=''}};
}
