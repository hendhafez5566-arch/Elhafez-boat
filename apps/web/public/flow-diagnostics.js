/** Committed conversation traces. No test transcript or customer values are requested. */
export function mountFlowDiagnostics({el,button,api,execute,getScope,toolbar,focusNode,notify}){
 const dialogs=new Set();let generation=0;
 const same=(scope,epoch)=>epoch===generation&&JSON.stringify(scope)===JSON.stringify(getScope());
 const shell=title=>{const dialog=el('dialog',undefined,'builder-conflict-dialog builder-trace-dialog');dialog.setAttribute('aria-label',title);dialog.append(el('h3',title));const content=el('div'),close=()=>{dialog.close();dialog.remove();dialogs.delete(dialog)};dialog.append(content,button('إغلاق',close));document.body.append(dialog);dialogs.add(dialog);dialog.addEventListener('close',()=>{dialogs.delete(dialog);dialog.remove()},{once:true});dialog.showModal();return {dialog,content,close}};
 const when=value=>{if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('ar-EG',{hour12:false})};
 async function showTrace(scope,conversationId,epoch){
  const view=shell('مسار تنفيذ المحادثة');view.content.append(el('p','تحميل الأحداث المحفوظة…'));let events=[],cursor=null,busy=false;
  const path='/bots/'+encodeURIComponent(scope.botId)+'/flow-traces/'+encodeURIComponent(conversationId);
  async function load(older=false){
   if(busy)return;busy=true;try{const data=await api(path+(older?'?before='+encodeURIComponent(cursor):''));if(!same(scope,epoch)||!view.dialog.isConnected)return;events=older?[...data.events,...events]:data.events;cursor=data.nextCursor;paint(data);}finally{busy=false}
  }
  function paint(data){
   const snapshot=data.snapshot;view.content.replaceChildren(el('p','هذه أحداث التنفيذ المحفوظة فقط؛ لا تظهر إجابات العميل أو محتوى رسائله. أخطاء المعاملات المتراجعة متاحة في تحليلات المسار والأخطاء.'));
   view.content.append(el('code',conversationId,'builder-trace-correlation'),el('p','الحالة: '+snapshot.status+' · الإصدار المثبت: '+snapshot.version+' · الخطوة الحالية: '+(snapshot.nodeId||'—')));
   view.content.append(button('الرسائل وحالات التسليم',()=>execute(async()=>{const delivery=await api('/bots/'+scope.botId+'/flow-delivery/'+conversationId);if(!same(scope,epoch)||!view.dialog.isConnected)return;for(const m of delivery.rows)view.content.append(el('p',m.executionId+' · '+m.direction+' · '+m.source+' · '+m.certainty))})));
   if(snapshot.waitUntil)view.content.append(el('p','المهلة المحفوظة: '+when(snapshot.waitUntil)));
   if(snapshot.jobStatus)view.content.append(el('p','استكمال الانتظار: '+snapshot.jobStatus+' · '+(snapshot.jobNodeId||'—')+' · '+when(snapshot.jobDueAt),snapshot.jobStatus==='FAILED'?'builder-preview-warning':undefined));
   if(events.some(e=>!e.ordered))view.content.append(el('p','أحداث قديمة: لا تتوفر لها هوية تنفيذ أو أدلة ترتيب مؤكدة.','builder-preview-warning'));
   if(cursor)view.content.append(button('تحميل أحداث أقدم',()=>execute(()=>load(true))));
   if(!events.length){view.content.append(el('p','لا توجد أحداث تنفيذ محفوظة لهذه المحادثة بعد. المحاكاة لا تضيف أحداثًا.'));return}
   const list=el('div',undefined,'builder-trace-executions');let key=null,section;
   for(const event of events){
    const current=event.executionId||'historical:'+event.id;
    if(current!==key){key=current;section=el('section',undefined,'builder-runtime-policy');section.append(el('h4',when(event.recordedAt)+' · الإصدار '+event.version));if(event.executionId)section.append(el('code',event.executionId,'builder-trace-correlation'));else section.append(el('small','حدث قديم دون هوية تنفيذ'));list.append(section)}
    const row=el('div',undefined,'builder-trace-step');row.dataset.traceNode=event.nodeId;row.dataset.stepIndex=event.stepIndex??'';row.append(el('span',event.stepIndex===null?'—':String(event.stepIndex+1),'builder-trace-index'),button(event.nodeId+' · '+event.nodeType,()=>{if(!same(scope,epoch))return;if(focusNode(event.nodeId)){for(const d of [...dialogs]){d.close();d.remove()}dialogs.clear()}else notify('هذه الخطوة من إصدار منشور مختلف ولا توجد في المسودة الحالية.','error')}),el('strong',event.outcome),el('small',Number(event.elapsedMs).toFixed(2)+' ms'));section.append(row);
   }
   view.content.append(list);
  }
  try{await load()}catch(error){if(view.dialog.isConnected){view.content.replaceChildren(el('p','تعذر تحميل السجل؛ يمكنك إعادة المحاولة.'),button('إعادة المحاولة',()=>execute(()=>load())))}throw error}
 }
 toolbar.append(button('تتبع المحادثات الفعلية',()=>execute(async()=>{
  const scope=getScope(),epoch=generation;if(!scope.botId||scope.demo){notify('افتح بوتًا محفوظًا لعرض جلساته الفعلية');return}
  const data=await api('/bots/'+encodeURIComponent(scope.botId)+'/flow-traces');if(!same(scope,epoch))return;const view=shell('جلسات التنفيذ الفعلية');view.content.append(el('p','آخر 20 جلسة محفوظة لهذا البوت. المعرّفات للتشخيص؛ لا تتضمن أسماء أو إجابات العملاء.'));
  if(!data.rows.length)view.content.append(el('p','لا توجد جلسات فعلية؛ تجارب المحاكي مستبعدة.'));
  for(const session of data.rows){const b=button('محادثة '+session.conversationId.slice(0,8)+' · الإصدار '+session.version+' · '+session.status+' · '+when(session.updatedAt),()=>execute(()=>showTrace(scope,session.conversationId,epoch)));b.className='builder-trace-session';b.dataset.conversationId=session.conversationId;view.content.append(b)}
  if(data.truncated)view.content.append(el('small','تُعرض أحدث 20 جلسة فقط. استخدم معرّف محادثة محدد لفتح سجل آخر.'));
  const form=el('form'),input=el('input'),open=el('button','فتح سجل المحادثة');input.setAttribute('aria-label','معرّف المحادثة');input.required=true;input.dir='ltr';input.pattern='[0-9a-fA-F-]{36}';open.type='submit';form.append(input,open);form.onsubmit=e=>{e.preventDefault();execute(()=>showTrace(scope,input.value,epoch))};view.content.append(form);
 })));
 return {reset(){generation++;for(const d of dialogs){d.close();d.remove()}dialogs.clear()}};
}
