/** Controls use the existing conversation engine, membership roster and consent history. */
export function mountConversationControls({el,button,label,control,target,changed,repaint,runtimeControls:r,api,execute}){
 return (host,node)=>{
  if(node.type==='CONTROL'){
   host.append(label('تشغيل البوت',r.select(node.operation,[['PAUSE','إيقاف مؤقت وتسليم المحادثة'],['RESUME','متابعة المسار'],['STOP','إنهاء المسار حتى بدء جديد']],v=>{node.operation=v;delete node.seconds;repaint()})),el('small','تُلغى المهام المنتظرة. لا تعاد الطلبات التي بدأت بالفعل.'));
   if(node.operation==='PAUSE'){host.append(r.check('استئناف تلقائي بعد مدة',node.seconds!==undefined,on=>{if(on)node.seconds=300;else delete node.seconds}));if(node.seconds!==undefined)host.append(label('المدة بالثواني',control(node.seconds,v=>node.seconds=Number(v))))}
  }
  if(node.type==='CONSENT'){
   host.append(label('نوع الموافقة',r.select(node.purpose,[['MARKETING','رسائل التسويق'],['SERVICE','استمرار الخدمة']],v=>node.purpose=v)),label('إصدار نص الموافقة',control(node.policyVersion,v=>node.policyVersion=v)),label('عند الموافقة',target(node.acceptNext,v=>node.acceptNext=v)),label('عند الرفض',target(node.declineNext,v=>node.declineNext=v)),r.check('إظهار سحب الموافقة',!!node.withdrawNext,on=>{if(on)node.withdrawNext=node.declineNext;else delete node.withdrawNext}));
   if(node.withdrawNext)host.append(label('عند سحب الموافقة',target(node.withdrawNext,v=>node.withdrawNext=v)));
   host.append(el('small','لا تُسجل الموافقة من نص حر؛ يجب اختيار زر العميل. رفض الخدمة يوقف التواصل، وبدء الخدمة لاحقًا لا يمنح موافقة تسويقية.'));
  }
  if(node.type!=='HANDOFF')return;
  host.append(r.check('تحديد سياسة تحويل الموظفين',!!node.handoffPolicy,on=>{if(on)node.handoffPolicy={strategy:'QUEUE',queue:'الدعم',unavailableNext:target('',()=>{}).querySelector('option[value]:not([value=""])')?.value||'end'};else delete node.handoffPolicy}));
  const p=node.handoffPolicy;if(!p)return;
  host.append(label('التوجيه',r.select(p.strategy,[['QUEUE','قائمة انتظار'],['ANY','أي موظف متاح'],['MEMBER','موظف محدد'],['TEAM','فريق محدد']],v=>{p.strategy=v;repaint()})),label('اسم قائمة الانتظار',control(p.queue,v=>p.queue=v)));
  if(p.strategy==='TEAM')host.append(label('اسم الفريق',control(p.team||'',v=>p.team=v)));
  if(p.strategy==='MEMBER'){const roster=el('select');roster.setAttribute('aria-label','الموظف المسؤول');roster.append(el('option','اختر موظفًا'));roster.onchange=()=>{p.memberId=roster.value;changed()};host.append(label('الموظف المسؤول',roster));execute(async()=>{const rows=await api('/inbox/availability');if(!roster.isConnected)return;for(const m of rows){const o=el('option',m.email+(m.available?' — متاح':' — غير متاح'));o.value=m.id;roster.append(o)}roster.value=p.memberId||''})}
  host.append(label('عند عدم وجود موظف أو خارج ساعات العمل',target(p.unavailableNext,v=>p.unavailableNext=v)),label('عند استئناف البوت',target(p.resumeNext||'',v=>{if(v)p.resumeNext=v;else delete p.resumeNext},true)),r.check('التحويل في ساعات العمل فقط',!!p.schedule,on=>{if(on)p.schedule={timezone:'Africa/Cairo',weekdays:[1,2,3,4,5],open:'09:00',close:'17:00'};else delete p.schedule}));
  if(p.schedule){const proxy={type:'BUSINESS_HOURS',schedule:p.schedule};r.schedule(host,proxy)}
  host.append(r.check('إجراء عند عدم النشاط',p.idleSeconds!==undefined,on=>{if(on){p.idleSeconds=300;p.idleAction='QUEUE'}else{delete p.idleSeconds;delete p.idleAction}}));
  if(p.idleSeconds!==undefined)host.append(label('مهلة عدم النشاط بالثواني',control(p.idleSeconds,v=>p.idleSeconds=Number(v))),label('بعد انتهاء المهلة',r.select(p.idleAction,[['QUEUE','إعادة لقائمة الانتظار'],['RESUME','استئناف البوت'],['CLOSE','إنهاء المسار']],v=>p.idleAction=v)));
 };
}
export function mountConversationOperations({el,button,api,execute,notify,getScope,toolbar}){
 let epoch=0;const dialogs=new Set();
 toolbar.append(button('المحادثات والموظفون والموافقة',()=>execute(async()=>{
  const scope=getScope(),generation=epoch;if(!scope.botId||scope.demo){notify('افتح بوتًا محفوظًا أولًا');return}
  const d=el('dialog',undefined,'builder-conflict-dialog'),list=el('div'),rosterHost=el('div'),feedback=el('p');dialogs.add(d);d.setAttribute('aria-label','المحادثات والموظفون والموافقة');const alive=()=>d.isConnected&&generation===epoch&&JSON.stringify(scope)===JSON.stringify(getScope());
  const close=()=>{d.close();d.remove();dialogs.delete(d)};d.addEventListener('close',()=>{d.remove();dialogs.delete(d)},{once:true});d.append(el('h3','المحادثات والموظفون والموافقة'),el('p','الإيقاف والتحويل يلغي المهام المنتظرة. الطلب الذي بدأ لدى خدمة خارجية قد يكون وصل؛ لا تعِد إرساله قبل التحقق.'),feedback,rosterHost,list,button('تحديث',()=>execute(load)),button('إغلاق',close));document.body.append(d);d.showModal();
  async function load(){const [data,roster]=await Promise.all([api('/bots/'+scope.botId+'/conversation-control'),api('/inbox/availability')]);if(!alive())return;list.replaceChildren();rosterHost.replaceChildren(el('h4','توافر الموظفين'));
   for(const m of roster){const row=el('div'),available=el('input');available.type='checkbox';available.checked=m.available;available.disabled=scope.role==='AGENT'&&m.id!==scope.userId;available.setAttribute('aria-label','توافر '+m.email);available.onchange=()=>execute(async()=>{await api('/inbox/availability',{method:'PATCH',body:{userId:m.id,available:available.checked}});if(alive())await load()});row.append(el('span',m.email+' · '+(m.team||'بدون فريق')),available);const team=el('input');team.value=m.team;team.disabled=scope.role==='AGENT';team.placeholder='الفريق';team.setAttribute('aria-label','فريق '+m.email);row.append(team,button('حفظ الفريق',()=>execute(async()=>{await api('/inbox/availability',{method:'PATCH',body:{userId:m.id,available:m.available,team:team.value}});if(alive())await load()})));rosterHost.append(row)}
   if(!data.rows.length)list.append(el('p','لا توجد جلسات محفوظة لهذا البوت.'));
   for(const c of data.rows){const card=el('section',undefined,'builder-runtime-policy');card.dataset.conversationId=c.id;card.append(el('h4',({RUNNING:'البوت يعمل',PAUSED:'متوقف مؤقتًا',HANDOFF:'بانتظار الموظف',STOPPED:'المسار منتهٍ',OPEN:'مفتوحة',HUMAN:'مع الموظف',CLOSED:'مغلقة'}[c.control?.mode||c.status]||'محادثة')+' · '+c.id.slice(0,8)),el('p','الإصدار '+c.version+' · '+(c.control?.queue||'')+' · '+(c.nodeId||'بداية')));
    for(const [action,title]of [['PAUSE','إيقاف مؤقت'],['RESUME','استئناف البوت'],['STOP','إنهاء المسار'],['RESTART','بدء جديد']])card.append(button(title,()=>execute(async()=>{if(['STOP','RESTART'].includes(action)&&!confirm('تأكيد '+title+'؟ المهام القديمة لا تعاد.'))return;try{await api('/bots/'+scope.botId+'/conversation-control/'+c.id,{method:'POST',body:{action,expectedRevision:c.revision}});if(alive())await load()}catch(e){if(alive()){feedback.textContent=e.status===409?'تغيرت الحالة أو أن العميل أوقف الخدمة. حدّث القائمة قبل المحاولة.':'تعذر تنفيذ الإجراء؛ تحقق من الصلاحيات والاتصال.';await load()}}})));
    card.append(button('سجل الموافقة',()=>execute(async()=>{const consent=await api('/conversations/'+c.id+'/consent');if(!alive())return;card.querySelector('[data-consent]')?.remove();const history=el('div');history.dataset.consent='true';history.append(el('p','الخدمة: '+(consent.flags.do_not_contact?'موقوفة':'مسموحة')+' · التسويق: '+(consent.flags.marketing_opt_in?'موافق':'غير موافق')));for(const e of consent.events)history.append(el('p',[e.purpose,e.decision||e.granted,e.source,e.policyVersion,e.occurredAt].filter(Boolean).join(' · ')));for(const [purpose,title]of [['MARKETING','سحب موافقة التسويق'],['SERVICE','إيقاف الخدمة']])history.append(button(title,()=>execute(async()=>{if(!confirm('تأكيد '+title+' بناءً على طلب العميل؟ لا يمكن منح الموافقة بالنيابة عنه.'))return;await api('/conversations/'+c.id+'/consent',{method:'POST',body:{purpose,action:'WITHDRAW',acknowledged:true}});if(alive())await load()})));card.append(history)})));list.append(card)}
  }
  await load();
 })));
 return {reset(){epoch++;for(const d of dialogs){d.close();d.remove()}dialogs.clear()}};
}
