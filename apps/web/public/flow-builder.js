/** Company-specific visual block editor, no industry assumptions or customer data. */
export function initFlowBuilder({state,api,notify,execute}){
 const $=id=>document.getElementById(id);
 const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n};
 const button=(text,action,klass='secondary')=>{const b=el('button',text,klass);b.type='button';b.onclick=action;return b};
 const idPattern=/^[a-z][a-z0-9_-]{0,31}$/;
 const types={START:'بداية',TEXT:'رسالة نصية',BUTTONS:'أزرار رد',LIST:'قائمة اختيارات',INPUT:'سؤال وتسجيل إجابة',CONDITION:'شرط',TAG:'تصنيف العميل',HANDOFF:'تحويل لموظف',END:'نهاية'};
 const deep=v=>JSON.parse(JSON.stringify(v));
 const preset=(industry='general')=>{
   const cards={general:['الخدمات','العروض'],shop:['المنتجات','الأسعار والمقاسات'],tourism:['البرامج','الأسعار والمواعيد'],clinic:['خدمات العيادة','ساعات العمل'],restaurant:['المنيو','فروع المطعم'],realestate:['العقارات','استفسار عن زيارة'],education:['الكورسات','مواعيد التسجيل']};
   const [a,b]=cards[industry]||cards.general;
   return {name:'مساعد العملاء',startId:'start',nodes:[
     {id:'start',type:'START',next:'welcome'},
     {id:'welcome',type:'TEXT',text:'أهلًا وسهلًا 👋 إزاي نقدر نساعدك؟',next:'menu'},
     {id:'menu',type:'BUTTONS',text:'اختار من القائمة:',choices:[{id:'products',title:a,next:'services'},{id:'prices',title:b,next:'prices'},{id:'agent',title:'موظف',next:'handoff'}]},
     {id:'services',type:'TEXT',text:'عدّل الرسالة دي وحط معلومات نشاطك المعتمدة.',next:'menu'},
     {id:'prices',type:'TEXT',text:'أضف تفاصيل الأسعار والعروض من بيانات شركتك فقط.',next:'menu'},
     {id:'handoff',type:'HANDOFF',text:'وصل طلبك للموظف المختص. هيكمل معاك.'}
   ]};
 };
 let flow=preset(),selected='menu',published=null,dirty=false;
 let preview={at:null,answers:{},tags:[]};
 const markDirty=()=>{dirty=true;renderStatus()};
 const nodeById=id=>flow.nodes.find(n=>n.id===id);
 const label=(title,control)=>{const wrap=el('label',undefined,'builder-field');wrap.append(el('span',title),control);return wrap};
 const control=(value,change,large=false)=>{
   const c=el(large?'textarea':'input');if(large)c.rows=3;c.value=String(value??'');c.addEventListener('input',()=>{change(c.value);markDirty()});return c;
 };
 const target=(value,change)=>{
   const s=el('select');for(const node of flow.nodes){const option=el('option',node.id+' — '+(types[node.type]||node.type));option.value=node.id;s.append(option)}
   s.value=value;s.addEventListener('change',()=>{change(s.value);markDirty();renderBlocks()});return s;
 };
 function renderBlocks(){
   const host=$('builder-nodes');host.replaceChildren();
   for(const node of flow.nodes){
     const card=el('button',undefined,'builder-node'+(selected===node.id?' selected':''));card.type='button';
     const head=el('div',undefined,'builder-node-head');head.append(el('strong',types[node.type]),el('small',node.id));card.append(head);
     let desc='';if('text'in node)desc=String(node.text);if(node.type==='CONDITION')desc='شرط على: '+node.field;
     if(node.type==='TAG')desc='تصنيف: '+node.tag;
     card.append(el('p',desc.slice(0,90)||'بداية المسار'));
     card.onclick=()=>{selected=node.id;renderBlocks();renderEditor()};host.append(card);
   }
 }
 function renderEditor(){
   const host=$('builder-editor');host.replaceChildren();const node=nodeById(selected);
   if(!node){host.append(el('p','اختار خطوة من القائمة'));return}
   host.append(el('h3',(types[node.type]||node.type)+' — '+node.id));
   host.append(label('معرّف الخطوة',control(node.id,value=>{
     if(!idPattern.test(value))return;
     const prior=node.id;node.id=value;
     if(flow.startId===prior)flow.startId=value;
     for(const n of flow.nodes){if('next'in n&&n.next===prior)n.next=value;
       if(n.type==='CONDITION'){if(n.yes===prior)n.yes=value;if(n.no===prior)n.no=value}
       if(n.type==='BUTTONS'||n.type==='LIST')for(const c of n.choices)if(c.next===prior)c.next=value;
     }
     selected=value;renderBlocks();
   })));
   const typeSelect=el('select');for(const [key,title] of Object.entries(types)){
     if(key==='START'&&node.type!=='START')continue;
     const option=el('option',title);option.value=key;typeSelect.append(option);
   }typeSelect.value=node.type;typeSelect.addEventListener('change',()=>{
     const pos=flow.nodes.indexOf(node);const next=flow.nodes.find(n=>n.id==='end')?.id||flow.startId;
     const generic={id:node.id,text:'اكتب محتوى الرسالة هنا',next};
     const kind=typeSelect.value;
     flow.nodes[pos]=kind==='START'?{id:node.id,type:'START',next}
       :kind==='CONDITION'?{id:node.id,type:'CONDITION',field:'interest',operator:'equals',value:'yes',yes:next,no:next}
       :kind==='BUTTONS'||kind==='LIST'?{id:node.id,type:kind,text:'اختار من القائمة:',choices:[{id:'option',title:'اختيار',next}]}
       :kind==='INPUT'?{id:node.id,type:'INPUT',text:'ما هي المعلومة التي نحتاجها؟',field:'customer_need',next}
       :kind==='TAG'?{id:node.id,type:'TAG',tag:'interested',next}
       :kind==='END'||kind==='HANDOFF'?{id:node.id,type:kind,text:kind==='END'?'شكرًا لتواصلك معانا.':'هحوّلك للموظف المسؤول.'}
       :{...generic,type:'TEXT'};
     markDirty();renderAll();
   });host.append(label('نوع الخطوة',typeSelect));
   if('text'in node)host.append(label(node.type==='INPUT'?'السؤال': 'نص الرسالة',control(node.text,value=>{node.text=value},true)));
   if('field'in node)host.append(label('اسم الحقل المخصص (بالإنجليزية)',control(node.field,value=>{node.field=value})));
   if(node.type==='TAG')host.append(label('التصنيف',control(node.tag,value=>{node.tag=value})));
   if(node.type==='CONDITION'){
     const ops=el('select');for(const [key,text] of [['equals','يساوي'],['contains','يحتوي على'],['exists','تم ملء الحقل']]){const o=el('option',text);o.value=key;ops.append(o)}ops.value=node.operator;
     ops.onchange=()=>{node.operator=ops.value;markDirty()};host.append(label('المقارنة',ops));
     host.append(label('القيمة',control(node.value||'',value=>{node.value=value})));
     host.append(label('لو الشرط صحيح',target(node.yes,value=>{node.yes=value})));
     host.append(label('لو الشرط غلط',target(node.no,value=>{node.no=value})));
   }
   if('next'in node)host.append(label('الخطوة التالية',target(node.next,value=>{node.next=value})));
   if(node.type==='BUTTONS'||node.type==='LIST'){
     if(node.type==='LIST')host.append(label('عنوان زر فتح القائمة',control(node.buttonText||'اختار',value=>{node.buttonText=value})));
     host.append(el('h4','الاختيارات والزراير'));
     for(const [i,choice] of node.choices.entries()){
       const block=el('div',undefined,'builder-choice');
       block.append(label('ID',control(choice.id,value=>{choice.id=value})),label('عنوان الزر',control(choice.title,value=>{choice.title=value})));
       if(node.type==='LIST')block.append(label('وصف قصير',control(choice.description||'',value=>{choice.description=value})));
       block.append(label('عند الضغط ينتقل إلى',target(choice.next,value=>{choice.next=value})));
       block.append(button('حذف الاختيار',()=>{node.choices.splice(i,1);markDirty();renderAll()},'danger'));
       host.append(block);
     }
     const limit=node.type==='BUTTONS'?3:10;
     host.append(button('إضافة اختيار',()=>{
       if(node.choices.length>=limit){notify('الحد الأقصى '+limit+' اختيارات لهذا النوع','error');return}
       let id='option'+(node.choices.length+1);while(node.choices.some(c=>c.id===id))id+='x';
       node.choices.push({id,title:'اختيار جديد',next:flow.nodes.at(-1).id});markDirty();renderAll();
     }));
   }
   if(node.type!=='START')host.append(button('حذف الخطوة',()=>{
     if(!confirm('هتتحذف الخطوة، ولازم تصلح أي روابط كانت رايحة لها قبل النشر.'))return;
     flow.nodes=flow.nodes.filter(n=>n!==node);selected=flow.startId;markDirty();renderAll();
   },'danger'));
 }
 function renderStatus(){
   $('builder-version').textContent=published?'الإصدار المنشور: '+published.version:'مفيش إصدار منشور لسه';
   $('builder-unsaved').textContent=dirty?'تعديلات غير محفوظة':'المسودة محفوظة أو جاهزة للتعديل';
 }
 function renderAll(){
   $('builder-name').value=flow.name;renderStatus();renderBlocks();renderEditor();
 }
 function addNode(type){
   let n=flow.nodes.length+1,id='step'+n;while(nodeById(id))id='step'+(++n);
   let next=flow.nodes.find(n=>n.type==='END'||n.type==='HANDOFF')?.id||flow.startId;
   if(type==='BUTTONS'||type==='LIST')flow.nodes.push({id,type,text:'اختار من القائمة:',choices:[{id:'option',title:'اختيار',next}]});
   else if(type==='INPUT')flow.nodes.push({id,type,text:'اكتب إجابتك من فضلك',field:'answer_'+n,next});
   else if(type==='CONDITION')flow.nodes.push({id,type,field:'answer_'+n,operator:'exists',yes:next,no:next});
   else if(type==='TAG')flow.nodes.push({id,type,tag:'interested',next});
   else if(type==='HANDOFF'||type==='END')flow.nodes.push({id,type,text:type==='HANDOFF'?'هحوّل كلامك لموظف يساعدك.':'شكرًا لتواصلك معانا.'});
   else flow.nodes.push({id,type:'TEXT',text:'اكتب رسالة للعميل هنا',next});
   selected=id;markDirty();renderAll();
 }
 function bubble(message,side='bot'){
   const item=el('div',message,'builder-bubble '+side);$('builder-preview').append(item);
 }
 function previewAdvance(input){
   const map=new Map(flow.nodes.map(x=>[x.id,x]));let id=preview.at??flow.startId;
   $('builder-preview-options').replaceChildren();
   const current=map.get(id);
   if(preview.at&&current?.type==='INPUT'){
     if(!input)return;
     preview.answers[current.field]=input;bubble(input,'customer');id=current.next;
   }else if(preview.at&&(current?.type==='BUTTONS'||current?.type==='LIST')){
     if(!input)return;
     const choice=current.choices.find(x=>x.id===input);
     if(!choice)return;
     bubble(choice.title,'customer');id=choice.next;
   }
   for(let steps=0;steps<30;steps++){
     const node=map.get(id);if(!node){bubble('الرابط مش صحيح: '+id);return}
     if(node.type==='START'||node.type==='TAG'||node.type==='TEXT'){
       if(node.type==='TEXT')bubble(node.text);
       if(node.type==='TAG'&&!preview.tags.includes(node.tag))preview.tags.push(node.tag);
       id=node.next;continue;
     }
     if(node.type==='CONDITION'){
       const v=preview.answers[node.field]||'';
       id=(node.operator==='exists'?Boolean(v):node.operator==='equals'?v.toLowerCase()===String(node.value||'').toLowerCase():v.toLowerCase().includes(String(node.value||'').toLowerCase()))?node.yes:node.no;continue;
     }
     if(node.type==='INPUT'){
       bubble(node.text);const form=el('form',undefined,'builder-preview-input');const inp=el('input');inp.required=true;inp.placeholder='رد العميل';
       const send=button('إرسال',()=>{if(!inp.value.trim())return;previewAdvance(inp.value.trim())},'primary');form.onsubmit=e=>{e.preventDefault();send.click()};form.append(inp,send);$('builder-preview-options').append(form);preview.at=id;return;
     }
     if(node.type==='BUTTONS'||node.type==='LIST'){
       bubble(node.text);for(const c of node.choices)$('builder-preview-options').append(button(c.title,()=>previewAdvance(c.id),'builder-option'));
       preview.at=id;return;
     }
     bubble(node.text);preview.at=id;return;
   }
   bubble('اتصال دائري في خطوات تلقائية — راجع تصميم المسار');
 }
 function resetPreview(){preview={at:null,answers:{},tags:[]};$('builder-preview').replaceChildren();$('builder-preview-options').replaceChildren();previewAdvance()}
 async function load(){
   if(state.demo){flow=preset('general');published=null;dirty=false;selected='menu';renderAll();resetPreview();return}
   const cfg=await api('/flows');flow=deep(cfg.draft.definition);published=cfg.published;dirty=false;selected=flow.startId;
   renderAll();resetPreview();
 }
 $('builder-load-preset').onclick=()=>{
   if(dirty&&!confirm('استبدال التعديلات غير المحفوظة بقالب جديد؟'))return;
   flow=preset($('builder-industry').value);selected='menu';markDirty();renderAll();resetPreview();
 };
 $('builder-add').onclick=()=>addNode($('builder-add-type').value);
 $('builder-name').addEventListener('input',()=>{flow.name=$('builder-name').value;markDirty()});
 $('builder-save').onclick=()=>execute(async()=>{
   if(state.demo){notify('وضع المعاينة فقط. تقدر تجرب المصمم من غير حفظ على الخادم.');return}
   const r=await api('/flows/draft',{method:'PUT',body:flow});flow=deep(r.definition);dirty=false;renderStatus();notify('تم حفظ مسودة المحادثة');
 });
 $('builder-publish').onclick=()=>execute(async()=>{
   if(state.demo){notify('المعاينة لا تنشر على واتساب','error');return}
   if(dirty){notify('احفظ المسودة الأول قبل النشر','error');return}
   if(!confirm('نشر الإصدار الحالي لعملاء الشركة على واتساب؟'))return;
   published=await api('/flows/publish',{method:'POST'});renderStatus();notify('تم نشر إصدار المحادثة. واتساب الحقيقي يحتاج رقم Meta متصل.');
 });
 $('builder-preview-reset').onclick=resetPreview;
 $('builder-export').onclick=()=>{
   const data=JSON.stringify(flow,null,2);navigator.clipboard?.writeText(data).then(()=>notify('تم نسخ المسار JSON')).catch(()=>notify('انسخ المسار من شاشة التحرير','error'));
 };
 return {load};
}