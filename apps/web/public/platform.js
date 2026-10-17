const $=id=>document.getElementById(id);
const el=(tag,text,klass)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(klass)n.className=klass;return n};
let token='',plans=[];
function note(message,err=false){const n=$('platform-notice');n.hidden=!message;n.textContent=message;n.style.background=err?'#fff0f0':'#e8f9f0'}
async function request(path,method='GET',body){const r=await fetch('/api/v1/platform/'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json().catch(()=>({error:'رد غير مفهوم'}));if(!r.ok)throw new Error(d.error||'تعذر الطلب');return d}
function run(fn){Promise.resolve().then(fn).catch(e=>note(e.message||'تعذر إتمام الطلب',true));}
const formData=f=>Object.fromEntries(new FormData(f));
async function reload(){
 const [p,tenants]=await Promise.all([request('plans'),request('tenants')]);plans=p;
 $('platform-plans').replaceChildren();p.forEach(x=>{const op=el('option',x.title+' — '+x.code);op.value=x.code;$('platform-plans').append(op)});
 const list=$('platform-tenants');list.replaceChildren();if(!tenants.length)list.append(el('p','لم تُضف شركات بعد.'));
 tenants.forEach(t=>{
  const card=el('div',undefined,'ops-card');card.append(el('h3',t.name),el('p','المعرّف: '+t.slug+' • الموظفون: '+t.staff_count+' • عناصر الكتالوج: '+t.catalog_count+' • رسائل اليوم: '+(t.daily_inbound_used||0)+' • قوالب اليوم: '+(t.daily_templates_used||0)));
  const controls=el('div',undefined,'ops-row'),plan=el('select'),status=el('select'),date=el('input');date.type='date';
  p.forEach(x=>{const option=el('option',x.code+' — '+x.title);option.value=x.code;plan.append(option)});plan.value=t.plan_code||'STARTER';
  ['TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED'].forEach(x=>{const o=el('option',x);o.value=x;status.append(o)});status.value=t.subscription_status||'TRIAL';
  date.value=t.current_period_ends_at?new Date(t.current_period_ends_at).toISOString().slice(0,10):'';
  controls.append(plan,status,date);const save=el('button','حفظ الاشتراك','secondary');save.onclick=()=>run(async()=>{if(!date.value)throw new Error('حدد تاريخ انتهاء الدورة');await request('tenants/'+t.id+'/subscription','PATCH',{planCode:plan.value,status:status.value,endsAt:new Date(date.value+'T23:59:59.000Z').toISOString()});note('تم تحديث اشتراك '+t.name);await reload()});controls.append(save);card.append(controls);const limits=el('form',undefined,'ops-row');
  for(const [key,label,value] of [['dailyInbound','حد رسائل يومي',t.daily_inbound_limit||10000],['dailyTemplates','حد قوالب يومي',t.daily_template_limit||500],['mediaBytes','حد تخزين بالبايت',t.media_limit||52428800]]){const l=el('label',label),input=el('input');input.type='number';input.min='1';input.required=true;input.name=key;input.value=value;l.append(input);limits.append(l)}
  const limitSave=el('button','حفظ حدود الاستخدام','secondary');limitSave.type='submit';limits.append(limitSave);limits.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(limits));run(async()=>{await request('tenants/'+t.id+'/usage-limits','PUT',Object.fromEntries(Object.entries(d).map(([k,v])=>[k,Number(v)])));note('تم تحديث حدود الاستخدام');await reload()})};card.append(limits);list.append(card);
 });
}
$('platform-login-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;run(async()=>{const credentials=formData(form);const result=await request('auth/login','POST',credentials);token=result.token;$('platform-login').hidden=true;$('platform-workspace').hidden=false;form.reset();await reload();note('مرحبًا بمالك المنصة')})});
$('platform-create-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;run(async()=>{const result=await request('tenants','POST',formData(form));$('platform-invite-link').value=location.origin+'/join.html#owner.'+result.ownerInviteToken;$('platform-invite-result').hidden=false;form.reset();await reload();note('تم إنشاء الشركة. رابط دعوة المالك متاح للنسخ الآن.')})});
$('platform-copy').onclick=()=>run(async()=>{await navigator.clipboard.writeText($('platform-invite-link').value);note('تم نسخ رابط التفعيل')});
$('platform-refresh').onclick=()=>run(reload);
$('platform-logout').onclick=()=>run(async()=>{await request('auth/logout','POST');token='';$('platform-workspace').hidden=true;$('platform-login').hidden=false;note('تم تسجيل الخروج')});