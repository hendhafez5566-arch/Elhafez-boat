import {createCanvas} from './flow-canvas.js';
import {mountGuidedWizard} from './flow-onboarding.js';
/** Company-specific visual block editor, no industry assumptions or customer data. */
export function initFlowBuilder({state,api,notify,execute}){
 const $=id=>document.getElementById(id);
 const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n};
 const button=(text,action,klass='secondary')=>{const b=el('button',text,klass);b.type='button';b.onclick=action;return b};
 const idPattern=/^[a-z][a-z0-9_-]{0,31}$/;
 const types={SUBFLOW:'مسار فرعي مرتبط',CONNECTOR:'مزامنة موصل أصلي',DELAY:'انتظار ثم استكمال',START:'بداية',WEBHOOK:'تكامل Webhook',CATALOG:'كتالوج معتمد',AI:'مساعد ذكي',KEYWORD:'كلمات مفتاحية',QUESTION:'سؤال',TEXT:'رسالة نصية',BUTTONS:'أزرار رد',LIST:'قائمة اختيارات',INPUT:'سؤال وتسجيل إجابة',CONDITION:'شرط',TAG:'تصنيف العميل',MEDIA:'صورة / فيديو / ملف',LINK:'رابط خارجي',HANDOFF:'تحويل لموظف',END:'نهاية'};
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
 let flow=preset(),selected='menu',published=null,dirty=false,draftRevision=0,previewRuntimeNodes=null;
 let subflows=[],editingSubflowId=null,mainSnapshot=null;
 let selectedNodes=new Set([selected]),snippets=[];
 let preview={at:null,answers:{},tags:[]};
 let history=[deep(flow)],cursor=0;
 function checkpoint(){const current=JSON.stringify(flow);if(JSON.stringify(history[cursor])===current)return;history=history.slice(0,cursor+1);history.push(deep(flow));if(history.length>80)history.shift();cursor=history.length-1}
 const canvasHost=el('div');$('builder-nodes').parentElement.before(canvasHost);
 const canvas=createCanvas({host:canvasHost,getFlow:()=>flow,select:(id,add=false)=>{
   if(add){if(selectedNodes.has(id))selectedNodes.delete(id);else selectedNodes.add(id);}
   else selectedNodes=new Set([id]);
   selected=id;renderEditor();showSelection();
 },changed:()=>{markDirty();renderBlocks()},notify});
 const tools=el('div',undefined,'builder-toolbar');canvasHost.before(tools);
 const selectionBadge=el('span','خطوة واحدة محددة','builder-selection');
 const showSelection=()=>{selectionBadge.textContent=selectedNodes.size+' خطوة محددة — Shift للاختيار المتعدد'};
 const groupButton=button('تجميع المحدد',()=>{
   if(selectedNodes.size<2){notify('اضغط Shift أثناء اختيار خطوتين أو أكثر في اللوحة','error');return;}
   const name=prompt('اسم المجموعة البصرية (لا يغير تشغيل البوت):');
   if(!name)return;
   if(name.trim().length<2||name.length>60){notify('اكتب اسمًا من 2 إلى 60 حرفًا','error');return;}
   const grouped=new Set((flow.groups||[]).flatMap(g=>g.nodeIds));
   if([...selectedNodes].some(id=>grouped.has(id))){notify('بعض الخطوات بالفعل داخل مجموعة أخرى','error');return;}
   flow.groups??=[];
   if(flow.groups.length>=20){notify('الحد الأقصى 20 مجموعة','error');return;}
   const id='group'+Date.now().toString(36);
   flow.groups.push({id,title:name.trim(),nodeIds:[...selectedNodes]});
   markDirty();renderAll();notify('تم تجميع الخطوات بصريًا؛ لن يتغير مسار المحادثة');
 });
 const ungroupButton=button('فك المجموعة',()=>{
   const group=(flow.groups||[]).find(g=>g.nodeIds.includes(selected));
   if(!group){notify('اختار خطوة ضمن مجموعة','error');return;}
   flow.groups=flow.groups.filter(g=>g!==group);
   markDirty();renderAll();
 });
 tools.append(selectionBadge,groupButton,ungroupButton);

 tools.append(button('فحص المسار',()=>execute(async()=>{if(state.demo){notify('فحص الخادم يتطلب تسجيل الدخول؛ المعاينة المحلية متاحة');return}await api('/flows/validate',{method:'POST',body:flow});notify('المسار صالح للنشر من ناحية البنية وحدود القناة')})),button('تراجع',()=>{if(cursor>0){flow=deep(history[--cursor]);dirty=true;renderAll()}}),button('إعادة',()=>{if(cursor<history.length-1){flow=deep(history[++cursor]);dirty=true;renderAll()}}),button('توسيط اللوحة',()=>canvas.reset()),button('نسخ الخطوة',()=>{
  const node=nodeById(selected);if(!node||node.type==='START')return;let id='copy'+Date.now().toString(36);const copy=deep(node);copy.id=id;flow.nodes.push(copy);selected=id;markDirty();renderAll();
 }),button('الإصدارات والتراجع',()=>execute(async()=>{
  if(state.demo){notify('الإصدارات متاحة بعد تسجيل الدخول');return}
  const versions=await api('/flows/versions');const panel=el('div',undefined,'builder-toolbar');
  for(const v of versions)panel.append(button('استعادة إصدار '+v.version,()=>execute(async()=>{
   if(!confirm('استعادة هذا الإصدار كنشر جديد؟ المحادثات الحالية تظل على إصدارها.'))return;
   await api('/flows/versions/'+v.version+'/rollback',{method:'POST'});panel.remove();await load();
  })));tools.after(panel);
 })));

 const linked=el('section',undefined,'builder-reuse'),library=el('select'),mode=el('p','تحرير المسار الرئيسي');
 linked.append(el('h4','مسارات فرعية مرتبطة بإصدارات مثبتة'),mode,library);
 async function refreshSubflows(){subflows=state.demo?[]:await api('/flows/subflows');library.replaceChildren();for(const f of subflows){const o=el('option',f.name+' — v'+f.version);o.value=f.id+':'+f.version;library.append(o)}}
 function enterSubflow(def,id=null){if(!mainSnapshot)mainSnapshot={flow:deep(flow),dirty,selected};flow=deep(def);editingSubflowId=id;selected=flow.startId;selectedNodes=new Set([selected]);history=[deep(flow)];cursor=0;dirty=true;mode.textContent='تحرير مسار فرعي — زر حفظ ينشئ إصدارًا مستقلًا؛ END يعود للمستدعي';renderAll();resetPreview()}
 linked.append(button('إنشاء مسار فرعي',()=>enterSubflow({name:'مسار فرعي جديد',startId:'start',nodes:[{id:'start',type:'START',next:'end'},{id:'end',type:'END',text:'تم استكمال الخطوات.'}]})),button('تحرير الإصدار المحدد',()=>{const f=subflows.find(x=>x.id+':'+x.version===library.value);if(f)enterSubflow(f.definition,f.id)}),button('إضافة استدعاء مرتبط',()=>{const f=subflows.find(x=>x.id+':'+x.version===library.value);if(!f)return;addNode('SUBFLOW');const n=nodeById(selected);n.subflowId=f.id;n.version=f.version;markDirty();renderAll()}),button('العودة للمسار الرئيسي',()=>{if(!mainSnapshot)return;if(dirty&&!confirm('ترك تعديلات المسار الفرعي غير المحفوظة؟'))return;flow=mainSnapshot.flow;dirty=mainSnapshot.dirty;selected=mainSnapshot.selected;editingSubflowId=null;mainSnapshot=null;selectedNodes=new Set([selected]);history=[deep(flow)];cursor=0;mode.textContent='تحرير المسار الرئيسي';renderAll();resetPreview()}));
 tools.after(linked);
 const reuseKinds=new Set(['TEXT','QUESTION','INPUT','TAG','MEDIA','LINK','DELAY','AI','WEBHOOK','CATALOG']);
 const reuseHost=el('section',undefined,'builder-reuse');
 reuseHost.append(el('h4','مكتبة خطوات قابلة لإعادة الاستخدام'),
  el('p','احفظ خطوات متتابعة ثم أدرج نسخة منها في أي محادثة. التعديل لا يغيّر الإصدارات المنشورة.'));
 const reuseFields=el('div',undefined,'builder-reuse-fields');
 const nameField=el('input');nameField.placeholder='اسم المجموعة المحفوظة';nameField.maxLength=80;
 const countField=el('input');countField.type='number';countField.min='1';countField.max='20';countField.value='1';
 const snippetSelect=el('select');
 const labelInput=(title,input)=>{const l=el('label');l.append(el('span',title),input);return l};
 reuseFields.append(labelInput('اسم القسم',nameField),labelInput('عدد الخطوات المتتابعة',countField),
  labelInput('اختار قسمًا محفوظًا',snippetSelect));
 const reuseActions=el('div',undefined,'builder-reuse-actions');
 const redrawSnippets=()=>{
  const selectedValue=snippetSelect.value;snippetSelect.replaceChildren();
  for(const item of snippets){const opt=el('option',item.name+' — '+item.definition.steps.length+' خطوة');opt.value=item.id;snippetSelect.append(opt)}
  if([...snippetSelect.options].some(x=>x.value===selectedValue))snippetSelect.value=selectedValue;
  if(!snippets.length){const none=el('option','لا توجد مجموعات محفوظة');none.value='';snippetSelect.append(none)}
 };
 async function loadSnippets(){
  snippets=state.demo?[]:await api('/flows/snippets');
  redrawSnippets();
 }
 const saveSnippet=button('حفظ سلسلة خطوات',()=>execute(async()=>{
   const count=Number(countField.value),name=nameField.value.trim();
   if(!Number.isInteger(count)||count<1||count>20||name.length<2||name.length>80)
    throw new Error('اسم من حرفين إلى 80، وعدد من خطوة واحدة إلى 20');
   const map=new Map(flow.nodes.map(node=>[node.id,node]));
   let id=selected;const seen=new Set(),steps=[];
   for(let i=0;i<count;i++){
    const n=map.get(id);
    if(!n||!reuseKinds.has(n.type)||!('next'in n)||seen.has(id))
     throw new Error('اختار خطوة متتابعة (ليست بداية أو نهاية أو تفرعًا) ثم عددًا صحيحًا من الخطوات');
    seen.add(id);steps.push(deep(n));id=n.next;
   }
   steps[steps.length-1].next='__exit__';
   const definition={name,steps};
   if(state.demo){
    snippets.unshift({id:'demo'+Date.now().toString(36),name,definition});
   }else{
    const created=await api('/flows/snippets',{method:'POST',body:definition});
    snippets.unshift(created);
   }
   redrawSnippets();
   notify('تم حفظ نسخة من الخطوات؛ الإصدارات المنشورة لم تتغير');
 }));
 const insertSaved=button('إدراج بعد المحدد',()=>{
  const item=snippets.find(s=>s.id===snippetSelect.value);
  if(!item){notify('احفظ أو اختار قسمًا أولًا','error');return}
  const anchor=flow.nodes.find(n=>n.id===selected);
  if(!anchor||!('next'in anchor)){notify('اختار خطوة لها مخرج «التالي»','error');return}
  const steps=item.definition.steps||[];
  if(flow.nodes.length+steps.length>100){notify('المسار تجاوز 100 خطوة','error');return}
  const occupied=new Set(flow.nodes.map(n=>n.id)),ids=new Map();let serial=1;
  for(const step of steps){let id;do{id='reuse'+serial++}while(occupied.has(id));occupied.add(id);ids.set(step.id,id)}
  const downstream=anchor.next;
  const copies=steps.map((step,i)=>{
   const copy=deep(step);copy.id=ids.get(step.id);
   copy.next=i===steps.length-1?downstream:ids.get(step.next);
   return copy;
  });
  if(!copies.length)return;
  anchor.next=copies[0].id;
  flow.nodes.push(...copies);
  if(flow.layout?.[selected]){
   const p=flow.layout[selected];for(const [i,n] of copies.entries()){
    flow.layout[n.id]={x:Math.min(9500,p.x+290*(i+1)),y:p.y};
   }
  }
  selected=copies[0].id;selectedNodes=new Set([selected]);markDirty();renderAll();resetPreview();
  notify('تم إدراج نسخة قابلة للتعديل. احفظ المسودة وانشرها لاحقًا عندما تكون جاهزًا');
 });
 const deleteSaved=button('حذف من المكتبة',()=>execute(async()=>{
  const item=snippets.find(s=>s.id===snippetSelect.value);
  if(!item)return;
  if(!confirm('حذف القسم المحفوظ من المكتبة؟ الخطوات الموجودة في مسوداتك لن تُحذف.'))return;
  if(!state.demo)await api('/flows/snippets/'+item.id,{method:'DELETE'});
  snippets=snippets.filter(s=>s.id!==item.id);redrawSnippets();
  notify('تم حذف المكتبة فقط دون تغيير المسارات أو الإصدارات المنشورة');
 }),'danger');
 reuseActions.append(saveSnippet,insertSaved,deleteSaved);
 reuseHost.append(reuseFields,reuseActions);
 tools.after(reuseHost);
 const markDirty=()=>{dirty=true;checkpoint();renderStatus()};
 const nodeById=id=>flow.nodes.find(n=>n.id===id);
 const label=(title,control)=>{const wrap=el('label',undefined,'builder-field');wrap.append(el('span',title),control);return wrap};
 const control=(value,change,large=false)=>{
   const c=el(large?'textarea':'input');if(large)c.rows=3;c.value=String(value??'');c.addEventListener('input',()=>{change(c.value);markDirty()});return c;
 };
 const target=(value,change)=>{
   const s=el('select');for(const node of flow.nodes){const option=el('option',node.id+' — '+(types[node.type]||node.type));option.value=node.id;s.append(option)}
   s.value=value;s.addEventListener('change',()=>{change(s.value);markDirty();renderBlocks();canvas.draw()});return s;
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
     if(flow.nodes.some(n=>n!==node&&n.id===value))return;const prior=node.id;node.id=value;if(flow.layout?.[prior]){flow.layout[value]=flow.layout[prior];delete flow.layout[prior]}
     if(flow.startId===prior)flow.startId=value;
     for(const group of flow.groups||[])group.nodeIds=group.nodeIds.map(id=>id===prior?value:id);
     if(selectedNodes.has(prior)){selectedNodes.delete(prior);selectedNodes.add(value)}

     for(const n of flow.nodes){if('next'in n&&n.next===prior)n.next=value;
       if(n.type==='CONDITION'||n.type==='KEYWORD'){if(n.yes===prior)n.yes=value;if(n.no===prior)n.no=value}
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
       :kind==='DELAY'?{id:node.id,type:kind,seconds:60,next}
       :kind==='SUBFLOW'?{id:node.id,type:kind,subflowId:'',version:1,bindings:{},next}
       :kind==='CONNECTOR'?{id:node.id,type:kind,connectorId:'',next}
       :kind==='WEBHOOK'?{id:node.id,type:kind,integrationId:'',next}
       :kind==='CATALOG'?{id:node.id,type:kind,category:'',next}
       :kind==='AI'?{id:node.id,type:kind,field:'customer_need',next}
       :kind==='KEYWORD'?{id:node.id,type:kind,keywords:['مهتم'],yes:next,no:next}
       :kind==='INPUT'||kind==='QUESTION'?{id:node.id,type:kind,text:'ما هي المعلومة التي نحتاجها؟',field:'customer_need',next}
       :kind==='TAG'?{id:node.id,type:'TAG',tag:'interested',next}
       :kind==='MEDIA'?{id:node.id,type:'MEDIA',mediaKind:'image',url:'https://example.com/image.jpg',caption:'',next}
       :kind==='LINK'?{id:node.id,type:'LINK',text:'تفاصيل إضافية',url:'https://example.com',next}
       :kind==='END'||kind==='HANDOFF'?{id:node.id,type:kind,text:kind==='END'?'شكرًا لتواصلك معانا.':'هحوّلك للموظف المسؤول.'}
       :{...generic,type:'TEXT'};
     markDirty();renderAll();
   });host.append(label('نوع الخطوة',typeSelect));
   if(node.type==='MEDIA'||node.type==='LINK')host.append(label('رابط HTTPS',control(node.url,v=>{node.url=v})));
   if(node.type==='MEDIA'){
    const kind=el('select');for(const k of ['image','video','audio','document']){const o=el('option',k);o.value=k;kind.append(o)}kind.value=node.mediaKind;kind.onchange=()=>{node.mediaKind=kind.value;markDirty()};host.append(label('نوع الوسائط',kind),label('التعليق',control(node.caption||'',v=>{node.caption=v})));
   }

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
   if(node.type==='DELAY')host.append(label('مدة الانتظار بالثواني (1 إلى 604800)',control(node.seconds,v=>{node.seconds=Number(v)})));
   if(node.type==='SUBFLOW'){host.append(label('معرف المسار الفرعي',control(node.subflowId,v=>{node.subflowId=v})),label('الإصدار المثبت',control(node.version,v=>{node.version=Number(v)})),label('ربط حقول الفرعي بحقول المستدعي — JSON',control(JSON.stringify(node.bindings||{}),v=>{try{node.bindings=JSON.parse(v)}catch{notify('ربط الحقول يجب أن يكون JSON صالحًا','error')}},true)));}
   if(node.type==='CONNECTOR')host.append(label('معرف الموصل من صفحة الموصلات الأصلية',control(node.connectorId,v=>{node.connectorId=v})));
   if(node.type==='WEBHOOK')host.append(label('معرف التكامل من الإعدادات',control(node.integrationId,v=>{node.integrationId=v})));
   if(node.type==='CATALOG')host.append(label('تصنيف الكتالوج (فارغ = الكل)',control(node.category||'',v=>{node.category=v})));
   if(node.type==='KEYWORD'){
    host.append(label('كلمات مفصولة بفاصلة',control(node.keywords.join(','),v=>{node.keywords=v.split(',').map(x=>x.trim()).filter(Boolean)})),label('عند التطابق',target(node.yes,v=>{node.yes=v})),label('بدون تطابق',target(node.no,v=>{node.no=v})));
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
     flow.nodes=flow.nodes.filter(n=>n!==node);
     if(flow.layout)delete flow.layout[node.id];
     flow.groups=(flow.groups||[]).map(g=>({...g,nodeIds:g.nodeIds.filter(id=>id!==node.id)})).filter(g=>g.nodeIds.length>=2);
     selected=flow.startId;selectedNodes=new Set([selected]);markDirty();renderAll();
   },'danger'));
 }
 function renderStatus(){
   $('builder-version').textContent=published?'الإصدار المنشور: '+published.version:'مفيش إصدار منشور لسه';
   $('builder-unsaved').textContent=dirty?'تعديلات غير محفوظة':'المسودة محفوظة أو جاهزة للتعديل';
 }
 function renderAll(){
   $('builder-name').value=flow.name;renderStatus();renderBlocks();renderEditor();canvas.draw();
 }
 function addNode(type){
   let n=flow.nodes.length+1,id='step'+n;while(nodeById(id))id='step'+(++n);
   let next=flow.nodes.find(n=>n.type==='END'||n.type==='HANDOFF')?.id||flow.startId;
   if(type==='BUTTONS'||type==='LIST')flow.nodes.push({id,type,text:'اختار من القائمة:',choices:[{id:'option',title:'اختيار',next}]});
   else if(type==='DELAY')flow.nodes.push({id,type,seconds:60,next});
   else if(type==='SUBFLOW')flow.nodes.push({id,type,subflowId:'',version:1,bindings:{},next});
   else if(type==='CONNECTOR')flow.nodes.push({id,type,connectorId:'',next});
   else if(type==='WEBHOOK')flow.nodes.push({id,type,integrationId:'',next});
   else if(type==='CATALOG')flow.nodes.push({id,type,category:'',next});
   else if(type==='AI')flow.nodes.push({id,type,field:'customer_need',next});
   else if(type==='KEYWORD')flow.nodes.push({id,type,keywords:['مهتم'],yes:next,no:next});
   else if(type==='INPUT'||type==='QUESTION')flow.nodes.push({id,type,text:'اكتب إجابتك من فضلك',field:'answer_'+n,next});
   else if(type==='CONDITION')flow.nodes.push({id,type,field:'answer_'+n,operator:'exists',yes:next,no:next});
   else if(type==='TAG')flow.nodes.push({id,type,tag:'interested',next});
   else if(type==='MEDIA')flow.nodes.push({id,type,mediaKind:'image',url:'https://example.com/image.jpg',caption:'',next});
   else if(type==='LINK')flow.nodes.push({id,type,text:'اعرف التفاصيل من الرابط',url:'https://example.com',next});
   else if(type==='HANDOFF'||type==='END')flow.nodes.push({id,type,text:type==='HANDOFF'?'هحوّل كلامك لموظف يساعدك.':'شكرًا لتواصلك معانا.'});
   else flow.nodes.push({id,type:'TEXT',text:'اكتب رسالة للعميل هنا',next});
   selected=id;markDirty();renderAll();
 }
 function bubble(message,side='bot'){
   const item=el('div',message,'builder-bubble '+side);$('builder-preview').append(item);
 }
 let previewBusy=false;
 async function serverPreview(input){
  if(previewBusy)return;previewBusy=true;
  try{
   const current=(previewRuntimeNodes||flow.nodes).find(n=>n.id===preview.at);const choice=current?.type==='BUTTONS'||current?.type==='LIST';
   const inbound=input?{kind:choice?'CHOICE':'TEXT',value:choice?'flow:'+current.id+':'+input:input}:undefined;
   const r=await api('/flows/preview',{method:'POST',body:{definition:flow,state:preview,input:inbound,...(previewRuntimeNodes?{runtimeNodes:previewRuntimeNodes}:{})}});
   if(input)bubble(choice?current.choices.find(c=>c.id===input)?.title||input:input,'customer');
   preview=r.state;previewRuntimeNodes=r.runtimeNodes;$('builder-preview-options').replaceChildren();
   for(const message of r.messages){
    bubble(message.text||('['+message.mediaKind+'] '+message.url));
    if(message.choices)for(const c of message.choices)$('builder-preview-options').append(button(c.title,()=>execute(()=>serverPreview(c.id)),'builder-option'));
   }
   if(r.waiting){bubble('انتظار '+r.waiting.seconds+' ثانية — معاينة فقط');$('builder-preview-options').append(button('استكمال التأخير في المعاينة',()=>{preview.at=r.waiting.next;execute(()=>serverPreview())},'secondary'))}
   const at=(previewRuntimeNodes||flow.nodes).find(n=>n.id===preview.at);
   if(at?.type==='INPUT'||at?.type==='QUESTION'){
    const form=el('form',undefined,'builder-preview-input'),inp=el('input'),send=el('button','إرسال','primary');inp.required=true;send.type='submit';form.append(inp,send);form.onsubmit=e=>{e.preventDefault();execute(()=>serverPreview(inp.value.trim()))};$('builder-preview-options').append(form);
   }
  }catch(e){notify(e.message,'error')}finally{previewBusy=false}
 }
 function previewAdvance(input){
   if(!state.demo){void serverPreview(input);return}

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
     if(node.type==='START'||node.type==='TAG'||node.type==='TEXT'||node.type==='MEDIA'||node.type==='LINK'){
       if(node.type==='TEXT')bubble(node.text);if(node.type==='LINK')bubble(node.text+'\n'+node.url);if(node.type==='MEDIA')bubble('['+node.mediaKind+'] '+node.url+(node.caption?'\n'+node.caption:''));
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
     bubble(node.text||'هذه الخطوة تحتاج معاينة الخادم بعد تسجيل الدخول.');preview.at=id;return;
   }
   bubble('اتصال دائري في خطوات تلقائية — راجع تصميم المسار');
 }
 function resetPreview(){previewRuntimeNodes=null;preview={at:null,answers:{},tags:[]};$('builder-preview').replaceChildren();$('builder-preview-options').replaceChildren();previewAdvance()}
 async function load(){
   // Navigating to the catalog or company dashboard must not silently discard
   // a just-generated bot or changes to a linked subflow. Explicit save is required.
   if(dirty){
     renderAll();
     notify('المسار فيه تعديلات غير محفوظة. راجعها واحفظ المسودة قبل التنقل أو النشر.');
     return;
   }
   editingSubflowId=null;mainSnapshot=null;mode.textContent='تحرير المسار الرئيسي';await refreshSubflows();
   if(state.demo){flow=preset('general');published=null;dirty=false;selected='menu';selectedNodes=new Set([selected]);snippets=[];redrawSnippets();renderAll();resetPreview();return}
   const cfg=await api('/flows');flow=deep(cfg.draft.definition);published=cfg.published;draftRevision=cfg.draft.draftRevision;dirty=false;selected=flow.startId;
   selectedNodes=new Set([selected]);history=[deep(flow)];cursor=0;await loadSnippets();renderAll();resetPreview();
 }
 const guideHost=el('div',undefined,'boat-guide-mount');
 $('builder-industry').closest('.builder-toolbar').before(guideHost);
 const guide=mountGuidedWizard({
   host:guideHost,
   isEditingSubflow:()=>Boolean(mainSnapshot),
   onNotice:(message,level)=>notify(message,level),
   onGenerate:draft=>{
     if((published||draftRevision||dirty)&&!confirm('تجهيز قالب جديد هيستبدل المسودة الحالية في شاشة التحرير فقط. الإصدار المنشور مش هيتغير إلا لو حفظت ونشرت بنفسك. نكمل؟'))return false;
     const previous=deep(flow);
     flow=deep(draft);
     selected='menu';selectedNodes=new Set([selected]);
     history=[previous];cursor=0;dirty=false;
     markDirty();renderAll();resetPreview();
     guideHost.scrollIntoView({block:'nearest',behavior:'smooth'});
     return true;
   }
 });
 $('builder-load-preset').onclick=()=>{
   if(dirty&&!confirm('استبدال التعديلات غير المحفوظة بقالب جديد؟'))return;
   flow=preset($('builder-industry').value);selected='menu';markDirty();renderAll();resetPreview();
 };
 for(const [key,title] of Object.entries(types))if(key!=='START'&&![...$('builder-add-type').options].some(o=>o.value===key)){const o=el('option',title);o.value=key;$('builder-add-type').append(o)}
 $('builder-add').onclick=()=>addNode($('builder-add-type').value);
 $('builder-name').addEventListener('input',()=>{flow.name=$('builder-name').value;markDirty()});
 $('builder-save').onclick=()=>execute(async()=>{
   if(state.demo){notify('وضع المعاينة فقط. تقدر تجرب المصمم من غير حفظ على الخادم.');return}
   if(mainSnapshot){const saved=await api('/flows/subflows',{method:'POST',body:{id:editingSubflowId||undefined,definition:flow}});editingSubflowId=saved.id;dirty=false;await refreshSubflows();renderStatus();notify('تم حفظ إصدار فرعي '+saved.version+'؛ المستدعون يظلون على الإصدار المثبت');return;}
   const r=await api('/flows/draft',{method:'PUT',body:{...flow,expectedRevision:draftRevision}});draftRevision=r.draftRevision;flow=deep(r.definition);dirty=false;renderStatus();notify('تم حفظ مسودة المحادثة');
 });
 $('builder-publish').onclick=()=>execute(async()=>{
   if(state.demo){notify('المعاينة لا تنشر على واتساب','error');return}
   if(mainSnapshot){notify('ارجع للمسار الرئيسي لنشره؛ المسارات الفرعية تُحفظ بإصدارات مستقلة','error');return;}
   if(dirty){notify('احفظ المسودة الأول قبل النشر','error');return}
   if(!confirm('نشر الإصدار الحالي لعملاء الشركة على واتساب؟'))return;
   published=await api('/flows/publish',{method:'POST'});renderStatus();notify('تم نشر إصدار المحادثة. واتساب الحقيقي يحتاج رقم Meta متصل.');
 });
 $('builder-preview-reset').onclick=resetPreview;
 $('builder-export').onclick=()=>{
   const data=JSON.stringify(flow,null,2);navigator.clipboard?.writeText(data).then(()=>notify('تم نسخ المسار JSON')).catch(()=>notify('انسخ المسار من شاشة التحرير','error'));
 };
 return {load,reset(){guide.reset();subflows=[];editingSubflowId=null;mainSnapshot=null;library.replaceChildren();mode.textContent='تحرير المسار الرئيسي';flow=preset();published=null;dirty=false;draftRevision=0;previewRuntimeNodes=null;selected=flow.startId;history=[deep(flow)];cursor=0;preview={at:null,answers:{},tags:[]};$('builder-preview').replaceChildren();$('builder-preview-options').replaceChildren();renderAll()}};
}