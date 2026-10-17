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
  const options=$('wa-flow-accounts');options.replaceChildren();
  result.filter(x=>x.status==='CONNECTED').forEach(x=>{const opt=node('option',x.displayPhone||x.phoneNumberId);opt.value=x.id;options.append(opt)});
  const flows=await api('/whatsapp/flows');
  $('wa-flow-status').textContent=flows.length?flows.map(f=>(f.displayPhone||f.accountId)+': '+f.flowId+(f.enabled?' — مفعل':' — محفوظ فقط')).join(' | '):'لم يتم إعداد WhatsApp Flow بعد.';
  if(!result.length){msg($('wa-connections'),'لا يوجد رقم متصل. الربط يتطلب حساب Meta Cloud API ورمز صلاحية حقيقي.');return;}
  result.forEach(item=>{const box=node('div',undefined,'ops-card');box.append(node('strong',item.displayPhone||item.phoneNumberId),node('p','Meta ID: '+item.phoneNumberId+' • '+item.status));if(item.status==='CONNECTED'&&state.role==='OWNER')box.append(button('فصل الاتصال',async()=>{if(!confirm('فصل رقم واتساب عن الشركة؟'))return;await api('/whatsapp/connection/'+item.id,{method:'DELETE'});notify('تم فصل الرقم');await connection()},'danger'));$('wa-connections').append(box);});
 }
 async function inbox(){
  clear('wa-threads');if(state.demo){msg($('wa-threads'),'دي معاينة شكل صندوق واتساب. البيانات الحقيقية هتظهر بعد ربط Meta.');return;}
  const items=await api('/whatsapp/inbox');if(!items.length){msg($('wa-threads'),'مافيش رسائل واردة من واتساب حتى الآن.');return;}
  for(const item of items){const card=button(item.customer_name+' — '+item.phone,()=>selectThread(item), 'ops-thread');card.append(node('small',item.status==='HUMAN'?'مع موظف':'البوت نشط'));$('wa-threads').append(card);}
 }
 let selected=null;
 async function selectThread(item){
  selected=item;const target=$('wa-chat'),title=$('wa-chat-title');title.textContent=item.customer_name+' • '+item.phone;target.replaceChildren();
  const messages=await api('/whatsapp/inbox/'+item.id+'/messages');
  messages.forEach(message=>{const div=node('div',undefined,'ops-bubble '+(message.kind==='INBOUND'?'incoming':'outgoing'));div.append(node('p',message.body),node('small',message.delivery_status||message.kind));target.append(div);});
  $('wa-handoff').textContent=item.status==='HUMAN'?'تسليم للبوت':'استلام المحادثة';$('wa-reply').disabled=item.status!=='HUMAN';$('wa-chat-tools').hidden=false;target.scrollTop=target.scrollHeight;
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
 async function onPage(page){
  if(!['wa-inbox','wa-connect','team','subscription','settings','inventory','bookings'].includes(page))return;
  try{if(page==='wa-inbox')await inbox();if(page==='wa-connect')await connection();if(page==='team')await staff();if(page==='subscription')await subscription();if(page==='settings')await knowledge();if(page==='inventory')await inventory();if(page==='bookings')await bookingDepartures();}
  catch(e){notify(e.message||'تعذر تحميل الصفحة','error');}
 }
 $('wa-connect-form')?.addEventListener('submit',e=>{e.preventDefault();if(state.demo)return noLive();const form=e.currentTarget;execute(async()=>{const d=getForm(form);await api('/whatsapp/connection',{method:'POST',body:d});form.reset();await connection();notify('تم التحقق من رقم Meta وحفظه مشفرًا')})});
 $('faq-form').addEventListener('submit',e=>{e.preventDefault();if(state.demo)return noLive();execute(async()=>{const form=e.currentTarget;await api('/knowledge',{method:'POST',body:getForm(form)});form.reset();await knowledge();notify('تم حفظ السؤال والإجابة كمسودة')})});
 $('wa-flow-form').addEventListener('submit',e=>{e.preventDefault();if(state.demo)return noLive();execute(async()=>{const d=getForm(e.currentTarget);await api('/whatsapp/flows',{method:'PUT',body:{accountId:d.accountId,flowId:d.flowId,screenId:d.screenId,enabled:d.enabled==='on'}});await connection();notify('تم حفظ إعداد Flow. النسخة المفعلة تُستخدم بعد تحقق Meta من النشر.')})});
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
 $('wa-inbox-refresh').onclick=()=>execute(inbox);
 $('wa-handoff').onclick=()=>execute(async()=>{if(!selected)return; if(state.demo)return noLive();const status=selected.status==='HUMAN'?'OPEN':'HUMAN';await api('/whatsapp/inbox/'+selected.id+'/handoff',{method:'PATCH',body:{status}});selected.status=status;await selectThread(selected);await inbox();notify(status==='HUMAN'?'الموظف استلم المحادثة':'تم تسليم المحادثة للبوت')});
 $('wa-reply-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;if(!selected)return;if(state.demo)return noLive();execute(async()=>{const value=form.elements.body.value.trim();if(!value)return;await api('/whatsapp/inbox/'+selected.id+'/reply',{method:'POST',body:{body:value}});form.reset();notify('تم وضع الرسالة في طابور الإرسال — مش تأكيد تسليم');await selectThread(selected)})});
 $('team-invite-form').addEventListener('submit',e=>{e.preventDefault();if(state.demo)return noLive();execute(async()=>{const input=getForm(e.currentTarget);const invited=await api('/team/invitations',{method:'POST',body:input});const link=location.origin+'/join.html#team.'+invited.inviteToken;$('team-invite-link').value=link;$('team-invite-result').hidden=false;await staff();notify('الدعوة اتعملت. انسخ الرابط وشاركه بأمان؛ مفيش إيميل تلقائي.')})});
 $('team-copy-invite').onclick=()=>execute(async()=>{const v=$('team-invite-link').value;if(!v)return;await navigator.clipboard.writeText(v);notify('تم نسخ رابط الدعوة')});
 return {onPage};
}