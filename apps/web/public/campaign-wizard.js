/** Draft-only campaign authoring. Existing server validation and launch review stay authoritative. */
export function installCampaignWizard({form,el,button,templates}){
 if(form.wizard)return form.wizard;
 const fields=['name','tag','field','value','startAt'].map(name=>form.elements[name].closest('label'));
 const messages=form.querySelector('#campaign-steps'),add=form.querySelector('#campaign-add-step'),save=form.querySelector('button.primary');
 form.elements.tag.pattern='[a-z][a-z0-9_]{0,39}';form.elements.field.pattern='[a-z][a-z0-9_]{0,39}';form.elements.value.maxLength=160;
 const titles=['القناة والاسم','الجمهور','محتوى الرسائل','الموعد والمراجعة'];
 const progress=el('ol',undefined,'campaign-progress');progress.setAttribute('aria-label','خطوات إعداد الحملة');
 const heading=el('h3'),panels=titles.map(()=>el('section',undefined,'campaign-wizard-panel'));
 panels[0].append(el('p','واتساب — قوالب معتمدة فقط. ربط الحساب وموافقات العملاء تُراجع قبل بدء الإرسال.'),fields[0]);
 panels[1].append(el('p','اترك الفلاتر فارغة لاختيار كل العملاء. لن تشمل المراجعة النهائية إلا الموافقين والمتاحين للتواصل.'),fields[1],fields[2],fields[3]);
 panels[2].append(el('p','اختر قالبًا معتمدًا واملأ قيمه. يمكنك إضافة متابعة لاحقة؛ لن يُرسل شيء عند الحفظ.'),messages,add);
 const summary=el('div',undefined,'campaign-draft-summary');summary.setAttribute('aria-live','polite');
 panels[3].append(fields[4],summary,save);
 const nav=el('div',undefined,'campaign-wizard-actions');let index=0;
 const previous=button('السابق',()=>show(index-1),'secondary'),next=button('التالي',()=>{if(valid(index))show(index+1)},'secondary');
 nav.append(previous,next);form.prepend(progress,heading,...panels,nav);
 function valid(step){
  for(const input of panels[step].querySelectorAll('input,select,textarea'))if(!input.reportValidity())return false;
  if(step===1&&Boolean(form.elements.field.value.trim())!==Boolean(form.elements.value.value.trim())){form.elements[form.elements.field.value.trim()?'value':'field'].focus();summary.textContent='اكتب اسم الحقل وقيمته معًا.';panels[1].append(summary);return false}
  if(step===2){let previous=-1440;for(const input of messages.querySelectorAll('[data-offset]')){input.setCustomValidity(Number(input.value)-previous<1440?'اترك 24 ساعة على الأقل بين الرسائل.':'');previous=Number(input.value);if(!input.reportValidity()){input.oninput=()=>input.setCustomValidity('');return false}}}
  return true;
 }
 function review(){
  panels[3].insertBefore(summary,save);summary.replaceChildren(el('h4','ملخص المسودة'),el('p',form.elements.name.value),el('p',form.elements.tag.value?'تصنيف الجمهور: '+form.elements.tag.value:'كل التصنيفات — مع تطبيق الموافقة عند المراجعة'));
  if(form.elements.field.value)summary.append(el('p','شرط الجمهور: '+form.elements.field.value+' = '+form.elements.value.value));
  for(const field of messages.querySelectorAll('fieldset')){
   const template=templates().find(t=>t.id===field.querySelector('[data-template]').value);
   summary.append(el('h4',template?.name||'لم يُحدد قالب'));
   for(const part of template?.components||[])if(part.text){let text=part.text;for(const input of field.querySelectorAll('[data-kind="'+part.type.toLowerCase()+'"]'))text=text.replaceAll('{{'+(Number(input.dataset.index)+1)+'}}',input.value);summary.append(el('p',text))}
   summary.append(el('p','بعد '+field.querySelector('[data-offset]').value+' دقيقة من موعد البداية'));
  }
  summary.append(el('p','حفظ مسودة فقط. راجع عدد العملاء والاستبعادات وحالة الحساب من بطاقة الحملة قبل البدء.'));
 }
 function show(step){index=Math.max(0,Math.min(3,step));panels.forEach((p,i)=>p.hidden=i!==index);progress.replaceChildren();titles.forEach((title,i)=>{const item=el('li',String(i+1)+' · '+title);if(i===index)item.setAttribute('aria-current','step');progress.append(item)});heading.textContent=titles[index];previous.hidden=index===0;next.hidden=index===3;if(index===3)review();heading.tabIndex=-1;heading.focus()}
 // Hidden steps still participate in final validation; return to the first invalid step.
 form.addEventListener('invalid',event=>{const step=panels.findIndex(p=>p.contains(event.target));if(step>=0&&step!==index)show(step)},true);
 form.addEventListener('submit',event=>{if(index!==3){event.preventDefault();event.stopImmediatePropagation();if(valid(index))show(index+1)}},true);
 form.addEventListener('reset',()=>queueMicrotask(()=>show(0)));
 form.wizard={show};show(0);return form.wizard;
}
