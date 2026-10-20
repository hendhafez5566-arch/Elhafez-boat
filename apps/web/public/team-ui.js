/** Company team tasks backed by the existing tenant/role-checked invitation API. */
export function initTeam({state,api,$,el,button,card,bind,notify}){
 const titles={OWNER:'مالك الشركة',MANAGER:'مدير',AGENT:'موظف',VIEWER:'مشاهدة فقط'};
 const descriptions={MANAGER:'إدارة البوتات والعملاء والحملات ودعوة الموظفين والمشاهدين. تغيير الأدوار ودعوة مدير آخر للمالك فقط.',AGENT:'الرد على العملاء وإدارة المتابعة، دون نشر البوت أو إدارة الفريق.',VIEWER:'الاطلاع على البيانات المسموح بها دون تعديل أو إرسال رسائل.'};
 const statuses={PENDING:'بانتظار القبول',ACCEPTED:'تم القبول',REVOKED:'ملغاة',EXPIRED:'انتهت الصلاحية'};
 const errors={'Active invitation already exists for this email':'توجد دعوة سارية لهذا البريد. ألغِها أولًا إذا احتجت رابطًا جديدًا.','Staff seats limit reached':'اكتمل عدد أعضاء الفريق والدعوات السارية المتاح في خطة الشركة.','This email is already a company member':'هذا البريد عضو بالفعل في الشركة.','Only owner invites managers':'دعوة مدير متاحة لمالك الشركة فقط.','Only owner manages privileged invitations':'إدارة دعوات المالك والمديرين متاحة لمالك الشركة فقط.','Insufficient permissions':'ليست لديك صلاحية لتنفيذ هذا الإجراء.','Active invitation not found':'الدعوة لم تعد متاحة للإلغاء. حدّث القائمة.'};
 let revision=0;
 function taskButton(text,task,kind){const control=button(text,async()=>{if(control.disabled)return;control.disabled=true;try{await task()}finally{control.disabled=false}},kind);return control}
 const form=$('invite-form'),role=form.elements.role,result=$('invite-result');
 const description=el('p',undefined,'muted');description.id='team-role-description';role.setAttribute('aria-describedby',description.id);role.closest('label').after(description);
 role.onchange=()=>description.textContent=descriptions[role.value]||'';
 form.append(el('p','الدعوة صالحة لمدة 48 ساعة. لن يُرسل بريد تلقائي؛ شارك الرابط بنفسك مع صاحب البريد فقط.','muted'));
 const guide=el('details',undefined,'team-role-guide');guide.append(el('summary','ما صلاحيات كل دور؟'));
 for(const [key,text] of Object.entries(descriptions))guide.append(el('h4',titles[key]),el('p',text));form.before(guide);
 async function request(path,options){try{return await api(path,options)}catch(error){throw new Error(errors[error.message]||(error instanceof TypeError?'تعذر الاتصال بالخادم. تحقق من الاتصال ثم حاول مجددًا.':error.message))}}
 function clearLink(){result.replaceChildren();result.hidden=true}
 function syncRole(){for(const option of role.options){option.hidden=option.value==='MANAGER'&&state.role!=='OWNER';option.disabled=option.hidden}if(role.selectedOptions[0]?.disabled)role.value='AGENT';role.onchange()}
 async function load(){
  const host=$('team-list'),invites=$('team-invites'),current=++revision;syncRole();host.setAttribute('aria-busy','true');
  let users,invitations;
  try{[users,invitations]=await Promise.all([request('/team'),request('/team/invitations')])}
  catch(error){if(current!==revision)return;host.setAttribute('aria-busy','false');host.querySelector('.team-load-error')?.remove();const panel=el('div',undefined,'team-load-error');panel.setAttribute('role','alert');panel.append(el('p','تعذر تحديث الفريق: '+error.message),button('إعادة المحاولة',load));host.append(panel);return}
  if(current!==revision)return;state.team=users;host.replaceChildren();invites.replaceChildren();host.setAttribute('aria-busy','false');
  host.append(el('p',users.length+' عضو • '+invitations.filter(i=>i.status==='PENDING').length+' دعوة سارية','muted'));
  for(const member of users){const item=card(member.email,titles[member.role]||member.role);item.dataset.memberId=member.id;
   if(state.role==='OWNER'&&member.role!=='OWNER'){const select=el('select');select.setAttribute('aria-label','دور '+member.email);for(const key of ['MANAGER','AGENT','VIEWER']){const option=el('option',titles[key]);option.value=key;select.append(option)}select.value=member.role;
    item.append(select,taskButton('حفظ الدور',async()=>{if(select.value===member.role)return;if(!confirm('تغيير دور '+member.email+' إلى '+titles[select.value]+'؟ سيحتاج العضو إلى تسجيل الدخول مجددًا.'))return;await request('/team/members/'+member.id+'/role',{method:'PATCH',body:{role:select.value}});await load();notify('حُفظ الدور وانتهت جلسات العضو السابقة.')}));
   }host.append(item);
  }
  if(!invitations.length)invites.append(el('p','لا توجد دعوات بعد. أضف البريد وحدد الدور لإنشاء أول دعوة.','muted'));
  for(const invitation of invitations){const item=card(invitation.email,(titles[invitation.role]||invitation.role)+' • '+(statuses[invitation.status]||invitation.status));item.dataset.invitationId=invitation.id;item.dataset.status=invitation.status;
   item.append(el('p',(invitation.status==='PENDING'?'تنتهي في: ':'موعد الصلاحية: ')+new Date(invitation.expiresAt).toLocaleString('ar-EG')));
   if(invitation.status==='PENDING'&&(state.role==='OWNER'||['AGENT','VIEWER'].includes(invitation.role)))item.append(taskButton('إلغاء الدعوة',async()=>{if(!confirm('إلغاء دعوة '+invitation.email+'؟ سيتوقف رابطها عن العمل.'))return;await request('/team/invitations/'+invitation.id+'/revoke',{method:'POST'});clearLink();await load();notify('أُلغيت الدعوة؛ رابطها لم يعد صالحًا.');},'danger'));
   invites.append(item);
  }
 }
 bind('invite-form',async(data,f)=>{const response=await request('/team/invitations',{method:'POST',body:data});clearLink();result.hidden=false;
  const link=el('input');link.type='text';link.readOnly=true;link.value=location.origin+'/join.html#team.'+response.inviteToken;link.setAttribute('aria-label','رابط الدعوة الخاص');
  result.append(el('strong','رابط خاص يظهر مرة واحدة'),link,button('نسخ رابط الدعوة',async()=>{await navigator.clipboard.writeText(link.value);notify('نُسخ الرابط؛ شاركه مع صاحب البريد فقط.')}),button('إخفاء الرابط',clearLink));
  f.elements.email.value='';await load();notify('أُنشئت الدعوة دون إرسال بريد.');
 });
 return {load,reset(){revision++;clearLink();role.value='AGENT';role.onchange()}};
}
