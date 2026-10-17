const hash=location.hash.slice(1);const kind=hash.startsWith('owner.')?'owner':hash.startsWith('team.')?'team':null;
const token=kind?hash.slice(kind.length+1):'';history.replaceState(null,'',location.pathname);
const notice=document.getElementById('join-notice');
const say=(msg,err=false)=>{notice.hidden=false;notice.textContent=msg;notice.style.background=err?'#fff0f0':'#e8f9f0'};
if(!kind||!/^[A-Za-z0-9_-]{43}$/.test(token))say('رابط الدعوة غير صحيح أو انتهت صلاحيته.',true);
document.getElementById('join-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!kind||!/^[A-Za-z0-9_-]{43}$/.test(token))return;
 const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;
 const path=kind==='owner'?'/api/v1/platform/owner/accept':'/api/v1/team/accept';
 try{const input=Object.fromEntries(new FormData(form));const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,token}),cache:'no-store'});const answer=await r.json();if(!r.ok)throw new Error(answer.error||'تعذر قبول الدعوة');say('تم تفعيل الحساب. تقدر تسجل الدخول من لوحة الشركة الآن.');form.reset();button.disabled=true;}
 catch(e){say(e.message||'تعذر قبول الدعوة',true);button.disabled=false;}
});