/** Novice setup creates an independent draft only after a server-validated review. */
export function mountBotSetup({host,api,el,button,notify,openBuilder,canStart,workspaceSetup=false}){
 const dialog=el('dialog',undefined,workspaceSetup?'company-setup-dialog':'bot-setup-dialog');dialog.setAttribute('aria-labelledby',workspaceSetup?'company-setup-title':'bot-setup-title');
 const heading=el('h2',workspaceSetup?'جهّز مساحة شركتك':'أنشئ مساعدك خطوة بخطوة');heading.id=workspaceSetup?'company-setup-title':'bot-setup-title';
 const progress=el('ol',undefined,'setup-progress'),form=el('form',undefined,workspaceSetup?'company-setup-form':'bot-setup-form'),body=el('div'),errors=el('p',undefined,'setup-error'),actions=el('div',undefined,'setup-actions');errors.setAttribute('role','alert');
 form.append(body,errors,actions);dialog.append(button('إغلاق',()=>dialog.close()),heading,progress,form);host.append(dialog);
 let templates=[],step=0,draft={},review=null,busy=false;
 const titles=['هدف البوت','اسم ورسالة الترحيب','قناة التواصل','راجع المسودة'];
 const field=(title,input)=>{const label=el('label',title);label.append(input);return label};
 function input(name,title,value,max,large=false){const control=el(large?'textarea':'input');control.name=name;control.value=value||'';control.required=true;control.maxLength=max;control.oninput=()=>{control.setCustomValidity(control.value.trim()?'':'اكتب قيمة غير فارغة');draft[name]=control.value;review=null};body.append(field(title,control));return control}
 function render(){
  progress.replaceChildren();titles.forEach((text,index)=>{const li=el('li',text,index===step?'active':'');if(index===step)li.setAttribute('aria-current','step');progress.append(li)});body.replaceChildren();actions.replaceChildren();errors.textContent='';
  if(step===0){const select=el('select');select.name='templateId';select.setAttribute('aria-label','هدف البوت');for(const t of templates){const option=el('option',t.name);option.value=t.id;select.append(option)}select.value=draft.templateId;select.onchange=()=>{draft.templateId=select.value;review=null;render()};body.append(field('ماذا تريد أن يفعل المساعد؟',select),el('p',templates.find(t=>t.id===draft.templateId)?.description||''));}
  if(step===1){input('name','اسم البوت',draft.name,100);input('businessName','اسم النشاط',draft.businessName,80);if(draft.templateId!=='blank'){input('greeting','رسالة الترحيب',draft.greeting,4096,true);const phone=el('input');phone.type='checkbox';phone.checked=draft.collectPhone;phone.onchange=()=>{draft.collectPhone=phone.checked;review=null};body.append(field('اجمع رقم الهاتف قبل التحويل للموظف',phone));}}
  if(step===2)body.append(el('h3','ابدأ بالتجربة دون ربط أي حساب'),el('p',(workspaceSetup?'سيُحفظ اسم النشاط لشركتك، وتُنشأ مسودة بوت مستقلة. ':'ستُنشأ مسودة مستقلة. ')+'ربط شات الموقع أو حساب رسمي يتم لاحقًا من قنوات البوت بعد مراجعة المحادثة. لن نسجل دخولًا إلى مزود ولن نرسل رسائل.'),el('p','يمكنك الرجوع وتعديل الإجابات قبل الإنشاء.'));
  if(step===3){body.append(el('h3',draft.name),el('p','مسودة فقط • دون قناة متصلة أو إرسال'));if(review){for(const n of review.definition.nodes){if(n.text)body.append(el('p',n.text,'setup-preview-bubble'));if(n.choices)body.append(el('p',n.choices.map(c=>c.title).join(' / ')));}if(review.definition.nodes.length===1)body.append(el('p','بداية فارغة: أضف أول رسالة من علامة +.'));}}
  if(step>0)actions.append(button('السابق',()=>{step--;render()}));
  const next=el('button',step===3?'إنشاء المسودة وفتح المحرر':workspaceSetup&&step===2?'مراجعة دون ربط قناة':'التالي','primary');next.type='submit';next.disabled=busy;actions.append(next);
  requestAnimationFrame(()=>body.querySelector('input,textarea,select')?.focus());
 }
 function payload(){return {...(workspaceSetup?{requestId:draft.requestId}:{}),name:draft.name,templateId:draft.templateId,setup:{businessName:draft.businessName,...(draft.templateId==='blank'?{}:{greeting:draft.greeting}),collectPhone:draft.collectPhone}}}
 form.onsubmit=async event=>{event.preventDefault();if(busy||!form.reportValidity())return;busy=true;actions.querySelector('[type=submit]').disabled=true;
  try{if(step===2){review=await api('/bots/templates/preview',{method:'POST',body:payload()});step++;render()}
   else if(step===3){if(!canStart()){errors.textContent='احفظ تعديلات البوت المفتوح أولًا؛ إجابات المعالج محفوظة هنا.';return}const bot=await api(workspaceSetup?'/workspace/setup':'/bots',{method:'POST',body:payload()});dialog.close();await openBuilder({...bot,editorMode:'simple'});notify('تم إنشاء مسودة مستقلة. جرّب المحادثة ثم احفظ تعديلاتك قبل النشر.');}
   else{step++;render()}
  }catch(error){errors.textContent=error.status===400?'راجع اسم البوت وبيانات النشاط ورسالة الترحيب.':error.status===403?'لا تسمح صلاحياتك أو حالة اشتراك الشركة بإنشاء بوت.':'تعذر إتمام الخطوة. احتفظنا بإجاباتك؛ حاول مجددًا بعد التأكد من الاتصال.'}finally{busy=false;const submit=actions.querySelector('[type=submit]');if(submit)submit.disabled=false;}
 };
 return {setTemplates(value){templates=value},start(templateId='service'){if(!canStart()){notify('احفظ تعديلات البوت الحالي قبل إنشاء بوت جديد.','error');return}draft={requestId:crypto.randomUUID(),templateId,name:'',businessName:'',greeting:'أهلًا وسهلًا! كيف نقدر نساعدك؟',collectPhone:true};step=0;review=null;render();dialog.showModal()}};
}
