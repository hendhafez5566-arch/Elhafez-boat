import {mergeFlowDrafts,sameDraftValue} from './flow-merge.js';
import {createCanvas} from './flow-canvas.js';
import {graphOutputs} from './flow-geometry.js';
import {mountGuidedWizard} from './flow-onboarding.js';
/** Company-specific visual block editor, no industry assumptions or customer data. */
export function initFlowBuilder({state,api:baseApi,notify,execute}){
 const api=(path,options)=>{
  const scoped=state.botId&&(/^\/flows(?:\/(draft|publish|versions)(?:\/.*)?)?$/.test(path));
  return baseApi(scoped?'/bots/'+encodeURIComponent(state.botId)+path:path,options);
 };
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
 let mergeBase=null;
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
   selected=id;renderBlocks();renderEditor();showSelection();canvas.highlight(id);showInspector();
 },changed:()=>{markDirty();renderBlocks()},notify,addAfter:anchor=>openInsert(anchor)});
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

 // New visual studio structure; all runtime/editor IDs are preserved.
 const workspace=$('builder-nodes').closest('.builder-layout');
 const palette=$('builder-nodes').closest('.builder-column');
 const properties=$('builder-editor').closest('.builder-column');
 const simulator=$('builder-preview').closest('.builder-column');
 workspace.classList.add('builder-studio','palette-collapsed');
 palette.classList.add('builder-palette');palette.hidden=true;
 properties.classList.add('builder-properties');
 simulator.classList.add('builder-simulator');
 palette.querySelector('h3').textContent='مكتبة المكونات';
 const intro=el('p','اضغط لإضافة مكون، أو اسحبه إلى لوحة التصميم.','builder-hint');
 const quick=el('div',undefined,'builder-quick');
 const kinds=[['TEXT','✉'],['BUTTONS','☷'],['LIST','≡'],['INPUT','?'],['CONDITION','◇'],['CATALOG','▦'],['MEDIA','▣'],['HANDOFF','↗']];
 for(const [kind,symbol] of kinds){
   const item=button(types[kind],()=>addNode(kind),'builder-quick-item');
   item.draggable=true;item.setAttribute('aria-label','إضافة '+types[kind]);item.prepend(el('span',symbol,'builder-quick-symbol'));
   item.ondragstart=e=>{e.dataTransfer?.setData('application/x-boat-block',kind);if(e.dataTransfer)e.dataTransfer.effectAllowed='copy'};
   quick.append(item);
 }
 palette.querySelector('h3').after(intro,quick);
 const steps=el('details',undefined,'builder-steps-list');steps.open=true;
 steps.append(el('summary','خطوات المحادثة'),$('builder-nodes'));palette.append(steps);
 const more=el('details',undefined,'builder-more-list');
 more.append(el('summary','المزيد من المكونات'),palette.querySelector('.builder-toolbar'));palette.append(more);
 const stagePanel=el('section',undefined,'builder-stage');
 const stageHead=el('header',undefined,'builder-stage-head');
 stageHead.append(el('h3','مساحة تصميم المحادثة'),el('p','اضغط على الرسالة لتحريرها، أو اضغط + لإضافة خطوة داخل المسار.'));
 const actions=el('div',undefined,'builder-view-actions');
 const paletteToggle=button('إخفاء المكونات',()=>{palette.hidden=!palette.hidden;workspace.classList.toggle('palette-collapsed',palette.hidden);paletteToggle.textContent=palette.hidden?'إظهار المكونات':'إخفاء المكونات'});
 const focusToggle=button('ملء الشاشة',()=>{const on=document.body.classList.toggle('studio-focus');focusToggle.textContent=on?'إنهاء ملء الشاشة':'ملء الشاشة';stagePanel.scrollIntoView({block:'start'});requestAnimationFrame(()=>{window.scrollTo(0,0);canvas.focus(selected||flow.startId)})});
 const advancedView=el('details',undefined,'builder-view-advanced');
  advancedView.append(el('summary','أدوات العرض المتقدمة'));
  const advancedButtons=el('div',undefined,'actions');
  advancedButtons.append(button('إعادة العرض',()=>canvas.reset()),button('الخطوة المختارة',()=>canvas.focus(selected)));
  advancedView.append(advancedButtons);
  actions.append(paletteToggle,button('−',()=>canvas.zoomOut()),button('+',()=>canvas.zoomIn()),button('ملاءمة المخطط',()=>canvas.fit()),button('ترتيب تلقائي',()=>canvas.autoLayout()),button('تجربة المحادثة',()=>showSimulator(),'primary'),focusToggle);
 function setEditorMode(linear){
   workspace.classList.toggle('builder-linear-mode',linear);palette.hidden=!linear;workspace.classList.toggle('palette-collapsed',!linear);paletteToggle.disabled=linear;
   simpleMode.textContent=linear?'عرض المخطط المرئي':'عرض مبسط بالخطوات';
   if(state.botId)sessionStorage.setItem('eb-editor-mode:'+state.tenantId+':'+state.botId,linear?'simple':'canvas');
   if(linear){inspector.hidden=true;workspace.classList.remove('inspector-open')}
   else{canvas.draw();requestAnimationFrame(()=>canvas.fit())}
 }
 const simpleMode=button('عرض مبسط بالخطوات',()=>setEditorMode(!workspace.classList.contains('builder-linear-mode')),'secondary');
 simpleMode.classList.add('builder-mode-switch');
 actions.prepend(simpleMode);
 stageHead.append(actions,advancedView);
 const stageExtras=el('details',undefined,'builder-stage-extras');
 stageExtras.append(el('summary','أدوات المسار المتقدمة'),tools);
 stagePanel.append(stageHead,stageExtras,canvasHost);
 canvasHost.setAttribute('aria-label','لوحة تصميم المحادثات التفاعلية');
 canvasHost.addEventListener('dragover',e=>{
  if(e.dataTransfer&&Array.from(e.dataTransfer.types).includes('application/x-boat-block')){e.preventDefault();e.dataTransfer.dropEffect='copy'}
 });
 canvasHost.addEventListener('drop',e=>{
  const kind=e.dataTransfer?.getData('application/x-boat-block');
  if(!kinds.some(([type])=>type===kind))return;
  e.preventDefault();const at=canvas.coordinates(e.clientX,e.clientY);
  addNode(kind);flow.layout??={};flow.layout[selected]=at;markDirty();renderAll();
 });
 const inspector=el('aside',undefined,'builder-inspector');
 properties.querySelector('h3').textContent='خصائص الخطوة';
 simulator.querySelector('h3').textContent='تجربة المحادثة';
 inspector.append(properties);
 properties.prepend(button('إغلاق ×',()=>{inspector.hidden=true;workspace.classList.remove('inspector-open')}));
 inspector.hidden=true;
 function showInspector(){inspector.hidden=false;workspace.classList.add('inspector-open');if(state.botId)requestAnimationFrame(()=>canvas.focus(selected))}
 const simulatorDialog=el('dialog',undefined,'builder-preview-dialog');
 const simulatorHead=el('header',undefined,'builder-dialog-header');
 simulatorHead.append(el('strong','تجربة محادثة العميل — محاكاة وليست اتصالًا حقيقيًا'),button('إغلاق ×',()=>simulatorDialog.close()));
 const phoneShell=el('div',undefined,'builder-phone-shell');
 const phoneBar=el('div','Elhafez Boat · محادثة تجريبية','builder-phone-bar');
 phoneShell.append(phoneBar,simulator);
 simulatorDialog.append(simulatorHead,phoneShell);document.body.append(simulatorDialog);
 simulatorDialog.addEventListener('click',e=>{if(e.target===simulatorDialog)simulatorDialog.close()});
 function previewProblems(){
    const nodes=new Map(flow.nodes.map(n=>[n.id,n])),visited=new Set(),pending=[flow.startId],broken=[];
    while(pending.length){
      const id=pending.shift();if(visited.has(id))continue;
      const node=nodes.get(id);if(!node){broken.push(id);continue}
      visited.add(id);
      for(const edge of graphOutputs(node)){if(!nodes.has(edge.to))broken.push(node.id);else pending.push(edge.to)}
    }
    return {broken:[...new Set(broken)],disconnected:flow.nodes.filter(n=>!visited.has(n.id)).map(n=>n.id)};
  }
  function showSimulator(){
    if(simulatorDialog.showModal)simulatorDialog.showModal();else simulatorDialog.setAttribute('open','');
    const problems=previewProblems();
    if(!problems.broken.length&&!problems.disconnected.length){resetPreview();return}
    $('builder-preview').replaceChildren(el('p','المسار يحتاج إصلاحًا قبل التجربة. افتح الخطوة المبيّنة ووصلها بمسار المحادثة.','builder-preview-warning'));
    const host=$('builder-preview-options');host.replaceChildren();
    for(const id of [...problems.broken,...problems.disconnected].slice(0,12)){
      const n=flow.nodes.find(x=>x.id===id);
      host.append(button((problems.broken.includes(id)?'رابط غير صالح: ':'خطوة غير متصلة: ')+(n?.text||types[n?.type]||id).slice(0,65),()=>{
        simulatorDialog.close();selected=id;renderAll();canvas.focus(id);
      },'secondary'));
    }
  }
 const picker=el('dialog',undefined,'builder-component-dialog'),pickerHead=el('header',undefined,'builder-dialog-header');
 pickerHead.append(el('strong','أضف الخطوة التالية'),button('إغلاق ×',()=>picker.close()));
 const pickerSearch=el('input');pickerSearch.type='search';pickerSearch.placeholder='ابحث عن رسالة، زر، قائمة، شرط...';pickerSearch.setAttribute('aria-label','البحث عن المكونات');
 const pickerGrid=el('div',undefined,'builder-picker-grid');picker.append(pickerHead,pickerSearch,pickerGrid);document.body.append(picker);
 let insertAnchor=null;
 function paintPicker(){pickerGrid.replaceChildren();const q=pickerSearch.value.trim().toLowerCase();
   for(const [kind] of kinds.concat([['QUESTION'],['TAG'],['DELAY'],['LINK'],['AI'],['SUBFLOW'],['CONNECTOR'],['WEBHOOK'],['END']])){
     if(!types[kind].toLowerCase().includes(q)&&!kind.toLowerCase().includes(q))continue;
     pickerGrid.append(button(types[kind],()=>{const anchor=insertAnchor;picker.close();addNode(kind,anchor)},'builder-picker-item'));
   }
   if(!pickerGrid.children.length)pickerGrid.append(el('p','لا توجد مكونات مطابقة للبحث'));
 }
 function openInsert(anchor){insertAnchor=anchor;pickerSearch.value='';paintPicker();if(picker.showModal)picker.showModal();else picker.setAttribute('open','');pickerSearch.focus()}
 pickerSearch.oninput=paintPicker;
 const advanced=el('details',undefined,'builder-extras');
 advanced.append(el('summary','مكتبة الخطوات والمسارات المتقدمة'),linked,reuseHost);
 workspace.replaceChildren(palette,stagePanel,inspector);stageExtras.append(advanced);

 const markDirty=()=>{dirty=true;checkpoint();renderStatus()};
 const nodeById=id=>flow.nodes.find(n=>n.id===id);
 const label=(title,control)=>{const wrap=el('label',undefined,'builder-field');wrap.append(el('span',title),control);return wrap};
 const control=(value,change,large=false)=>{
   const c=el(large?'textarea':'input');if(large){c.rows=3;c.maxLength=4096}c.value=String(value??'');c.addEventListener('input',()=>{change(c.value);markDirty();canvas.draw();renderBlocks()});return c;
 };
 const target=(value,change)=>{
   const s=el('select');for(const node of flow.nodes){const option=el('option',(types[node.type]||'خطوة')+' — '+String(node.text||'').slice(0,28));option.value=node.id;s.append(option)}
   s.value=value;s.addEventListener('change',()=>{change(s.value);markDirty();renderBlocks();canvas.draw()});return s;
 };
 function renderBlocks(){
   const host=$('builder-nodes');host.replaceChildren();
   for(const node of flow.nodes){
     const card=el('button',undefined,'builder-node'+(selected===node.id?' selected':''));card.type='button';
     const head=el('div',undefined,'builder-node-head');head.append(el('strong',types[node.type]));card.append(head);
     let desc='';if('text'in node)desc=String(node.text);if(node.type==='CONDITION')desc='شرط على: '+node.field;
     if(node.type==='TAG')desc='تصنيف: '+node.tag;
     card.append(el('p',desc.slice(0,90)||'بداية المسار'));
     card.onclick=()=>{selected=node.id;selectedNodes=new Set([selected]);renderBlocks();renderEditor();canvas.highlight(selected);showInspector()};
     const row=el('article',undefined,'builder-step-row');row.dataset.stepId=node.id;row.append(card);
     const outputs=el('div',undefined,'builder-step-outputs');
     for(const output of graphOutputs(node)){
      const dest=nodeById(output.to),caption=(node.type==='BUTTONS'||node.type==='LIST'?'لما العميل يضغط «'+output.label+'»':node.type==='CONDITION'?'إذا كانت الإجابة '+output.label:'بعد هذه الخطوة');
      const branch=el('div',undefined,'builder-step-branch');branch.append(el('span',caption));
      if(dest)branch.append(button((types[dest.type]||'خطوة')+' — '+String(dest.text||'بداية المحادثة').slice(0,45),()=>{selected=dest.id;renderBlocks();renderEditor();showInspector()}));
      branch.append(button('إضافة خطوة هنا',()=>openInsert({nodeId:node.id,key:output.key})));outputs.append(branch);
     }
     if(!graphOutputs(node).length)outputs.append(el('small',node.type==='HANDOFF'?'يكمل الموظف المحادثة من صندوق الوارد.':'تنتهي المحادثة هنا.'));
     row.append(outputs);host.append(row);
   }
 }
 function renderEditor(){
   const host=$('builder-editor');host.replaceChildren();const node=nodeById(selected);
   if(!node){host.append(el('p','اختار خطوة من القائمة'));return}
   host.append(el('h3',types[node.type]||'خصائص الخطوة'));
   const developerSettings=el('details',undefined,'builder-developer');developerSettings.append(el('summary','إعدادات تقنية متقدمة'));
   developerSettings.append(label('معرّف الخطوة',control(node.id,value=>{
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
     if(kind===node.type)return;
     if(['BUTTONS','LIST'].includes(node.type)&&['BUTTONS','LIST'].includes(kind)){
       const capacity=kind==='BUTTONS'?3:10;
       if(node.choices.length>capacity&&!window.confirm('الأزرار تدعم 3 اختيارات فقط. سيتم حذف الزائد بعد التأكيد. هل تريد المتابعة؟')){
         typeSelect.value=node.type;return;
       }
       flow.nodes[pos]={...node,type:kind,choices:node.choices.slice(0,capacity)};
       markDirty();renderAll();return;
     }
     const hasContent=Boolean(node.text||node.choices?.length||node.field||node.tag||node.url);
     if(hasContent&&!window.confirm('تغيير نوع الخطوة سيعيد إعداد حقولها وقد يحذف المحتوى والوصلات غير المتوافقة. يمكنك التراجع. هل تريد المتابعة؟')){
       typeSelect.value=node.type;return;
     }
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
    const kind=el('select');for(const k of ['image','video','audio','document']){const o=el('option',({image:'صورة',video:'فيديو',audio:'صوت',document:'مستند'})[k]);o.value=k;kind.append(o)}kind.value=node.mediaKind;kind.onchange=()=>{node.mediaKind=kind.value;markDirty()};host.append(label('نوع الوسائط',kind),label('التعليق',control(node.caption||'',v=>{node.caption=v})));
   }

   if('text'in node)host.append(label(node.type==='INPUT'?'السؤال': 'نص الرسالة',control(node.text,value=>{node.text=value},true)));
   if('field'in node){
    const fields=el('select'),common={customer_name:'اسم العميل',customer_phone:'رقم الهاتف',customer_email:'البريد الإلكتروني',customer_city:'المدينة',customer_need:'احتياج العميل'};
    for(const [key,title] of Object.entries(common)){const option=el('option',title);option.value=key;fields.append(option)}
    for(const source of flow.nodes.filter(n=>(n.type==='INPUT'||n.type==='QUESTION')&&n.field&&!common[n.field])){common[source.field]='إجابة: '+String(source.text||source.field).slice(0,55);const option=el('option',common[source.field]);option.value=source.field;fields.append(option)}
    if(!common[node.field]){const option=el('option','حقل مخصص محفوظ');option.value=node.field;fields.append(option)}
    fields.value=node.field;fields.onchange=()=>{node.field=fields.value;markDirty();renderBlocks();canvas.draw()};
    host.append(label(node.type==='CONDITION'?'قارن إجابة العميل عن':'ما البيانات التي تجمعها؟',fields));
    developerSettings.append(label('معرّف حقل مخصص (للمتقدمين)',control(node.field,value=>{node.field=value})));
   }
   if(node.type==='TAG')host.append(label('التصنيف',control(node.tag,value=>{node.tag=value})));
   if(node.type==='CONDITION'){
     const ops=el('select');for(const [key,text] of [['equals','يساوي'],['contains','يحتوي على'],['exists','تم ملء الحقل']]){const o=el('option',text);o.value=key;ops.append(o)}ops.value=node.operator;
     const comparisonValue=label('الإجابة المطلوبة',control(node.value||'',value=>{node.value=value}));comparisonValue.hidden=node.operator==='exists';
     ops.onchange=()=>{node.operator=ops.value;comparisonValue.hidden=node.operator==='exists';markDirty()};host.append(label('المقارنة',ops),comparisonValue);
     host.append(el('p','اختر سؤالًا سابقًا؛ العميل ينتقل لمسار الإجابة المطابقة أو للمسار الآخر.','muted'));
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
   if('next'in node)developerSettings.append(label('الخطوة التالية',target(node.next,value=>{node.next=value})));
   if(node.type==='BUTTONS'||node.type==='LIST'){
     if(node.type==='LIST'){const listButton=control(node.buttonText||'اختار',value=>{node.buttonText=value});listButton.maxLength=20;host.append(label('عنوان زر فتح القائمة',listButton));}
     host.append(el('h4','الاختيارات والزراير'));
     for(const [i,choice] of node.choices.entries()){
       const block=el('div',undefined,'builder-choice');
       const titleInput=control(choice.title,value=>{choice.title=value});titleInput.maxLength=node.type==='BUTTONS'?20:24;
       titleInput.setAttribute('aria-label','عنوان الاختيار '+(i+1));
       block.append(el('strong','الاختيار '+(i+1),'builder-choice-heading'),label('عنوان الاختيار',titleInput));
       const advancedChoice=el('details',undefined,'builder-choice-advanced');advancedChoice.append(el('summary','وجهة الاختيار وإعداداته'));
       advancedChoice.append(label('معرّف الاختيار',control(choice.id,value=>{choice.id=value})));
       if(node.type==='LIST'){const description=control(choice.description||'',value=>{choice.description=value});description.maxLength=72;block.append(label('وصف قصير',description));}
       advancedChoice.append(label('عند الضغط ينتقل إلى',target(choice.next,value=>{choice.next=value})));
       block.append(button('إضافة رد لهذا الاختيار',()=>openInsert({nodeId:node.id,key:'choice:'+i})),advancedChoice);
       const moveChoice=(offset)=>{
         const other=i+offset;if(other<0||other>=node.choices.length)return;
         [node.choices[i],node.choices[other]]=[node.choices[other],node.choices[i]];markDirty();renderAll();
       };
       const reorder=el('div',undefined,'builder-choice-actions');
       const moveUp=button('↑ لأعلى',()=>moveChoice(-1));moveUp.disabled=i===0;
       const moveDown=button('↓ لأسفل',()=>moveChoice(1));moveDown.disabled=i===node.choices.length-1;
       reorder.append(moveUp,moveDown,button('حذف الاختيار',()=>{
         if(node.choices.length<=1){notify('لا يمكن حذف آخر اختيار. أضف اختيارًا آخر أولًا.','error');return;}
         node.choices.splice(i,1);markDirty();renderAll();
       },'danger'));block.append(reorder);
       host.append(block);
     }
     const limit=node.type==='BUTTONS'?3:10;
     host.append(button('إضافة اختيار',()=>{
       if(node.choices.length>=limit){notify('الحد الأقصى '+limit+' اختيارات لهذا النوع','error');return}
       let id='option'+(node.choices.length+1);while(node.choices.some(c=>c.id===id))id+='x';
       node.choices.push({id,title:'اختيار جديد',next:flow.nodes.at(-1).id});markDirty();renderAll();
     }));
   }

   // Visual-only preview: does not invoke the engine or transmit messages.
   const sample=el('section',undefined,'builder-step-sample');
   const paint=()=>{
     sample.replaceChildren(el('h4','شكل الرسالة للعميل'),el('p','معاينة تصميمية؛ ليست رسالة واتساب فعلية.','builder-sample-caption'));
     const screen=el('div',undefined,'builder-sample-screen');
     screen.append(el('div',String(node.text||node.caption||types[node.type]||'').trim(),'builder-sample-bubble'));
     if(node.type==='BUTTONS'||node.type==='LIST'){
       const choices=el('div',undefined,'builder-sample-choices');
       if(node.type==='LIST')choices.append(el('strong',node.buttonText||'عرض القائمة'));
       for(const choice of node.choices){const c=el('div',choice.title||'اختيار','builder-sample-choice');if(node.type==='LIST'&&choice.description)c.append(el('small',choice.description));choices.append(c)}
       screen.append(choices);
     }
     sample.append(screen);
   };
   paint();host.oninput=paint;host.prepend(sample);host.append(developerSettings);

   if(node.type!=='START')host.append(button('حذف الخطوة',()=>{
     const inbound=flow.nodes.filter(n=>n!==node&&(
       n.next===node.id||n.yes===node.id||n.no===node.id||
       (Array.isArray(n.choices)&&n.choices.some(c=>c.next===node.id))
     ));
     const options='next'in node?[node.next]:Array.isArray(node.choices)?node.choices.map(c=>c.next):
       ('yes'in node?[node.yes,node.no]:[]);
     const safe=options.length&&options.every(id=>id===options[0]&&id!==node.id)&&nodeById(options[0])?options[0]:null;
     if(inbound.length&&!safe){notify('هذه الخطوة متصلة بفروع أخرى. غيّر وجهة الفروع أولًا من لوحة التصميم قبل الحذف.','error');return;}
     if(!confirm(inbound.length?'حذف الخطوة وربط المسارات السابقة تلقائيًا بالخطوة التالية؟':'حذف الخطوة غير المرتبطة؟'))return;
     for(const parent of inbound){
       if(parent.next===node.id)parent.next=safe;
       if(parent.yes===node.id)parent.yes=safe;
       if(parent.no===node.id)parent.no=safe;
       for(const choice of parent.choices||[])if(choice.next===node.id)choice.next=safe;
     }
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
   $('builder-name').value=flow.name;renderStatus();renderBlocks();renderEditor();canvas.draw();canvas.highlight(selected);
 }
 function addNode(type,anchor=null){
   if(flow.nodes.length>=100){notify('وصلت للحد الأقصى 100 خطوة. احذف خطوة غير مستخدمة أولًا.','error');return;}
   if(anchor&&nodeById(anchor.key.startsWith('choice:')?nodeById(anchor.nodeId)?.choices?.[Number(anchor.key.split(':')[1])]?.next:nodeById(anchor.nodeId)?.[anchor.key])&&['END','HANDOFF'].includes(type)){notify('للحفاظ على المسار المتصل، أضف نهاية المحادثة بعد آخر خطوة بدل إدراجها وسط مسار موجود.','error');return;}
   const origin=anchor?nodeById(anchor.nodeId):null;
   let oldTarget=origin?(anchor.key.startsWith('choice:')?origin.choices?.[Number(anchor.key.split(':')[1])]?.next:origin[anchor.key]):null;
   let n=flow.nodes.length+1,id='step'+n;while(nodeById(id))id='step'+(++n);
   let next=flow.nodes.find(n=>n.type==='END'||n.type==='HANDOFF')?.id;
   if(!next&&!['END','HANDOFF'].includes(type)){
    let endId='finish';while(nodeById(endId))endId+='x';
    flow.nodes.push({id:endId,type:'END',text:'شكرًا لتواصلك معنا.'});next=endId;
   }
   next??=flow.startId;
   if(origin&&!nodeById(oldTarget))oldTarget=['END','HANDOFF'].includes(type)?null:next;
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
   if(origin){
     const inserted=flow.nodes.at(-1);
     if(anchor.key.startsWith('choice:')){const choice=origin.choices?.[Number(anchor.key.split(':')[1])];if(choice)choice.next=id;}
     else origin[anchor.key]=id;
     if('next'in inserted)inserted.next=oldTarget||next;
     if('yes'in inserted){inserted.yes=oldTarget;inserted.no=oldTarget;}
     if(Array.isArray(inserted.choices))for(const choice of inserted.choices)choice.next=oldTarget;
     const pos=flow.layout?.[origin.id]||{x:80,y:80};flow.layout??={};flow.layout[id]={x:Math.min(8700,pos.x+365),y:Math.min(9000,pos.y+315)};
   }
   selected=id;selectedNodes=new Set([selected]);markDirty();renderAll();showInspector();
 }
 function bubble(message,side='bot'){
   const item=el('div',message,'builder-bubble '+side);$('builder-preview').append(item);
 }
 let previewBusy=false;
  const isPhoneField=field=>/(^|_)phone$|^customer_phone$/.test(String(field||''));
  const normalizePhone=value=>String(value||'').replace(/[٠-٩۰-۹]/g,ch=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(ch):'۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))).trim();
  const phoneOk=value=>/^\+?[0-9]{8,15}$/.test(normalizePhone(value));
  function previewEmployee(){
    $('builder-preview-options').replaceChildren();bubble('تم تحويل المحادثة إلى موظف. هذه محاكاة فقط؛ لم تُرسل أي رسالة خارجية.');
    $('builder-preview-options').append(button('بدء المحادثة من الأول',resetPreview,'secondary'));
  }
  function inputWithHandoff(form,field){
    const input=form.querySelector('input');
    if(isPhoneField(field)){
      input.type='tel';input.inputMode='tel';input.placeholder='مثال: 01012345678 أو +201012345678';
      input.addEventListener('input',()=>input.setCustomValidity(''));
      form.addEventListener('submit',event=>{if(!phoneOk(input.value)){event.preventDefault();event.stopImmediatePropagation();input.setCustomValidity('اكتب رقم هاتف صحيح من 8 إلى 15 رقمًا بدون حروف');input.reportValidity()}},true);
    }
    $('builder-preview-options').append(button('التحدث مع موظف',previewEmployee,'secondary'));
  }
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
    const form=el('form',undefined,'builder-preview-input'),inp=el('input'),send=el('button','إرسال','primary');inp.required=true;send.type='submit';form.append(inp,send);form.onsubmit=e=>{e.preventDefault();execute(()=>serverPreview(isPhoneField(at.field)?normalizePhone(inp.value):inp.value.trim()))};$('builder-preview-options').append(form);inputWithHandoff(form,at.field);
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
     if(isPhoneField(current.field)&&!phoneOk(input)){bubble('اكتب رقم هاتف صحيح من 8 إلى 15 رقمًا بدون حروف');return}
      preview.answers[current.field]=isPhoneField(current.field)?normalizePhone(input):input;bubble(input,'customer');id=current.next;
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
       const send=button('إرسال',()=>{if(!inp.value.trim())return;previewAdvance(inp.value.trim())},'primary');form.onsubmit=e=>{e.preventDefault();send.click()};form.append(inp,send);$('builder-preview-options').append(form);inputWithHandoff(form,node.field);preview.at=id;return;
     }
     if(node.type==='BUTTONS'||node.type==='LIST'){
       bubble(node.text);for(const c of node.choices)$('builder-preview-options').append(button(c.title,()=>previewAdvance(c.id),'builder-option'));
       preview.at=id;return;
     }
     bubble(node.text||'هذه الخطوة تحتاج معاينة الخادم بعد تسجيل الدخول.');preview.at=id;return;
   }
   bubble('اتصال دائري في خطوات تلقائية — راجع تصميم المسار');
 }
 function resetPreview(){previewRuntimeNodes=null;preview={at:null,answers:{},tags:[]};$('builder-preview').replaceChildren();$('builder-preview-options').replaceChildren();if(flow.nodes.length===1){bubble('ابدأ من علامة + لإضافة أول رسالة، ثم جرّب المحادثة هنا.');return;}previewAdvance()}
 async function load(){
   document.body.classList.toggle('bot-studio',Boolean(state.botId));
   // Navigating to the catalog or company dashboard must not silently discard
   // a just-generated bot or changes to a linked subflow. Explicit save is required.
   if(dirty){
     renderAll();
     notify('المسار فيه تعديلات غير محفوظة. راجعها واحفظ المسودة قبل التنقل أو النشر.');
     return;
   }
   editingSubflowId=null;mainSnapshot=null;mode.textContent='تحرير المسار الرئيسي';await refreshSubflows();
   if(state.demo){flow=preset('general');published=null;dirty=false;selected='menu';selectedNodes=new Set([selected]);snippets=[];redrawSnippets();renderAll();resetPreview();return}
   const cfg=await api('/flows');$('page-title').textContent=state.botName?'أتمتة: '+state.botName:'مصمم المحادثات';flow=deep(cfg.draft.definition);mergeBase=deep(flow);published=cfg.published;draftRevision=cfg.draft.draftRevision;dirty=false;selected=flow.startId;
   selectedNodes=new Set([selected]);history=[deep(flow)];cursor=0;await loadSnippets();renderAll();setEditorMode((state.editorMode||sessionStorage.getItem('eb-editor-mode:'+state.tenantId+':'+state.botId))==='simple');requestAnimationFrame(()=>canvas.fit());resetPreview();
 }
 const guideHost=el('div',undefined,'boat-guide-mount');
 const primaryBar=$('builder-industry').closest('.builder-toolbar');
 const studioBack=button('← إدارة البوتات',()=>document.dispatchEvent(new Event('boat-open-bots')),'secondary');studioBack.classList.add('bot-studio-back');primaryBar.prepend(studioBack);
 const presetOptions=el('details',undefined,'builder-preset-disclosure');
 presetOptions.append(el('summary','القوالب الجاهزة (اختياري)'),$('builder-industry').closest('label'),$('builder-load-preset'));
 const guideDisclosure=el('details',undefined,'builder-guide-disclosure');
 guideDisclosure.append(el('summary','إنشاء بوت جديد خطوة بخطوة'),presetOptions,guideHost);
 primaryBar.after(guideDisclosure);
 const guideLaunch=button('إنشاء بوت جديد بالمعالج',()=>{guideDisclosure.open=true;guide.open();guideHost.scrollIntoView({block:'start',behavior:'smooth'})},'secondary');
 primaryBar.prepend(guideLaunch);
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
     guideDisclosure.open=false;workspace.scrollIntoView({block:'start',behavior:'smooth'});
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
 // Preserve local edits whenever optimistic concurrency reports a newer server draft.
 const backupLocal=()=>{
   const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),draftRevision,definition:flow},null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=el('a');
   link.href=url;link.download='elhafez-boat-my-draft-'+Date.now()+'.json';
   document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
   notify('تم تنزيل نسخة احتياطية من التعديلات المحلية؛ لم يتم نشر أي شيء.');
 };
 const conflictDialog=el('dialog',undefined,'builder-conflict-dialog');
 document.body.append(conflictDialog);
 const closeConflict=()=>{if(conflictDialog.open)conflictDialog.close()};
 const compareDrafts=(local,remote)=>{
   const oldNodes=new Map((remote?.nodes||[]).map(n=>[n.id,n])),newNodes=new Map((local?.nodes||[]).map(n=>[n.id,n]));
   const added=[...newNodes.keys()].filter(id=>!oldNodes.has(id));
   const removed=[...oldNodes.keys()].filter(id=>!newNodes.has(id));
   const changed=[...newNodes.keys()].filter(id=>oldNodes.has(id)&&!sameDraftValue(newNodes.get(id),oldNodes.get(id)));
   return {added,removed,changed};
 };
 async function showDraftConflict(){
   const requestScope={tenantId:state.tenantId,botId:state.botId,revision:draftRevision,local:JSON.stringify(flow)};
   conflictDialog.replaceChildren();
   conflictDialog.append(el('h3','فيه مسودة أحدث على الخادم'),el('p','تعديلاتك المحلية ما زالت موجودة في المحرر. لن نكتب فوق النسخة الأحدث بدون موافقتك. نزّل نسخة من شغلك قبل اتخاذ أي قرار.'));
   let current=null;
   try{
     current=await api('/flows');
     if(state.tenantId!==requestScope.tenantId||state.botId!==requestScope.botId||draftRevision!==requestScope.revision||JSON.stringify(flow)!==requestScope.local)return;
     const diff=compareDrafts(flow,current.draft.definition);
     const text=['خطوات عندك ليست في الخادم: '+diff.added.length,'خطوات بالخادم ليست عندك: '+diff.removed.length,'خطوات مختلفة: '+diff.changed.length];
     conflictDialog.append(el('p',text.join(' • ')),el('p','يمكنك مراجعة التعديلات أدناه قبل جمعها في المحرر.'));
   }catch{conflictDialog.append(el('p','تعذرت قراءة أحدث نسخة؛ ما زالت تعديلاتك المحلية محفوظة داخل الصفحة.'))}
   if(current&&mergeBase){
     const choices={},local=deep(flow),base=deep(mergeBase),remote=deep(current.draft.definition);
     const scope={tenantId:state.tenantId,botId:state.botId,revision:draftRevision,local:JSON.stringify(flow)};
     const mergeHost=el('section',undefined,'builder-merge-review');
     const feedback=el('p');feedback.setAttribute('role','status');
     const fieldNames={text:'نص الرسالة',name:'اسم المسار',next:'الخطوة التالية',choices:'الاختيارات ومساراتها',field:'الإجابة المسجلة',type:'نوع الخطوة',yes:'مسار المطابقة',no:'المسار الآخر',value:'قيمة المقارنة',operator:'المقارنة',url:'الرابط',layout:'مواضع الخطوات',groups:'المجموعات',startId:'بداية المحادثة',caption:'التعليق',tag:'التصنيف'};
     const describe=path=>{const node=path[0]==='nodes'?[...local.nodes,...remote.nodes].find(n=>n.id===path[1]):null;return (node?(types[node.type]||'خطوة')+' «'+String(node.text||node.id).slice(0,55)+'» — ':'')+(fieldNames[path.at(-1)]||'إعداد الخطوة')};
     const valueText=value=>value===undefined?'محذوف':typeof value==='string'?value:JSON.stringify(value,null,2);
     const renderMerge=()=>{
       const result=mergeFlowDrafts(base,local,remote,choices);mergeHost.replaceChildren(el('h4','جمع التعديلات في مسودة للمراجعة'),el('p','التعديلات المستقلة تُجمع معًا. اختر النسخة المطلوبة لكل اختلاف؛ لن يُحفظ أو يُنشر شيء عند تطبيق المراجعة.'));
       for(const item of result.conflicts){
         const row=el('fieldset',undefined,'builder-merge-conflict');row.append(el('legend',describe(item.path)));
         const select=el('select');select.setAttribute('aria-label','حل اختلاف '+describe(item.path));
         for(const [value,title] of [['','اختر نسخة للاحتفاظ بها'],['local','تعديلاتي'],['remote','نسخة الخادم']]){const option=el('option',title);option.value=value;select.append(option)}
         select.value=choices[item.key]||'';select.onchange=()=>{choices[item.key]=select.value;apply.disabled=mergeFlowDrafts(base,local,remote,choices).unresolved>0};
         for(const [title,value] of [['تعديلاتي',item.local],['نسخة الخادم',item.remote]]){const details=el('details');details.append(el('summary',title),el('pre',valueText(value)));row.append(details)}
         row.append(select);mergeHost.append(row);
       }
       if(!result.conflicts.length)mergeHost.append(el('p','لا توجد تعديلات متعارضة؛ يمكن جمع العملين دون استبدال أحدهما.'));
       mergeHost.append(apply,feedback);apply.disabled=result.unresolved>0;
     };
     const apply=button('فحص وتطبيق المسودة المجمعة',()=>execute(async()=>{
       if(state.tenantId!==scope.tenantId||state.botId!==scope.botId||draftRevision!==scope.revision||JSON.stringify(flow)!==scope.local){feedback.textContent='تغيرت مساحة التحرير. أغلق المراجعة وحاول الحفظ مجددًا.';return}
       const result=mergeFlowDrafts(base,local,remote,choices);if(result.unresolved)return;
       apply.disabled=true;
       try{
         // Validate through the real compiler; broken cross-branch deletions never replace local work.
         const inspected=await api('/flows/inspect-draft',{method:'POST',body:result.definition});
         if(state.tenantId!==scope.tenantId||state.botId!==scope.botId||JSON.stringify(flow)!==scope.local)return;
         mergeBase=deep(remote);draftRevision=current.draft.draftRevision;published=current.published;
         flow=deep(result.definition);selected=flow.nodes.some(n=>n.id===selected)?selected:flow.startId;selectedNodes=new Set([selected]);
         history=[deep(local),deep(flow)];cursor=1;dirty=true;renderAll();resetPreview();closeConflict();notify(inspected.publishable?'جُمعت التعديلات داخل المحرر. راجعها ثم احفظ المسودة؛ لم يتم النشر.':'جُمعت مسودة غير مكتملة داخل المحرر. أكمل الوصلات وافحصها قبل النشر.');
       }catch(error){feedback.textContent='تعذر تطبيق الدمج: '+error.message+' — تعديلاتك المحلية لم تتغير.'}
       finally{apply.disabled=false}
     }),'primary');
     renderMerge();conflictDialog.append(mergeHost);
   }
   const actions=el('div',undefined,'builder-conflict-actions');
   actions.append(button('تنزيل نسختي JSON',backupLocal,'primary'));
   if(current)actions.append(button('تحميل نسخة الخادم بعد التأكيد',()=>{
     if(!confirm('سيتم استبدال التعديلات المحلية داخل المحرر. هل نزّلت نسخة احتياطية وتوافق على المتابعة؟'))return;
     const cfg=current;flow=deep(cfg.draft.definition);mergeBase=deep(flow);published=cfg.published;
     draftRevision=cfg.draft.draftRevision;dirty=false;selected=flow.startId;selectedNodes=new Set([selected]);
     history=[deep(flow)];cursor=0;renderAll();resetPreview();closeConflict();notify('تم تحميل آخر مسودة من الخادم دون نشر.');
   }));
   actions.append(button('العودة لتعديلاتي',closeConflict));
   conflictDialog.append(actions);
   if(conflictDialog.showModal)conflictDialog.showModal();else conflictDialog.setAttribute('open','');
 }
 const backupButton=button('تنزيل نسخة احتياطية',backupLocal);
 advancedButtons.append(backupButton);
 const importFile=el('input');importFile.type='file';importFile.accept='.json,application/json';importFile.hidden=true;importFile.setAttribute('aria-label','ملف نسخة المسودة');
 const importButton=button('استرجاع نسخة احتياطية',()=>{if(mainSnapshot){notify('ارجع للمسار الرئيسي قبل استرجاع نسخة','error');return}importFile.value='';importFile.click()});
 advancedButtons.append(importButton,importFile);
 importFile.onchange=()=>execute(async()=>{
   const file=importFile.files?.[0];if(!file)return;
   if(state.demo){notify('استرجاع الملفات يحتاج تسجيل الدخول وفحص الخادم','error');return}
   if(file.size>1048576)throw new Error('حجم النسخة يجب ألا يزيد عن 1 MiB');
   const scope={tenantId:state.tenantId,botId:state.botId,local:JSON.stringify(flow)};
   importButton.disabled=true;
   try{
     let parsed;try{parsed=JSON.parse(await file.text())}catch{throw new Error('تعذر قراءة الملف؛ اختر نسخة JSON صحيحة')}
     const definition=parsed?.definition||parsed;
     const inspected=await api('/flows/inspect-draft',{method:'POST',body:definition});
     if(state.tenantId!==scope.tenantId||state.botId!==scope.botId||JSON.stringify(flow)!==scope.local)throw new Error('تغيرت مساحة التحرير أثناء الفحص. اختر الملف مجددًا.');
     if(!confirm('استرجاع النسخة داخل المحرر سيستبدل تعديلاتك المحلية. لن تتغير مسودة الخادم أو النسخة المنشورة قبل الحفظ والنشر. هل تتابع؟'))return;
     const before=deep(flow);flow=deep(inspected.definition);selected=flow.startId;selectedNodes=new Set([selected]);history=[before,deep(flow)];cursor=1;dirty=true;renderAll();resetPreview();notify(inspected.publishable?'استُرجعت النسخة داخل المحرر بعد فحصها. راجعها ثم احفظ؛ لم يتم النشر.':'استُرجعت النسخة غير المكتملة. أكمل خطواتها ووصلاتها قبل النشر.');
   }finally{importButton.disabled=false;importFile.value=''}
 });

 $('builder-save').onclick=()=>execute(async()=>{
   if(state.demo){notify('وضع المعاينة فقط. تقدر تجرب المصمم من غير حفظ على الخادم.');return}
   if(mainSnapshot){const saved=await api('/flows/subflows',{method:'POST',body:{id:editingSubflowId||undefined,definition:flow}});editingSubflowId=saved.id;dirty=false;await refreshSubflows();renderStatus();notify('تم حفظ إصدار فرعي '+saved.version+'؛ المستدعون يظلون على الإصدار المثبت');return;}
   try{
     const r=await api('/flows/draft',{method:'PUT',body:{...flow,expectedRevision:draftRevision}});
     draftRevision=r.draftRevision;flow=deep(r.definition);mergeBase=deep(flow);dirty=false;renderStatus();notify('تم حفظ مسودة المحادثة');
   }catch(error){
     if(error.status===409){await showDraftConflict();return}
     throw error;
   }
 });
 $('builder-publish').onclick=()=>execute(async()=>{
   if(state.demo){notify('المعاينة لا تنشر على واتساب','error');return}
   if(mainSnapshot){notify('ارجع للمسار الرئيسي لنشره؛ المسارات الفرعية تُحفظ بإصدارات مستقلة','error');return;}
   if(dirty){notify('احفظ المسودة الأول قبل النشر','error');return}
   if(!confirm(state.botId?'نشر إصدار مستقل لهذا البوت؟ ربط القنوات يحتاج إعدادًا منفصلًا.':'نشر الإصدار الحالي للبوت الأساسي؟'))return;
   published=await api('/flows/publish',{method:'POST'});renderStatus();notify('تم نشر إصدار البوت. لا يعني ذلك ربط قناة أو إرسال رسالة حقيقية.');
 });
 $('builder-preview-reset').onclick=resetPreview;
 $('builder-export').onclick=()=>{
   const data=JSON.stringify(flow,null,2);navigator.clipboard?.writeText(data).then(()=>notify('تم نسخ المسار JSON')).catch(()=>notify('انسخ المسار من شاشة التحرير','error'));
 };
 window.addEventListener('keydown',event=>{
   if(state.page!=='flow-builder'||document.querySelector('dialog[open]'))return;
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();$('builder-save').click()}
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!event.target.closest('input,textarea,select,[contenteditable]')){event.preventDefault();[...tools.querySelectorAll('button')].find(b=>b.textContent===(event.shiftKey?'إعادة':'تراجع'))?.click()}
 });
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
 return {load,hasUnsavedChanges:()=>dirty,reset(){closeConflict();conflictDialog.replaceChildren();guide.reset();subflows=[];editingSubflowId=null;mainSnapshot=null;library.replaceChildren();mode.textContent='تحرير المسار الرئيسي';flow=preset();mergeBase=null;published=null;dirty=false;draftRevision=0;previewRuntimeNodes=null;selected=flow.startId;history=[deep(flow)];cursor=0;preview={at:null,answers:{},tags:[]};$('builder-preview').replaceChildren();$('builder-preview-options').replaceChildren();renderAll()}};
}