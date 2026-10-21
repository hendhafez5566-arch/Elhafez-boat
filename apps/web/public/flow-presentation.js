/** Presentation metadata only. Channel execution and validation remain server-owned. */
export const componentGroups=[
 ['الرسائل والمحتوى',['TEXT','BUTTONS','LIST','CARD','GALLERY','MEDIA','LINK','CATALOG']],
 ['جمع البيانات والمنطق',['INPUT','QUESTION','CONDITION','KEYWORD','CONSENT','SET_FIELD','TAG']],
 ['الإجراءات والتكاملات',['HANDOFF','CRM_ACTION','DELAY','BUSINESS_HOURS','CONTROL','GOAL','RANDOMIZER','SUBFLOW','CONNECTOR','WEBHOOK','AI','END']]
];
const descriptions={TEXT:'ابدأ برسالة ترحيب أو تفاصيل الخدمة',BUTTONS:'حتى ٣ اختيارات واضحة للعميل',LIST:'اعرض قائمة خدمات قابلة للاختيار',INPUT:'اسأل وسجّل الإجابة في حقل',QUESTION:'سؤال سريع لمتابعة المحادثة',CONDITION:'وجّه العميل حسب قواعد AND / OR',CARD:'صورة ووصف وأزرار في بطاقة',GALLERY:'مجموعة بطاقات يمكن تصفحها',MEDIA:'صورة أو فيديو أو ملف أو صوت',LINK:'افتح رابطًا آمنًا للخدمة',HANDOFF:'سلّم المحادثة للفريق المختص',DELAY:'انتظر ثم أكمل في الوقت المناسب',AI:'اقتراحات Mock؛ تحتاج مزودًا مؤهلًا',WEBHOOK:'طلب آمن بمسارات نجاح وخطأ',CONNECTOR:'مزامنة بيانات عبر موصل معتمد',CONSENT:'اطلب موافقة العميل بوضوح',END:'اختم المحادثة برسالة مناسبة'};
const paths={TEXT:'M4 4h16v12H9l-5 4z M8 8h8 M8 12h5',BUTTONS:'M3 4h18v7H3z M3 15h8v5H3z M15 15h6v5h-6z',LIST:'M8 5h13 M8 12h13 M8 19h13 M3 5h1 M3 12h1 M3 19h1',INPUT:'M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h4',CONDITION:'M12 3l9 9-9 9-9-9z M8 12h8',HANDOFF:'M4 13v-2a8 8 0 0 1 16 0v2 M2 12h4v7H2z M18 12h4v7h-4z M20 19v2h-6',MEDIA:'M3 4h18v16H3z M3 16l6-6 6 6 3-3 3 3 M16 8h1',CARD:'M4 3h16v18H4z M4 12h16 M8 16h8',GALLERY:'M3 6h13v15H3z M8 3h13v15 M6 11h7 M6 15h5',DELAY:'M12 7v6l4 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',START:'M8 4l12 8-12 8z',END:'M6 6h12v12H6z',LINK:'M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-3 3 M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l3-3',AI:'M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3z'};
export function componentMeta(kind){return {description:descriptions[kind]||'إعداد خطوة متقدمة داخل المسار',tone:['START','END','CONSENT'].includes(kind)?'green':['CONDITION','KEYWORD','RANDOMIZER','BUSINESS_HOURS'].includes(kind)?'amber':['INPUT','QUESTION','SET_FIELD','TAG'].includes(kind)?'blue':['HANDOFF','CONTROL','CRM_ACTION'].includes(kind)?'rose':['CONNECTOR','WEBHOOK','AI','SUBFLOW','DELAY'].includes(kind)?'teal':'violet'};}
export function componentIcon(kind){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',paths[kind]||'M5 4h14v16H5z M8 9h8 M8 14h8');svg.append(path);return svg;}
export function componentTile(kind,title,onChoose){const b=document.createElement('button');b.type='button';b.className='builder-quick-item';b.dataset.kind=kind;b.dataset.tone=componentMeta(kind).tone;b.setAttribute('aria-label','إضافة '+title);b.onclick=onChoose;b.draggable=true;b.ondragstart=e=>{e.dataTransfer?.setData('application/x-boat-block',kind);if(e.dataTransfer)e.dataTransfer.effectAllowed='copy'};const icon=document.createElement('span');icon.className='builder-quick-symbol';icon.append(componentIcon(kind));const copy=document.createElement('span'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=title;small.textContent=componentMeta(kind).description;copy.append(strong,small);b.append(icon,copy);return b;}
/** Recompose existing controls, retaining listeners, labels and all advanced capabilities. */
export function composeInspector(host,node,flow){
 const make=(tag,copy,cls)=>{const n=document.createElement(tag);if(copy)n.textContent=copy;if(cls)n.className=cls;return n};
 const heading=host.querySelector(':scope>h3');if(heading){const icon=make('span',null,'builder-inspector-icon');icon.dataset.tone=componentMeta(node.type).tone;icon.append(componentIcon(node.type));heading.prepend(icon);}
 const disclosure=(title,cls)=>{const d=make('details',null,cls);d.append(make('summary',title));return d};
 const advanced=disclosure('إعدادات متقدمة','builder-editor-advanced');
 const sample=host.querySelector(':scope>.builder-step-sample');if(sample){const preview=disclosure('معاينة شكل الرسالة','builder-message-preview');preview.append(sample);host.append(preview)}
 for(const child of [...host.children]){
  if(child.classList.contains('builder-developer')||child.querySelector(':scope>details.builder-localization')||child.matches('section')&&child.querySelector('summary')?.textContent.includes('عربي'))advanced.append(child);
  else if(child.matches('label')&&child.querySelector(':scope>span')?.textContent==='نوع الخطوة')advanced.append(child);
  else if(child.matches('fieldset')&&child.querySelector('legend')?.textContent.includes('سياسة أخطاء'))advanced.append(child);
 }
 host.append(advanced);
 for(const area of host.querySelectorAll('textarea[data-template-editor]')){
  const shell=make('div',null,'builder-compose-shell');area.before(shell);shell.append(area);
  const footer=make('div',null,'builder-compose-tools'),count=make('small');
  const update=()=>count.textContent=area.value.length+' / '+(area.maxLength>0?area.maxLength:4096);update();area.addEventListener('input',update);
  const insert=value=>{const start=area.selectionStart,end=area.selectionEnd;if(area.maxLength>0&&area.value.length-(end-start)+value.length>area.maxLength)return;area.setRangeText(value,start,end,'end');area.dispatchEvent(new Event('input',{bubbles:true}));area.focus()};
  const emoji=make('button','☺');emoji.type='button';emoji.setAttribute('aria-label','إدراج ترحيب');emoji.onclick=()=>insert(' 👋');footer.append(emoji);
  const variables=disclosure('إدراج متغير','builder-compose-variables'),search=make('input');search.type='search';search.placeholder='ابحث عن متغير';search.setAttribute('aria-label','بحث متغيرات الرسالة');
  const list=make('div');const vars=flow.variables||[];const paint=()=>{list.replaceChildren();for(const v of vars.filter(v=>(v.key+' '+v.label).toLowerCase().includes(search.value.toLowerCase()))){const b=make('button',v.label+' · '+v.key);b.type='button';b.onclick=()=>{insert('{{'+v.key+'}}');variables.open=false};list.append(b)}if(!list.children.length)list.append(make('small',vars.length?'لا توجد نتائج':'أضف متغيرًا من إعدادات المسار؛ أو اكتب {{ لاقتراحات السياق.'))};search.oninput=paint;paint();variables.append(search,list);footer.append(variables,count);shell.append(footer);
 }
}
