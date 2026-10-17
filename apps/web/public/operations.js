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
 async function onPage(page){
  if(!['wa-inbox','wa-connect','team','subscription'].includes(page))return;
  try{if(page==='wa-inbox')await inbox();if(page==='wa-connect')await connection();if(page==='team')await staff();if(page==='subscription')await subscription();}
  catch(e){notify(e.message||'تعذر تحميل الصفحة','error');}
 }
 $('wa-connect-form')?.addEventListener('submit',e=>{e.preventDefault();if(state.demo)return noLive();const form=e.currentTarget;execute(async()=>{const d=getForm(form);await api('/whatsapp/connection',{method:'POST',body:d});form.reset();await connection();notify('تم التحقق من رقم Meta وحفظه مشفرًا')})});
 $('wa-flow-form').addEventListener('submit',e=>{e.preventDefault();if(state.demo)return noLive();execute(async()=>{const d=getForm(e.currentTarget);await api('/whatsapp/flows',{method:'PUT',body:{accountId:d.accountId,flowId:d.flowId,screenId:d.screenId,enabled:d.enabled==='on'}});await connection();notify('تم حفظ إعداد Flow. النسخة المفعلة تُستخدم بعد تحقق Meta من النشر.')})});
 $('wa-inbox-refresh').onclick=()=>execute(inbox);
 $('wa-handoff').onclick=()=>execute(async()=>{if(!selected)return; if(state.demo)return noLive();const status=selected.status==='HUMAN'?'OPEN':'HUMAN';await api('/whatsapp/inbox/'+selected.id+'/handoff',{method:'PATCH',body:{status}});selected.status=status;await selectThread(selected);await inbox();notify(status==='HUMAN'?'الموظف استلم المحادثة':'تم تسليم المحادثة للبوت')});
 $('wa-reply-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;if(!selected)return;if(state.demo)return noLive();execute(async()=>{const value=form.elements.body.value.trim();if(!value)return;await api('/whatsapp/inbox/'+selected.id+'/reply',{method:'POST',body:{body:value}});form.reset();notify('تم وضع الرسالة في طابور الإرسال — مش تأكيد تسليم');await selectThread(selected)})});
 $('team-invite-form').addEventListener('submit',e=>{e.preventDefault();if(state.demo)return noLive();execute(async()=>{const input=getForm(e.currentTarget);const invited=await api('/team/invitations',{method:'POST',body:input});const link=location.origin+'/join.html#team.'+invited.inviteToken;$('team-invite-link').value=link;$('team-invite-result').hidden=false;await staff();notify('الدعوة اتعملت. انسخ الرابط وشاركه بأمان؛ مفيش إيميل تلقائي.')})});
 $('team-copy-invite').onclick=()=>execute(async()=>{const v=$('team-invite-link').value;if(!v)return;await navigator.clipboard.writeText(v);notify('تم نسخ رابط الدعوة')});
 return {onPage};
}