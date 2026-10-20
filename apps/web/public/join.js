const hash=location.hash.slice(1);const kind=hash.startsWith('owner.')?'owner':hash.startsWith('team.')?'team':null;
const token=kind?hash.slice(kind.length+1):'';history.replaceState(null,'',location.pathname);
const notice=document.getElementById('join-notice');
const say=(msg,err=false)=>{notice.hidden=false;notice.setAttribute('role',err?'alert':'status');notice.textContent=msg;notice.style.background=err?'#fff0f0':'#e8f9f0'};
const valid=Boolean(kind&&/^[A-Za-z0-9_-]{43}$/.test(token));
if(!valid){say('رابط الدعوة غير صحيح أو انتهت صلاحيته. اطلب من مدير الشركة رابطًا جديدًا.',true);document.querySelector('#join-form button').disabled=true}
const messages={'Invitation not found':'الدعوة غير متاحة. ربما استُخدمت أو أُلغيت؛ اطلب رابطًا جديدًا.','Invalid or expired invitation':'انتهت الدعوة أو البريد لا يطابق البريد المدعو. راجع المدير.','Existing account password is incorrect':'هذا البريد لديه حساب بالفعل. استخدم كلمة المرور الحالية للحساب.','Invalid invitation credentials':'تحقق من البريد وكلمة المرور؛ الحد الأدنى 12 حرفًا.','User already has membership':'أنت عضو بالفعل في الشركة؛ انتقل لتسجيل الدخول.'};
document.getElementById('join-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!kind||!/^[A-Za-z0-9_-]{43}$/.test(token))return;
 const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;
 const path=kind==='owner'?'/api/v1/platform/owner/accept':'/api/v1/team/accept';
 try{const input=Object.fromEntries(new FormData(form));const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,token}),cache:'no-store'});const answer=await r.json();if(!r.ok)throw new Error(messages[answer.error]||'تعذر قبول الدعوة. حاول مجددًا أو راجع مدير الشركة.');say('تم تفعيل الحساب. سجّل الدخول بالبريد وكلمة المرور اللذين استخدمتهما.');form.reset();form.hidden=true;button.disabled=true;const login=document.getElementById('join-login');if(typeof answer.tenantSlug==='string')login.href='/?company='+encodeURIComponent(answer.tenantSlug);login.textContent='تسجيل الدخول إلى الشركة';login.focus();}
 catch(e){say(e instanceof TypeError?'تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مجددًا.':e.message||'تعذر قبول الدعوة',true);button.disabled=false;}
});