/** Additional workspace screens. Everything sensitive is authorized server-side. */
export function initOperations({state,api,notify,execute,canEdit}) {
 const $=id=>document.getElementById(id);
 const node=(tag,text,klass)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(klass)n.className=klass;return n};
 const clear=id=>$(id)?.replaceChildren();
 const msg=(container,message)=>container.append(node('p',message,'muted'));
 const getForm=form=>Object.fromEntries(new FormData(form));
 const roleTitles={OWNER:'مالك',MANAGER:'مدير',AGENT:'مبيعات',VIEWER:'مشاهد'};
 const noLive=()=>{notify('المعاينة التجريبية لا تستخدم حسابات أو رسائل واتساب حقيقية','error')};
 const button=(text,fn,klass='secondary')=>{const b=node('button',text,klass);b.type='button';b.onclick=()=>execute(fn);return b};
 async function connection(){
  clear('wa-connections');if(state.demo){msg($('wa-connections'),'المعاينة فقط — مفيش أرقام واتساب حقيقية مرتبطة.');return;}
  const result=await api('/whatsapp/connection');
  if(!result.length){msg($('wa-connections'),'لا يوجد رقم متصل. الربط يتطلب حساب Meta Cloud API ورمز صلاحية حقيقي.');return;}
  result.forEach(item=>{const box=node('div',undefined,'ops-card');box.append(node('strong',item.displayPhone||item.phoneNumberId),node('p','Meta ID: '+item.phoneNumberId+' • '+item.status));if(item.status==='CONNECTED'&&state.role==='OWNER')box.append(button('فصل الاتصال',async()=>{if(!confirm('فصل رقم واتساب عن الشركة؟'))return;await api('/whatsapp/connection/'+item.id,{method:'DELETE'});notify('تم فصل الرقم');await connection()},'danger'));$('wa-connections').append(box);});
 }
 let inboxCache=[];
 function renderInboxRows(){
   const target=$('wa-threads');target.replaceChildren();
   const term=$('wa-inbox-search').value.trim().toLowerCase();
   const filter=$('wa-inbox-filter').value;
   const filtered=inboxCache.filter(x=>(filter==='ALL'||x.status===filter)&&
     (String(x.customer_name||'').toLowerCase().includes(term)||String(x.phone||'').includes(term)));
   if(!filtered.length)msg(target,'لا توجد محادثات تطابق البحث والتصفية.');
   for(const item of filtered){
     const card=button(item.customer_name+' — '+item.phone,()=>selectThread(item),'ops-thread');
     card.append(node('small',item.lead_stage==='READY_FOR_AGENT'?'★ جاهز لموظف':item.status==='HUMAN'?'مع موظف':'البوت يرد على الاستفسارات'));
     if(item.do_not_contact)card.append(node('small','العميل أوقف التواصل'));
     target.append(card);
   }
 }
 async function inbox(){
   // Prevent customer information from a previous login/tenant remaining on screen.
   selected=null;$('wa-chat-tools').hidden=true;
   $('wa-chat-title').textContent='اختار محادثة لعرض رسائلها';
   $('wa-lead-context').hidden=true;$('wa-lead-context').replaceChildren();
   $('wa-chat').replaceChildren();
   clear('wa-threads');
   if(state.demo){inboxCache=[];msg($('wa-threads'),'دي معاينة شكل صندوق واتساب. البيانات الحقيقية هتظهر بعد ربط Meta.');return;}
   inboxCache=await api('/whatsapp/inbox');
   renderInboxRows();
 }
 let selected=null;
 async function selectThread(item){
  selected=item;const target=$('wa-chat'),title=$('wa-chat-title');title.textContent=item.customer_name+' • '+item.phone;target.replaceChildren();
  const summary=$('wa-lead-context');summary.replaceChildren();
  if(item.lead_stage){
    summary.hidden=false;
    summary.append(node('strong',item.lead_stage==='READY_FOR_AGENT'?'عميل جاهز لموظف':'اهتمام العميل: '+item.lead_stage));
    summary.append(node('p','الخدمة: '+(item.interested_program||'استفسار عام')+
      ' • الأفراد: '+(item.party_size??'غير محدد')+
      ' • السفر: '+(item.travel_preference||'غير محدد')));
    const captured=item.custom_fields&&typeof item.custom_fields==='object'&&!Array.isArray(item.custom_fields)
      ?Object.entries(item.custom_fields).slice(0,8)
        .map(([key,value])=>key+': '+String(value).slice(0,120)).join(' • '):'';
    if(captured)summary.append(node('p','إجابات العميل: '+captured));

  }else summary.hidden=true;

  const messages=await api('/whatsapp/inbox/'+item.id+'/messages');
  messages.forEach(message=>{const div=node('div',undefined,'ops-bubble '+(message.kind==='INBOUND'?'incoming':'outgoing'));div.append(node('p',message.body),node('small',message.delivery_status||message.kind));target.append(div);});
  $('wa-handoff').textContent=item.status==='HUMAN'?'تسليم للبوت':'استلام المحادثة';
  $('wa-reply').disabled=item.status!=='HUMAN';$('wa-chat-tools').hidden=false;
  const managers=state.role==='OWNER'||state.role==='MANAGER';
  $('wa-assign-tools').hidden=!managers;
  const select=$('wa-assignee');select.replaceChildren();
  if(managers)for(const m of (state.team||[]).filter(m=>m.role!=='VIEWER')){
    const option=node('option',m.email+' — '+(roleTitles[m.role]||m.role));option.value=m.id;select.append(option);
  }
  if(item.assigned_user_id&&[...select.options].some(o=>o.value===item.assigned_user_id))select.value=item.assigned_user_id;
  target.scrollTop=target.scrollHeight;
 }
 async function staff(){
  const target=$('team-invitations');target.replaceChildren();const roles=$('team-role-controls');roles.replaceChildren();
  if(state.demo){msg(target,'الدعوات هنا تحتاج حساب شركة حقيقي. لا يتم إرسال إيميلات في المعاينة.');return;}
  if(!canEdit())return;
  const [invites,members]=await Promise.all([api('/team/invitations'),api('/team')]);
  if(!invites.length)msg(target,'لم يتم إنشاء دعوات بعد. رابط الدعوة يُعرض مرة واحدة فقط ويتم مشاركته يدويًا بطريقة آمنة.');
  for(const invite of invites){const line=node('div',undefined,'ops-row');line.append(node('span',invite.email+' — '+(roleTitles[invite.role]||invite.role)+' — '+invite.status));if(invite.status==='PENDING')line.append(button('إلغاء الدعوة',async()=>{await api('/team/invitations/'+invite.id+'/revoke',{method:'POST'});await staff();notify('أُلغيت الدعوة')}));target.append(line);}
  if(state.role==='OWNER')for(const m of members.filter(m=>m.role!=='OWNER')){
    const row=node('div',undefined,'ops-row');row.append(node('span',m.email));const select=node('select');for(const key of ['MANAGER','AGENT','VIEWER']){const opt=node('option',roleTitles[key]);opt.value=key;select.append(opt);}select.value=m.role;row.append(select,button('تغيير الصلاحية',async()=>{await api('/team/members/'+m.id+'/role',{method:'PATCH',body:{role:select.value}});await staff();notify('تم تغيير الصلاحية — انتهت جلسات الموظف السابقة')}));roles.append(row);
  }
 }
 async function subscription(){
  const c=$('company-subscription');c.replaceChildren();if(state.demo){msg(c,'خطة المعاينة: بيانات توضيحية فقط.');return;}
  const info=await api('/subscription');c.append(node('h3','الباقة: '+(info.title||info.planCode||'غير محددة')),
    node('p','الحالة: '+(info.status||'لم يتم تفعيل اشتراك')),
    node('p','الحد الأقصى للموظفين: '+(info.maxStaff??'—')),
    node('p','الحد الأقصى للبرامج: '+(info.maxPrograms??'—')));
  if(info.currentPeriodEndsAt)c.append(node('small','تاريخ نهاية الدورة: '+new Date(info.currentPeriodEndsAt).toLocaleDateString('ar-EG')));
 }
 async function knowledge(){
  const target=$('faq-list');target.replaceChildren();
  if(state.demo){msg(target,'في المعاينة، الأسئلة المعتمدة للعرض فقط.');return;}
  const articles=await api('/knowledge');
  if(!articles.length)msg(target,'مافيش أسئلة شائعة منشورة أو مسودات بعد.');
  for(const article of articles){const item=node('div',undefined,'ops-card');
    item.append(node('strong',article.question),node('p',article.answer),node('small',article.status==='PUBLISHED'?'منشور':'مسودة'));
    if(article.status==='DRAFT'&&canEdit())item.append(button('اعتماد ونشر',async()=>{await api('/knowledge/'+article.id+'/publish',{method:'PATCH'});await knowledge();notify('تم نشر إجابة البوت المعتمدة')}));
    target.append(item);
  }
 }

 const tripLabels={SINGLE:'فردي',DOUBLE:'ثنائي',TRIPLE:'ثلاثي',QUAD:'رباعي',FAMILY:'عائلي'};
 const tripDate=value=>new Date(value).toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'});
 function selectOptions(select,items,label,emptyLabel){
   const saved=select.value;select.replaceChildren();
   if(emptyLabel!==undefined){const o=node('option',emptyLabel);o.value='';select.append(o);}
   items.forEach(item=>{const o=node('option',label(item));o.value=item.id;select.append(o)});
   if([...select.options].some(option=>option.value===saved))select.value=saved;
 }
 async function roomsForDeparture(departureId){
   const target=$('inventory-rooms');target.replaceChildren();
   if(!departureId){msg(target,'اختار موعد سفر علشان تظهر الغرف والأسعار.');return;}
   if(state.demo){msg(target,'معاينة فقط: مفيش غرف محفوظة. بعد تسجيل الدخول الحقيقي تقدر تضيف فندقًا وغرفًا لكل موعد.');return;}
   const rooms=await api('/departures/'+departureId+'/rooms');
   if(!rooms.length)msg(target,'مفيش غرف متعاقد عليها للموعد ده لسه.');
   for(const r of rooms){const card=node('div',undefined,'ops-card');card.append(node('strong',r.hotel_name+' — '+(tripLabels[r.room_type]||r.room_type)),node('p',r.occupancy+' فرد/غرفة • '+r.nights+' ليالي • '+(Number(r.price_minor)/100).toLocaleString('ar-EG')+' '+r.currency),node('small','المتاح: '+(Number(r.units_total)-Number(r.units_booked||0))+' من '+r.units_total+' غرفة'));target.append(card);}
 }
 async function inventory(){
   const programSelect=$('inventory-program');
   selectOptions(programSelect,state.programs,p=>p.title,'اختر البرنامج');
   const programId=programSelect.value;
   const target=$('inventory-departures');target.replaceChildren();
   if(!programId){selectOptions($('inventory-room-departure'),[],()=>'', 'لا توجد مواعيد');msg(target,'أضف برنامجًا سياحيًا أولًا.');await roomsForDeparture('');return;}
   if(state.demo){
      selectOptions($('inventory-room-departure'),[],()=>'', 'لا يوجد موعد في المعاينة');
      msg(target,'البيانات التجريبية للعرض فقط. المواعيد الحقيقية تحفظ بعد تسجيل الدخول إلى شركة.');
      await roomsForDeparture('');return;
   }
   const departures=await api('/programs/'+programId+'/departures');
   selectOptions($('inventory-room-departure'),departures,d=>tripDate(d.depart_at)+' — '+d.seats_total+' مقعد','اختر موعد السفر');
   if(!departures.length)msg(target,'مافيش مواعيد سفر للبرنامج. أضف الموعد الأول من النموذج.');
   for(const dep of departures){
     const card=node('div',undefined,'ops-card');
     card.append(node('strong',tripDate(dep.depart_at)+' — '+tripDate(dep.return_at)),node('p','سعة الموعد: '+dep.seats_total+' • المحجوز: '+dep.seats_booked),node('small','الحالة: '+dep.status));
     target.append(card);
   }
   await roomsForDeparture($('inventory-room-departure').value);
 }
 async function bookingDepartures(){
   const dep=$('booking-departure'),room=$('booking-room');
   selectOptions(dep,[],()=>'', 'بدون موعد محدد');
   selectOptions(room,[],()=>'', 'بدون اختيار غرفة');
   if(state.demo)return;
   const id=$('booking-programs').value;if(!id)return;
   const departures=await api('/programs/'+id+'/departures');
   selectOptions(dep,departures,d=>tripDate(d.depart_at)+' • '+(Number(d.seats_total)-Number(d.seats_booked||0))+' مقعد','بدون موعد محدد');
   await bookingRooms();
 }
 async function bookingRooms(){
   const room=$('booking-room');selectOptions(room,[],()=>'', 'بدون اختيار غرفة');
   const dep=$('booking-departure').value;
   if(state.demo||!dep)return;
   const rooms=await api('/departures/'+dep+'/rooms');
   selectOptions(room,rooms,r=>r.hotel_name+' — '+(tripLabels[r.room_type]||r.room_type)+' — '+(Number(r.price_minor)/100).toLocaleString('ar-EG')+' '+r.currency,'بدون اختيار غرفة');
 }

 async function templates(){
  const target=$('approved-template-list');target.replaceChildren();
  for(const id of ['template-account','template-consent-contact','template-send-contact','template-send-template'])$(id).replaceChildren();
  const customers=state.contacts||[];
  for(const item of customers){
    for(const id of ['template-consent-contact','template-send-contact']){
      const o=node('option',item.full_name+' — '+item.phone);o.value=item.id;$(id).append(o);
    }
  }
  if(state.demo){msg(target,'المعاينة لا ترسل قوالب حقيقية؛ يجب ربط حساب Meta وتسجيل موافقة العميل أولًا.');return;}
  const [accounts,registered]=await Promise.all([api('/whatsapp/connection'),api('/whatsapp/templates')]);
  for(const a of accounts.filter(x=>x.status==='CONNECTED')){const o=node('option',a.displayPhone||a.phoneNumberId);o.value=a.id;$('template-account').append(o);}
  if(!registered.length)msg(target,'لا توجد قوالب تم التحقق منها عند Meta.');
  for(const t of registered){
    const row=node('div',undefined,'ops-card');row.append(node('strong',t.name+' • '+t.language),node('small',t.category+' — آخر تحقق '+new Date(t.lastVerifiedAt).toLocaleDateString('ar-EG')));target.append(row);
    const o=node('option',t.name+' ('+t.language+')');o.value=t.id;$('template-send-template').append(o);
  }
 }
 const leadLabels={INTERESTED:'مهتم — البوت يجمع التفاصيل',READY_FOR_AGENT:'جاهز لموظف',CONTACTED:'تم التواصل',CLOSED:'مغلق'};
 let leadsCache=[],leadFilter='ALL';
 function renderLeadRows(){
  const target=$('lead-list-body');target.replaceChildren();
  const term=$('lead-search').value.trim().toLowerCase();
  const rows=leadsCache.filter(l=>(leadFilter==='ALL'||l.stage===leadFilter)&&
    (String(l.customer_name||'').toLowerCase().includes(term)||String(l.phone||'').includes(term)||
      String(l.program_title||'').toLowerCase().includes(term)));
  $('lead-list-count').textContent=rows.length+' عميل';
  if(!rows.length){
    const tr=node('tr');const td=node('td','لا توجد اهتمامات في هذا التصنيف');td.colSpan=6;tr.append(td);target.append(tr);
    return;
  }
  for(const lead of rows){
   const tr=node('tr');
   const answerSummary=lead.custom_fields&&typeof lead.custom_fields==='object'
     ?Object.entries(lead.custom_fields).slice(0,3).map(([key,value])=>key+': '+String(value).slice(0,80)).join(' • '):'';
   const fields=[lead.customer_name+' — '+lead.phone,(lead.program_title||lead.interested_program||'استفسار عام')+
     (answerSummary?' | '+answerSummary:''),
     lead.party_size??'لسه مش محدد',lead.travel_preference||'لسه مش محدد',
     leadLabels[lead.stage]||lead.stage];
   for(const value of fields)tr.append(node('td',value));
   const actions=node('td');
   if(lead.stage==='READY_FOR_AGENT'){
      actions.append(button('عرض واتساب',async()=>{document.querySelector('[data-page="wa-inbox"]')?.click()}));
   }
   if(lead.stage!=='CLOSED'&&state.role!=='VIEWER'){
     actions.append(button(lead.stage==='CONTACTED'?'إغلاق':'تم التواصل',async()=>{
       const next=lead.stage==='CONTACTED'?'CLOSED':'CONTACTED';
       await api('/leads/'+lead.id+'/stage',{method:'PATCH',body:{stage:next}});
       await leadsView();notify('تم تحديث مرحلة اهتمام العميل — بدون إجراء حجز');
     }));
   }
   tr.append(actions);target.append(tr);
  }
 }
 async function leadsSummary(){
  const value=await api('/leads/summary');
  for(const [key,id] of [['total','lead-metric-total'],['ready','lead-metric-ready'],
    ['contacted','lead-metric-contacted'],['interested','lead-metric-interested']]){
    $(id).textContent=String(value[key]??0);
  }
 }
 async function leadsView(){
  leadsCache=await api('/leads');renderLeadRows();
  await leadsSummary();
 }
 const kindNames={PRODUCT:'منتج',SERVICE:'خدمة',OFFER:'عرض',OTHER:'معلومة'};
 async function catalog(){
   const host=$('catalog-items');host.replaceChildren();
   const items=await api('/catalog');
   if(!items.length){msg(host,'مفيش منتجات أو خدمات اتضافت لسه. استخدم النموذج علشان تضيف أول معلومة.');return;}
   for(const item of items){
     const card=node('div',undefined,'ops-card');
     card.append(node('strong',item.title),node('small',(kindNames[item.kind]||'معلومة')+
       (item.categoryLabel?' • '+item.categoryLabel:'')+' • '+(item.status==='PUBLISHED'?'منشور':'مسودة')));
     if(item.description)card.append(node('p',item.description));
     if(item.priceText)card.append(node('p','السعر المعلن: '+item.priceText));
     if(item.status==='DRAFT'&&canEdit())card.append(button('اعتماد ونشر',async()=>{
       await api('/catalog/'+item.id+'/publish',{method:'POST'});await catalog();notify('اتنشر المحتوى المعتمد');
     }));
     if(item.status!=='ARCHIVED'&&canEdit())card.append(button('أرشفة',async()=>{
       if(!confirm('أرشفة العنصر ومنع البوت من استخدام معلوماته؟'))return;
       await api('/catalog/'+item.id+'/archive',{method:'POST'});await catalog();notify('تمت الأرشفة');
     },'secondary'));
     host.append(card);
   }
 }
 async function onPage(page){
  if(!['overview','leads','catalog','wa-inbox','wa-connect','team','subscription','settings'].includes(page))return;
  try{if(page==='wa-inbox')await inbox();if(page==='wa-connect')await connection();if(page==='team')await staff();if(page==='overview')await leadsSummary();if(page==='leads')await leadsView();if(page==='catalog')await catalog();if(page==='subscription')await subscription();if(page==='settings')await knowledge();if(page==='inventory')await inventory();if(page==='bookings')await bookingDepartures();if(page==='templates')await templates();}
  catch(e){notify(e.message||'تعذر تحميل الصفحة','error');}
 }
 $('wa-connect-form')?.addEventListener('submit',e=>{e.preventDefault();if(state.demo)return noLive();const form=e.currentTarget;execute(async()=>{const d=getForm(form);await api('/whatsapp/connection',{method:'POST',body:d});form.reset();await connection();notify('تم التحقق من رقم Meta وحفظه مشفرًا')})});
 $('faq-form').addEventListener('submit',e=>{e.preventDefault();if(state.demo)return noLive();execute(async()=>{const form=e.currentTarget;await api('/knowledge',{method:'POST',body:getForm(form)});form.reset();await knowledge();notify('تم حفظ السؤال والإجابة كمسودة')})});
 $('inventory-program').addEventListener('change',()=>execute(inventory));
 $('inventory-room-departure').addEventListener('change',()=>execute(()=>roomsForDeparture($('inventory-room-departure').value)));
 $('inventory-departure-form').addEventListener('submit',event=>{event.preventDefault();if(state.demo)return noLive();execute(async()=>{
   const data=getForm(event.currentTarget);
   if(!data.departAt||!data.returnAt)return;
   await api('/programs/'+$('inventory-program').value+'/departures',{method:'POST',body:{
      departAt:new Date(data.departAt).toISOString(),returnAt:new Date(data.returnAt).toISOString(),seatsTotal:Number(data.seatsTotal)
   }});
   event.currentTarget.reset();await inventory();notify('تم حفظ موعد السفر');
 })});
 $('inventory-room-form').addEventListener('submit',event=>{event.preventDefault();if(state.demo)return noLive();execute(async()=>{
   const data=getForm(event.currentTarget);
   await api('/departures/'+data.departureId+'/rooms',{method:'POST',body:{
     hotelName:data.hotelName,roomType:data.roomType,occupancy:Number(data.occupancy),
     nights:Number(data.nights),unitsTotal:Number(data.unitsTotal),
     priceMinor:Math.round(Number(data.price)*100),currency:data.currency
   }});
   await roomsForDeparture(data.departureId);notify('تم حفظ نوع الغرفة وسعره');
 })});
 $('booking-programs').addEventListener('change',()=>execute(bookingDepartures));
 $('booking-departure').addEventListener('change',()=>execute(bookingRooms));

 $('template-register-form').addEventListener('submit',event=>{event.preventDefault();if(state.demo)return noLive();execute(async()=>{
   await api('/whatsapp/templates',{method:'POST',body:getForm(event.currentTarget)});
   await templates();notify('تم التحقق من اعتماد القالب لدى Meta وحفظه');
 })});
 $('template-consent-form').addEventListener('submit',event=>{event.preventDefault();if(state.demo)return noLive();execute(async()=>{
   const d=getForm(event.currentTarget);
   await api('/contacts/'+d.contactId+'/marketing-consent',{method:'PATCH',body:{optIn:d.optIn==='true',evidence:d.evidence}});
   notify('تم تسجيل الموافقة أو سحبها مع دليلها في سجل العميل');
 })});
 $('template-send-form').addEventListener('submit',event=>{event.preventDefault();if(state.demo)return noLive();execute(async()=>{
   const d=getForm(event.currentTarget);
   if(!window.confirm('إرسال القالب المعتمد لهذا العميل فقط؟ يجب وجود موافقة موثقة؛ لا يمكن التراجع بعد دخوله طابور الإرسال.'))return;
   await api('/whatsapp/templates/send',{method:'POST',body:{contactId:d.contactId,templateId:d.templateId}});
   notify('تمت إضافة رسالة واحدة للطابور، وليست تأكيد تسليم من واتساب.');
 })});
 $('wa-inbox-search').addEventListener('input',renderInboxRows);
 $('wa-inbox-filter').addEventListener('change',renderInboxRows);
 $('wa-assign').onclick=()=>execute(async()=>{
    if(!selected||state.demo)return noLive();
    if(!(state.role==='OWNER'||state.role==='MANAGER'))throw new Error('فقط الإدارة تقدر تعيد توزيع المحادثات');
    const assignedUserId=$('wa-assignee').value;
    if(!assignedUserId)throw new Error('اختار موظفًا أولًا');
    const updated=await api('/whatsapp/inbox/'+selected.id+'/handoff',{
      method:'PATCH',body:{status:'HUMAN',assignedUserId}
    });
    const selectedId=String(updated.id);
    await inbox();const refreshed=inboxCache.find(x=>x.id===selectedId);
    if(refreshed)await selectThread(refreshed);
    notify('تم إسناد المحادثة للموظف المحدد');
 });
 $('lead-search').addEventListener('input',renderLeadRows);
 $('lead-filters').querySelectorAll('[data-lead-stage]').forEach(btn=>{
   btn.addEventListener('click',()=>{
      leadFilter=btn.dataset.leadStage;
      $('lead-filters').querySelectorAll('[data-lead-stage]').forEach(x=>x.classList.toggle('active',x===btn));
      renderLeadRows();
   });
 });
 $('leads-refresh').onclick=()=>execute(leadsView);
 $('catalog-refresh').onclick=()=>execute(catalog);
 $('catalog-form').addEventListener('submit',event=>{event.preventDefault();execute(async()=>{
   const form=event.currentTarget,data=getForm(form);
   if(!canEdit()){notify('إضافة المحتوى متاحة للمدير والمالك فقط','error');return}
   await api('/catalog',{method:'POST',body:{
     kind:data.kind,title:data.title,categoryLabel:data.categoryLabel,
     description:data.description,priceText:data.priceText,imageUrl:data.imageUrl,
     externalUrl:data.externalUrl
   }});
   form.reset();await catalog();notify('تم حفظ المنتج أو الخدمة كمسودة');
 })});
 $('wa-inbox-refresh').onclick=()=>execute(inbox);
 $('wa-handoff').onclick=()=>execute(async()=>{if(!selected)return; if(state.demo)return noLive();const status=selected.status==='HUMAN'?'OPEN':'HUMAN';await api('/whatsapp/inbox/'+selected.id+'/handoff',{method:'PATCH',body:{status}});const selectedId=selected.id;await inbox();const refreshed=inboxCache.find(x=>x.id===selectedId);if(refreshed)await selectThread(refreshed);notify(status==='HUMAN'?'الموظف استلم المحادثة':'تم تسليم المحادثة للبوت')});
 $('wa-reply-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;if(!selected)return;if(state.demo)return noLive();execute(async()=>{const value=form.elements.body.value.trim();if(!value)return;await api('/whatsapp/inbox/'+selected.id+'/reply',{method:'POST',body:{body:value}});form.reset();notify('تم وضع الرسالة في طابور الإرسال — مش تأكيد تسليم');await selectThread(selected)})});
 $('team-invite-form').addEventListener('submit',e=>{e.preventDefault();if(state.demo)return noLive();execute(async()=>{const input=getForm(e.currentTarget);const invited=await api('/team/invitations',{method:'POST',body:input});const link=location.origin+'/join.html#team.'+invited.inviteToken;$('team-invite-link').value=link;$('team-invite-result').hidden=false;await staff();notify('الدعوة اتعملت. انسخ الرابط وشاركه بأمان؛ مفيش إيميل تلقائي.')})});
 $('team-copy-invite').onclick=()=>execute(async()=>{const v=$('team-invite-link').value;if(!v)return;await navigator.clipboard.writeText(v);notify('تم نسخ رابط الدعوة')});
 return {onPage};
}