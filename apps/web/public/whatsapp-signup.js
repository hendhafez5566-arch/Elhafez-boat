/** Meta SDK stays dormant until an owner clicks the official connect button. */
export function parseSignupEvent(event){
 if(!['https://www.facebook.com','https://web.facebook.com','https://business.facebook.com'].includes(event.origin))return null;
 let d;try{d=typeof event.data==='string'?JSON.parse(event.data):event.data}catch{return null}
 if(!d||d.type!=='WA_EMBEDDED_SIGNUP'||!['FINISH','FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING','CANCEL','ERROR'].includes(d.event))return null;
 return d;
}
export function initWhatsAppSignup(ctx){
 const {api,el,button,notify,execute,state,$}=ctx;let cfg,attempt=null,code='',info=null,finishing=false,timer=null;
 const host=$('wa-self-service');
 async function sdk(appId,version){
  if(window.FB){window.FB.init({appId,version,cookie:false,xfbml:false});return window.FB}
  await new Promise((resolve,reject)=>{const existing=document.getElementById('meta-signup-sdk');if(existing)existing.remove();const script=document.createElement('script');script.id='meta-signup-sdk';script.src='https://connect.facebook.net/ar_AR/sdk.js';script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error('تعذر فتح Meta. اسمح بالنوافذ المنبثقة واتصال Meta ثم أعد المحاولة'));document.head.append(script)});
  if(!window.FB)throw new Error('تعذر تحميل نافذة Meta');window.FB.init({appId,version,cookie:false,xfbml:false});return window.FB;
 }
 const message=event=>{const data=parseSignupEvent(event);if(!attempt||!data)return;
  if(data.event==='CANCEL'||data.event==='ERROR'){cancel(data.event==='CANCEL'?'ألغيت الربط؛ يمكنك المحاولة لاحقًا':'لم يكتمل التفويض لدى Meta').catch(()=>{});return}
  if(attempt.mode==='COEXISTENCE'&&data.event!=='FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING')return;
  info=data.data||{};complete();
 };
 window.addEventListener('message',message);
 async function cancel(text='تم إلغاء الربط'){
  const a=attempt;attempt=null;code='';info=null;clearTimeout(timer);if(a)await api('/whatsapp/signup/cancel',{method:'POST',body:{attemptId:a.attemptId}}).catch(()=>{});notify(text);await load();
 }
 async function complete(selected){
  if(!attempt||finishing||(!selected&&(!code||!info?.waba_id)))return;
  finishing=true;try{
   const r=await api('/whatsapp/signup/complete',{method:'POST',body:{attemptId:attempt.attemptId,code:selected?undefined:code,wabaId:info.waba_id,phoneNumberId:selected||info.phone_number_id}});
   code='';if(r.requiresSelection){const pane=$('wa-choose-phone');pane.replaceChildren(el('h3','اختر رقم الشركة'));for(const p of r.phones)pane.append(button(p.displayPhone||'رقم من حساب الشركة',()=>complete(p.id)));return}
   attempt=null;clearTimeout(timer);notify(r.subscribed?'تم التفويض والتحقق من اشتراك التطبيق. أرسل رسالة اختبار من رقمك الآخر للتحقق من الاستقبال.':'تم التفويض؛ اشتراك Webhook يحتاج مراجعة. الاتصال الكامل لم يُثبت بعد.');await load();
  }catch(e){code='';notify(e.message,'error');attempt=null;clearTimeout(timer);await load()}finally{finishing=false}
 }
 async function launch(mode){
  if(attempt)return notify('عملية ربط جارية؛ أكملها أو ألغها أولًا','error');
  const f=await sdk(cfg.appId,cfg.version);attempt=await api('/whatsapp/signup/start',{method:'POST',body:{mode}});info=null;code='';
  timer=setTimeout(()=>cancel('انتهت مهلة الربط؛ افتح عملية جديدة'),600000);
  notify('أكمل التفويض واختيار حساب شركتك داخل نافذة Meta');
  const pane=$('wa-choose-phone');pane.replaceChildren(el('p','جاهز لفتح نافذة Meta الرسمية. أكمل بنفسك اختيار الشركة والرقم.'));
  pane.append(button('متابعة في Meta',()=>{
  const a=attempt;f.login(response=>{
   if(attempt!==a)return;
   const value=response?.authResponse?.code;if(value){code=value;complete()}else cancel('لم تمنح التفويض؛ لم يُربط رقم جديد').catch(()=>{});
  },{config_id:a.configId,response_type:'code',override_default_response_type:true,extras:{setup:{},...(mode==='COEXISTENCE'?{featureType:'whatsapp_business_app_onboarding'}:{})}});
  }));
 }
 async function load(){
  if(!host)return;host.replaceChildren();cfg=await api('/whatsapp/signup/config');
  const intro=el('section',undefined,'panel');intro.append(el('h2','اربط واتساب شركتك بنفسك'),el('p','٣ خطوات: اختر الرقم ← أكمل Meta ← افحص الاتصال. كلمة المرور ورمز التحقق تُدخل داخل Meta فقط.'));
  const choices=el('div',undefined,'grid');
  for(const [mode,title,description,available] of [
   ['COEXISTENCE','عندي واتساب بيزنس على الموبايل','استمر في تطبيق WhatsApp Business واربط البوت بالرقم نفسه، إذا أكّد Meta أهليته.',cfg.coexistenceAvailable],
   ['CLOUD','عندي رقم جديد','جهّز رقمًا لاستخدام WhatsApp Cloud API الرسمي. Meta يتولى التحقق من ملكيتك.',cfg.cloudAvailable]]){
   const c=el('article',undefined,'card');c.append(el('h3',title),el('p',description));const b=button('الربط عبر Meta',()=>launch(mode),'primary');b.disabled=!available||state.role!=='OWNER';c.append(b);if(!available)c.append(el('p','بانتظار إعداد واعتماد تطبيق المنصة. هذا لا يعني أن رقمك غير مؤهل.'));choices.append(c);
  }
  intro.append(choices,button('إلغاء عملية الربط',()=>cancel()));host.append(intro);
  const select=el('div');select.id='wa-choose-phone';host.append(select);
  const rows=await api('/whatsapp/signup/accounts');
  if(!rows.length)host.append(el('p','لم تربط رقمًا بعد. لا توجد حاجة لإرسال Access Token إلى صاحب المنصة.'));
  for(const r of rows){
   const pane=el('article',undefined,'panel'),heading=el('h3',r.displayPhone||'رقم الشركة');if(r.displayPhone)heading.dir='ltr';pane.append(heading,el('p',r.mode==='COEXISTENCE'?'واتساب بيزنس + المنصة':r.mode==='CLOUD'?'Cloud API':'ربط تقني سابق'));
   const checks=el('ul');for(const label of [r.status==='DISABLED'?'الاتصال مفصول محليًا أو يحتاج إعادة تفويض':'اعتماد محفوظ — لا يثبت الاتصال الكامل',r.authorization==='REAUTH_REQUIRED'?'التفويض يحتاج التجديد':'التفويض: '+(r.authorization==='VERIFIED'?'تم التحقق سابقًا؛ افحصه الآن':'غير متحقق'),r.phonePlatform==='CLOUD_API'?'الرقم: Meta أكد منصة Cloud API':'الرقم: التهيئة تحتاج فحص',r.subscriptionVerifiedAt?'اشتراك التطبيق: تحقق سابقًا':'اشتراك التطبيق: يحتاج فحص',r.lastInboundAt?'استقبال آخر رسالة: '+new Date(r.lastInboundAt).toLocaleString('ar-EG'):'استقبال الرسائل: لم يُثبت بعد',r.workerSeenAt&&Date.now()-new Date(r.workerSeenAt).getTime()<120000?'Worker: نبض حديث':'Worker: لا يوجد نبض حديث',r.uncertain?'هناك رسائل مجهولة المصير؛ لا تعِد إرسالها تلقائيًا':'لا توجد رسائل مجهولة المصير مسجلة'])checks.append(el('li',label));pane.append(checks);for(const o of r.operations||[])pane.append(el('p',({history:'السجل السابق',smb_app_state_sync:'جهات الاتصال',register:'تهيئة الرقم'}[o.operation]||o.operation)+' — '+({PROCESSING:'طلب جارٍ؛ لا تكرره',REQUESTED:'طلب قُبل، لا يثبت اكتمال المزامنة أو الاتصال',UNCERTAIN:'نتيجة مجهولة؛ راجع Meta قبل أي إعادة'}[o.status]||o.status)));
   if(state.role==='OWNER'){
    pane.append(button('فحص الاتصال الآن',async()=>{const d=await api('/whatsapp/connection/'+r.id+'/diagnose',{method:'POST'});notify(d.verified?(d.subscribed?'الرقم والاشتراك صحيحان الآن؛ الاستقبال والتسليم يحتاجان رسالة فعلية':'الرقم صحيح؛ اشتراك التطبيق غير مؤكد'):'الرقم مفصول؛ أعد التفويض');await load()}),button('إعادة التفويض',()=>launch(r.mode==='COEXISTENCE'?'COEXISTENCE':'CLOUD')));
    if(r.status==='CONNECTED')pane.append(button('فصل من المنصة',async()=>{if(!confirm('إيقاف الربط محليًا؟ لا يحذف حساب WhatsApp Business. الرسائل الجاري إرسالها قد تصل، والمجهولة لا تُعاد.'))return;await api('/whatsapp/connection/'+r.id,{method:'DELETE'});await load()},'danger'));
    if(r.mode==='COEXISTENCE'&&r.status==='CONNECTED')for(const [operation,label] of [['smb_app_state_sync','مزامنة جهات الاتصال'],['history','استيراد السجل السابق']])pane.append(button(label,async()=>{if(!confirm('أوافق على استيراد بيانات شركتي المسموح بها من Meta. السجل السابق لا يشغل البوت. الطلب مرة واحدة ولا يُكرر عند غموض النتيجة.'))return;const d=await api('/whatsapp/signup/accounts/'+r.id+'/operation',{method:'POST',body:{operation,consent:true}});notify(d.status==='REQUESTED'?'استلم Meta طلب المزامنة؛ انتظر الأحداث':'نتيجة الطلب غير مؤكدة؛ راجع Meta قبل أي إعادة');await load()}));
    if(r.mode==='CLOUD'&&r.status==='CONNECTED'&&r.phonePlatform!=='CLOUD_API'){const form=el('form'),label=el('label','رمز حماية Cloud جديد (٦ أرقام، ليس OTP)'),pin=el('input');pin.type='password';pin.inputMode='numeric';pin.pattern='[0-9]{6}';pin.required=true;pin.autocomplete='off';label.append(pin);const b=el('button','تهيئة الرقم الجديد','secondary');b.type='submit';form.append(label,b);form.onsubmit=e=>{e.preventDefault();execute(async()=>{b.disabled=true;try{const d=await api('/whatsapp/signup/accounts/'+r.id+'/operation',{method:'POST',body:{operation:'register',pin:pin.value}});pin.value='';notify(d.status==='REQUESTED'?'تم قبول طلب التهيئة؛ افحص الرقم واختبر الاستقبال':'النتيجة غير مؤكدة؛ افحص Meta قبل التكرار')}finally{b.disabled=false;pin.value=''}})};pane.append(form)}
   }host.append(pane);
  }
 }
 return {load,reset(){attempt=null;code='';info=null;clearTimeout(timer);host?.replaceChildren()}};
}
