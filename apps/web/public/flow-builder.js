import {mountFlowExperiments} from './flow-experiments.js';
import {withDraftSaveLock,draftMutation,forgetDraftMutation} from './draft-save-lock.js';
import {mountConversationControls,mountConversationOperations} from './flow-conversation-controls.js';
import {mountScheduledOperations} from './flow-scheduled-ops.js';
import {mountFlowAuthoring} from './flow-authoring.js';
import {createDraftRecovery} from './draft-recovery.js';
import {mountRequestOperations} from './flow-request-ops.js';
import {mountCards,mountEffects,renderGallery} from './flow-content-controls.js';
import {mountRequestControls} from './flow-request-controls.js';
import {mountFlowDiagnostics} from './flow-diagnostics.js';
import {mountFlowLabs} from './flow-labs.js';
import {mountRuntimeControls} from './flow-controls.js';
import {mergeFlowDrafts,sameDraftValue} from './flow-merge.js';
import {createCanvas} from './flow-canvas.js';
import {graphOutputs,setGraphOutput,arrangeFlow} from './flow-geometry.js';
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
 const types={CONTROL:'تشغيل وإيقاف البوت',CONSENT:'موافقة العميل',CARD:'بطاقة محتوى',GALLERY:'معرض بطاقات',CRM_ACTION:'إجراء CRM',BUSINESS_HOURS:'ساعات العمل',GOAL:'هدف التحويل',SET_FIELD:'تعيين قيمة حقل',RANDOMIZER:'توزيع عشوائي A/B',SUBFLOW:'مسار فرعي مرتبط',CONNECTOR:'مزامنة موصل أصلي',DELAY:'انتظار ثم استكمال',START:'بداية',WEBHOOK:'تكامل Webhook',CATALOG:'كتالوج معتمد',AI:'مساعد ذكي',KEYWORD:'كلمات مفتاحية',QUESTION:'سؤال',TEXT:'رسالة نصية',BUTTONS:'أزرار رد',LIST:'قائمة اختيارات',INPUT:'سؤال وتسجيل إجابة',CONDITION:'شرط',TAG:'تصنيف العميل',MEDIA:'صورة / فيديو / ملف',LINK:'رابط خارجي',HANDOFF:'تحويل لموظف',END:'نهاية'};
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
 let connectorChoices=[];
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
 },changed:()=>{markDirty();renderBlocks()},notify,getSelection:()=>selectedNodes,selectMany:ids=>{selectedNodes=new Set(ids);showSelection()},addAfter:anchor=>openInsert(anchor)});
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

 tools.append(button('فحص المسار',()=>execute(async()=>{if(state.demo){notify('فحص الخادم يتطلب تسجيل الدخول؛ المعاينة المحلية متاحة');return}await api('/flows/validate',{method:'POST',body:flow});notify('المسار صالح للنشر من ناحية البنية وحدود القناة')})),button('تراجع',()=>{if(cursor>0){flow=deep(history[--cursor]);dirty=true;saveState='تعديلات غير محفوظة';storeRecovery();renderAll()}}),button('إعادة',()=>{if(cursor<history.length-1){flow=deep(history[++cursor]);dirty=true;saveState='تعديلات غير محفوظة';storeRecovery();renderAll()}}),button('توسيط اللوحة',()=>canvas.reset()),button('نسخ الخطوة',()=>{copySelection();pasteSelection()}),button('الإصدارات والتراجع',()=>execute(async()=>{
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
    if(!n||!reuseKinds.has(n.type)||!('next'in n)||seen.has(id)||n.errorNext||n.request||Object.keys(n.policy||{}).some(k=>k.endsWith('Next')))
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
 const librarySearch=el('input');librarySearch.type='search';librarySearch.placeholder='ابحث عن مكون…';librarySearch.setAttribute('aria-label','بحث مكتبة المكونات');librarySearch.oninput=()=>{const q=librarySearch.value.trim().toLowerCase();for(const item of quick.children)item.hidden=!item.textContent.toLowerCase().includes(q)};palette.querySelector('h3').after(intro,librarySearch,quick);
 const steps=el('details',undefined,'builder-steps-list');steps.open=true;
 steps.append(el('summary','خطوات المحادثة'),$('builder-nodes'));palette.append(steps);
 const more=el('details',undefined,'builder-more-list');
 more.append(el('summary','المزيد من المكونات'),palette.querySelector('.builder-toolbar'));palette.append(more);
 const stagePanel=el('section',undefined,'builder-stage');
 const stageHead=el('header',undefined,'builder-stage-head');
 stageHead.append(el('h3','مساحة تصميم المحادثة'),el('p','اضغط على الرسالة لتحريرها، أو اضغط + لإضافة خطوة داخل المسار.'));
 const actions=el('div',undefined,'builder-view-actions');
 const paletteToggle=button('إظهار المكونات',()=>{palette.hidden=!palette.hidden;workspace.classList.toggle('palette-collapsed',palette.hidden);paletteToggle.textContent=palette.hidden?'إظهار المكونات':'إخفاء المكونات'});
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
 const graphSearch=el('input');graphSearch.type='search';graphSearch.className='builder-graph-search';graphSearch.placeholder='انتقل إلى خطوة…';graphSearch.setAttribute('aria-label','بحث المخطط بالاسم أو النص أو المعرف');
 const searchResults=el('div',undefined,'builder-search-results');searchResults.hidden=true;
 graphSearch.oninput=()=>{searchResults.replaceChildren();const q=graphSearch.value.trim().toLowerCase();searchResults.hidden=!q;if(!q)return;for(const n of flow.nodes.filter(n=>[n.id,n.label,n.text,types[n.type],n.field].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,12))searchResults.append(button((types[n.type]||n.type)+' · '+String(n.text||n.id).slice(0,40),()=>{selected=n.id;selectedNodes=new Set([selected]);renderEditor();canvas.highlight(selected);canvas.focus(selected);searchResults.hidden=true;showInspector()}))};
 stageHead.append(actions,graphSearch,searchResults,advancedView);
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
 function showInspector(){inspector.hidden=false;workspace.classList.add('inspector-open')}
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
   for(const [kind] of kinds.concat([['CONTROL'],['CONSENT'],['CARD'],['GALLERY'],['CRM_ACTION'],['BUSINESS_HOURS'],['GOAL'],['SET_FIELD'],['RANDOMIZER'],['QUESTION'],['TAG'],['DELAY'],['LINK'],['AI'],['SUBFLOW'],['CONNECTOR'],['WEBHOOK'],['END']])){
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

 let autosaveTimer=null,saving=false,saveState='';
 const recoveryKey=()=>state.tenantId&&state.userId?'eb-recovery:'+state.tenantId+':'+state.userId+':'+(state.botId||'default'):null;
 const recoveryScope=()=>({tenantId:state.tenantId,userId:state.userId,botId:state.botId});let lastRecoveryScope=null;
 const recoveryStore=createDraftRecovery({storage:{get length(){return localStorage.length},key:i=>localStorage.key(i),getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)}}),recoveryDialogs=new Set();
 function storeRecovery(){const key=recoveryKey();if(!key||mainSnapshot)return;const snapshot={revision:draftRevision,definition:flow,savedAt:new Date().toISOString()};try{sessionStorage.setItem(key,JSON.stringify(snapshot))}catch{saveState='تعذر الاسترداد المحلي؛ نزّل نسخة JSON'}if(retainRecovery.checked&&!recoveryStore.save(recoveryScope(),snapshot))saveState='تعذر الاحتفاظ بالمسودة على الجهاز؛ نزّل نسخة JSON';}
 function offerRecovery(){
  const key=recoveryKey(),scope=recoveryScope(),serialized=JSON.stringify(flow);if(!key)return;let session=null;try{session=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
  const choices=[],seen=new Set([serialized]);for(const record of [...(session?[{snapshot:session,session:true}]:[]),...recoveryStore.candidates(scope)]){const value=JSON.stringify(record.snapshot?.definition);if(record.snapshot?.definition&&Number.isInteger(record.snapshot.revision)&&!seen.has(value)){choices.push(record);seen.add(value)}}if(!choices.length)return;
  const dialog=el('dialog',undefined,'builder-conflict-dialog builder-recovery-dialog');dialog.setAttribute('aria-label','تعديلات محلية قابلة للاسترداد');dialog.append(el('h3','تعديلات محلية قابلة للاسترداد'),el('p','اختر نسخة للمراجعة. الاسترداد لا يحفظ ولا ينشر؛ الحفظ سيتحقق من تعارض الإصدار. النسخ على الجهاز اختيارية، معزولة بحسابك وشركتك، ونحتفظ بآخر 3 نسخ لمدة 7 أيام.'));recoveryDialogs.add(dialog);const close=()=>{dialog.close();dialog.remove();recoveryDialogs.delete(dialog)};dialog.addEventListener('close',()=>{dialog.remove();recoveryDialogs.delete(dialog)},{once:true});
  choices.forEach((record,index)=>{const date=new Date(record.snapshot.savedAt);dialog.append(el('p',(record.session?'نسخة هذه النافذة':'نسخة محفوظة على هذا الجهاز')+' · '+(Number.isFinite(date.getTime())?date.toLocaleString('ar-EG'):'وقت غير معروف')),button(index===0?'استرداد تعديلاتي':'استرداد نسخة أخرى '+(index+1),()=>execute(async()=>{if(key!==recoveryKey()||JSON.stringify(flow)!==serialized){close();return}const inspected=await api('/flows/inspect-draft',{method:'POST',body:record.snapshot.definition});if(key!==recoveryKey()||JSON.stringify(flow)!==serialized||!dialog.isConnected)return;const previous=deep(flow);mergeBase=deep(flow);flow=deep(inspected.definition);draftRevision=record.snapshot.revision;selected=flow.startId;selectedNodes=new Set([selected]);dirty=true;history=[previous,deep(flow)];cursor=1;storeRecovery();renderAll();close()}),'primary'))});
  dialog.append(button('استخدام الخادم',()=>{if(key===recoveryKey())sessionStorage.removeItem(key);close()}));document.body.append(dialog);dialog.showModal();
 }

 const markDirty=()=>{dirty=true;saveState='تعديلات غير محفوظة';checkpoint();storeRecovery();renderStatus();clearTimeout(autosaveTimer);if(autosave.checked)autosaveTimer=setTimeout(()=>{if(dirty&&!saving&&!conflictDialog.open)void saveDraft(true)},1200)};
 const autosave=el('input');autosave.type='checkbox';autosave.setAttribute('aria-label','حفظ تلقائي اختياري');autosave.onchange=()=>{if(autosave.checked&&dirty)markDirty()};advancedButtons.append(labelInput('حفظ تلقائي',autosave));
 const retainRecovery=el('input');retainRecovery.type='checkbox';retainRecovery.setAttribute('aria-label','استرداد بعد إغلاق المتصفح على هذا الجهاز');retainRecovery.onchange=()=>{if(!recoveryStore.setEnabled(recoveryScope(),retainRecovery.checked)){retainRecovery.checked=recoveryStore.enabled(recoveryScope());notify('تعذر تغيير الاحتفاظ المحلي. يمكنك تنزيل نسخة JSON.','error');return}if(retainRecovery.checked&&dirty)storeRecovery()};advancedButtons.append(labelInput('استرداد بعد إغلاق المتصفح — اختياري للجهاز الشخصي؛ يُمسح عند تسجيل الخروج',retainRecovery));
 window.addEventListener('storage',event=>{const scope=recoveryScope();if(!scope.tenantId||!scope.userId)return;retainRecovery.checked=recoveryStore.enabled(scope);const prefix='eb-persistent-draft-v1:'+encodeURIComponent(scope.tenantId)+':'+encodeURIComponent(scope.userId)+':'+encodeURIComponent(scope.botId||'default')+':';if(dirty&&event.key?.startsWith(prefix)){autosave.checked=false;clearTimeout(autosaveTimer);saveState='مسودة في نافذة أخرى؛ أوقفنا الحفظ التلقائي. راجع نسختك قبل الحفظ.';renderStatus()}});
 let copied=null;
 function copySelection(){const ids=new Set([...selectedNodes].filter(id=>nodeById(id)?.type!=='START'));copied={nodes:deep(flow.nodes.filter(n=>ids.has(n.id))),layout:deep(flow.layout||{})};notify('نُسخت '+copied.nodes.length+' خطوة داخل المحرر')}
 function pasteSelection(){if(!copied?.nodes.length)return;if(flow.nodes.length+copied.nodes.length>100){notify('حد المسار 100 خطوة','error');return}const used=new Set(flow.nodes.map(n=>n.id)),ids=new Map();let serial=1;for(const n of copied.nodes){let id;do{id='copy'+serial++}while(used.has(id));used.add(id);ids.set(n.id,id)}flow.layout??={};for(const n of deep(copied.nodes)){const old=n.id;n.id=ids.get(old);for(const output of graphOutputs(n)){const to=ids.get(output.to)||'';setGraphOutput(n,output.key,to)}flow.nodes.push(n);const pos=copied.layout[old]||{x:50,y:50};flow.layout[n.id]={x:Math.min(9600,pos.x+70),y:Math.min(9600,pos.y+70)}}selectedNodes=new Set(ids.values());selected=[...selectedNodes][0];markDirty();renderAll()}
 function deleteSelection(){const ids=new Set([...selectedNodes].filter(id=>nodeById(id)?.type!=='START'));if(!ids.size)return;flow.nodes=flow.nodes.filter(n=>!ids.has(n.id));for(const n of flow.nodes)for(const out of graphOutputs(n))if(ids.has(out.to)){setGraphOutput(n,out.key,'')}for(const id of ids)if(flow.layout)delete flow.layout[id];flow.groups=(flow.groups||[]).map(g=>({...g,nodeIds:g.nodeIds.filter(id=>!ids.has(id))})).filter(g=>g.nodeIds.length>=2);selected=flow.startId;selectedNodes=new Set([selected]);markDirty();renderAll()}
 function alignSelection(axis,distribute=false){const nodes=flow.nodes.filter(n=>selectedNodes.has(n.id));if(nodes.length<2)return;flow.layout??=arrangeFlow(flow);for(const n of nodes)flow.layout[n.id]??=arrangeFlow(flow)[n.id];nodes.sort((a,b)=>flow.layout[a.id][axis]-flow.layout[b.id][axis]);const min=flow.layout[nodes[0].id][axis],max=flow.layout[nodes.at(-1).id][axis];nodes.forEach((n,i)=>{flow.layout[n.id][axis]=distribute?Math.round(min+(max-min)*i/(nodes.length-1)):min});markDirty();renderAll()}
 tools.append(button('نسخ المحدد',copySelection),button('لصق',pasteSelection),button('تكرار المحدد',()=>{copySelection();pasteSelection()}),button('حذف المحدد',deleteSelection,'danger'),button('محاذاة أفقية',()=>alignSelection('y')),button('محاذاة رأسية',()=>alignSelection('x')),button('توزيع أفقي',()=>alignSelection('x',true)),button('توزيع رأسي',()=>alignSelection('y',true)));

 const nodeById=id=>flow.nodes.find(n=>n.id===id);
 const label=(title,control)=>{if(!control.hasAttribute('aria-label'))control.setAttribute('aria-label',title);const wrap=el('label',undefined,'builder-field');wrap.append(el('span',title),control);return wrap};
 const control=(value,change,large=false)=>{
   const c=el(large?'textarea':'input');if(large){c.rows=3;c.maxLength=4096}c.value=String(value??'');c.addEventListener('input',()=>{change(c.value);markDirty();canvas.draw();renderBlocks()});return c;
 };
 const target=(value,change,optional=false)=>{
   const s=el('select');if(optional){const blank=el('option','بدون مسار خطأ مخصص');blank.value='';s.append(blank)}for(const node of flow.nodes){const option=el('option',(types[node.type]||'خطوة')+' — '+String(node.text||'').slice(0,28));option.value=node.id;s.append(option)}
   s.value=value;s.addEventListener('change',()=>{change(s.value);markDirty();renderBlocks();canvas.draw()});return s;
 };
 const requestMocks={};
 const requestControls=mountRequestControls({el,button,label,control,target,changed:()=>{markDirty();canvas.draw()},repaint:()=>renderEditor(),getFlow:()=>flow,getMock:id=>requestMocks[id],setMock:(id,value)=>requestMocks[id]=value});
 const runtimeControls=mountRuntimeControls({el,button,label,control,target,changed:()=>{markDirty();canvas.draw()},repaint:()=>renderEditor(),getFlow:()=>flow});
 const conversationControls=mountConversationControls({el,button,label,control,target,changed:markDirty,repaint:renderEditor,runtimeControls,api:baseApi,execute});
 const variableHost=el('div');advanced.append(variableHost);runtimeControls.variables(variableHost);
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
   host.append(el('h3',types[node.type]||'خصائص الخطوة'),label('اسم الخطوة',control(node.label||'',v=>{if(v.trim())node.label=v;else delete node.label})));const note=el('details',undefined,'builder-developer');note.append(el('summary','ملاحظة داخلية — لا تُرسل للعميل'),label('ملاحظة للمراجعة',control(node.note||'',v=>{node.note=v},true)));
   const developerSettings=el('details',undefined,'builder-developer');developerSettings.append(el('summary','إعدادات تقنية متقدمة'));
   developerSettings.append(label('معرّف الخطوة',control(node.id,value=>{
     if(!idPattern.test(value))return;
     if(flow.nodes.some(n=>n!==node&&n.id===value))return;const prior=node.id;node.id=value;if(flow.layout?.[prior]){flow.layout[value]=flow.layout[prior];delete flow.layout[prior]}
     if(flow.startId===prior)flow.startId=value;
     for(const group of flow.groups||[])group.nodeIds=group.nodeIds.map(id=>id===prior?value:id);
     if(selectedNodes.has(prior)){selectedNodes.delete(prior);selectedNodes.add(value)}

     for(const n of flow.nodes)for(const output of graphOutputs(n))if(output.to===prior)setGraphOutput(n,output.key,value);
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
       :kind==='SET_FIELD'?{id:node.id,type:kind,field:'lead_status',value:'qualified',next}
       :kind==='RANDOMIZER'?{id:node.id,type:kind,choices:[{id:'a',title:'A',weight:50,next},{id:'b',title:'B',weight:50,next}]}
       :kind==='BUSINESS_HOURS'?{id:node.id,type:kind,schedule:{timezone:'Africa/Cairo',weekdays:[1,2,3,4,5],open:'09:00',close:'17:00'},yes:next,no:next}
       :kind==='CRM_ACTION'?{id:node.id,type:kind,operation:'SET_STAGE',value:'CONTACTED',next}
       :kind==='GOAL'?{id:node.id,type:kind,goal:'qualified',next}
       :kind==='CONTROL'?{id:node.id,type:kind,operation:'PAUSE',next}
       :kind==='CONSENT'?{id:node.id,type:kind,text:'هل توافق على تلقي تحديثاتنا التسويقية؟',purpose:'MARKETING',policyVersion:'v1',acceptNext:next,declineNext:next}
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
   if(node.type==='TEXT'||node.type==='BUTTONS'){
    const section=el('fieldset',undefined,'builder-validation');section.append(el('legend','محتويات الرسالة بالترتيب'));
    for(const [i,block]of (node.blocks||[]).entries()){if(block.type==='CARD'||block.type==='GALLERY')continue;
     const row=el('div',undefined,'builder-choice');row.append(el('strong',block.type==='TEXT'?'نص إضافي':block.type==='LINK'?'رابط':'وسائط'));
     if(block.type==='TEXT'||block.type==='LINK')row.append(label('النص',control(block.text,v=>{block.text=v},true)));
     if(block.type!=='TEXT')row.append(label('رابط HTTPS',control(block.url,v=>{block.url=v})));
     if(block.type==='MEDIA'){const kind=el('select');for(const k of ['image','video','audio','document']){const o=el('option',k);o.value=k;kind.append(o)}kind.value=block.mediaKind;kind.onchange=()=>{block.mediaKind=kind.value;markDirty()};row.append(label('نوع الوسائط',kind),label('التعليق',control(block.caption||'',v=>{block.caption=v})))}
     const move=offset=>{const j=i+offset;if(j<0||j>=node.blocks.length)return;[node.blocks[i],node.blocks[j]]=[node.blocks[j],node.blocks[i]];markDirty();renderEditor()};row.append(button('↑',()=>move(-1)),button('↓',()=>move(1)),button('حذف المحتوى',()=>{node.blocks.splice(i,1);markDirty();renderEditor()}));section.append(row);
    }
    for(const [type,title]of [['TEXT','إضافة نص'],['MEDIA','إضافة وسائط'],['LINK','إضافة رابط']])section.append(button(title,()=>{node.blocks??=[];if(node.blocks.length>=10){notify('الحد الأقصى 10 محتويات إضافية','error');return}node.blocks.push(type==='TEXT'?{type,text:'رسالة إضافية'}:type==='LINK'?{type,text:'تفاصيل',url:'https://example.com'}:{type,mediaKind:'image',url:'https://example.com/image.jpg',caption:''});markDirty();renderEditor()}));host.append(section);
   }
   mountCards(node,{host,el,label,control,button,changed:markDirty,render:renderEditor});
   if('field'in node&&!(node.type==='CONDITION'&&node.rules)){
    const fields=el('select'),common={customer_name:'اسم العميل',customer_phone:'رقم الهاتف',customer_email:'البريد الإلكتروني',customer_city:'المدينة',customer_need:'احتياج العميل'};
    for(const v of flow.variables||[])common[v.key]=v.label;
    for(const [key,title] of Object.entries(common)){const option=el('option',title);option.value=key;fields.append(option)}
    for(const source of flow.nodes.filter(n=>(n.type==='INPUT'||n.type==='QUESTION')&&n.field&&!common[n.field])){common[source.field]='إجابة: '+String(source.text||source.field).slice(0,55);const option=el('option',common[source.field]);option.value=source.field;fields.append(option)}
    if(!common[node.field]){const option=el('option','حقل مخصص محفوظ');option.value=node.field;fields.append(option)}
    fields.value=node.field;fields.onchange=()=>{node.field=fields.value;markDirty();renderBlocks();canvas.draw()};
    host.append(label(node.type==='CONDITION'?'قارن إجابة العميل عن':'ما البيانات التي تجمعها؟',fields));
    developerSettings.append(label('معرّف حقل مخصص (للمتقدمين)',control(node.field,value=>{node.field=value})));
   }
   if(node.type==='INPUT'){
    const section=el('fieldset',undefined,'builder-validation');section.append(el('legend','التحقق من الإجابة'));
    const kind=el('select');for(const [value,title]of Object.entries({text:'نص',email:'بريد إلكتروني',phone:'هاتف',number:'رقم',date:'تاريخ YYYY-MM-DD',datetime:'تاريخ ووقت مع المنطقة الزمنية',location:'موقع: خط العرض، خط الطول'})){const option=el('option',title);option.value=value;kind.append(option)}kind.value=node.validation?.type||(/phone$/.test(node.field)?'phone':'text');
    kind.onchange=()=>{node.validation={type:kind.value};markDirty();renderEditor()};section.append(label('نوع الإجابة',kind));
    for(const [key,title]of [['min','أقل قيمة / طول'],['max','أكبر قيمة / طول']]){const c=control(node.validation?.[key]??'',v=>{node.validation??={type:kind.value};if(v==='')delete node.validation[key];else node.validation[key]=Number(v)});c.type='number';section.append(label(title,c))}
    section.append(label('رسالة عند إجابة غير صحيحة',control(node.validation?.errorText||'',v=>{node.validation??={type:kind.value};if(v)node.validation.errorText=v;else delete node.validation.errorText})));host.append(section);
   }
   conversationControls(host,node);runtimeControls.policy(host,node);runtimeControls.schedule(host,node);runtimeControls.triggers(host,node);requestControls.render(host,node);
   if(node.type==='CRM_ACTION'){host.append(label('إجراء العميل',runtimeControls.select(node.operation,[['SET_STAGE','تحديث مرحلة العميل'],['ASSIGN','إسناد المحادثة لموظف']],v=>{node.operation=v;node.value=v==='SET_STAGE'?'CONTACTED':'';renderEditor()})));host.append(label(node.operation==='SET_STAGE'?'المرحلة':'معرف الموظف داخل الشركة',node.operation==='SET_STAGE'?runtimeControls.select(node.value,['INTERESTED','CONTACTED','READY_FOR_AGENT','CLOSED'].map(v=>[v,v]),v=>node.value=v):control(node.value,v=>node.value=v)),label('عند فشل الإجراء',target(node.errorNext||'',v=>{if(v)node.errorNext=v;else delete node.errorNext},true)));}
   if(node.type==='SET_FIELD')host.append(label('عند عدم توافق قيمة الحقل',target(node.errorNext||'',v=>{if(v)node.errorNext=v;else delete node.errorNext},true)));
   if(node.type==='GOAL')host.append(label('معرف الهدف',control(node.goal,v=>node.goal=v)));
   if(node.type==='SET_FIELD')host.append(label('القيمة (يمكن استخدام {{field}})',control(node.value,v=>{node.value=v})));
   if(node.type==='TAG')host.append(label('التصنيف',control(node.tag,value=>{node.tag=value})),label('الإجراء',runtimeControls.select(node.mode||'ADD',[['ADD','إضافة تصنيف'],['REMOVE','إزالة تصنيف']],v=>node.mode=v)));
   if(node.type==='CONDITION'){
     const ops=el('select');for(const [key,text] of [['equals','يساوي'],['contains','يحتوي على'],['exists','تم ملء الحقل']]){const o=el('option',text);o.value=key;ops.append(o)}ops.value=node.operator;
     const comparisonValue=label('الإجابة المطلوبة',control(node.value||'',value=>{node.value=value}));comparisonValue.hidden=node.operator==='exists';
     ops.onchange=()=>{node.operator=ops.value;comparisonValue.hidden=node.operator==='exists';markDirty()};if(!node.rules)host.append(label('المقارنة',ops),comparisonValue);
     runtimeControls.rules(host,node);
     host.append(el('p','اختر سؤالًا سابقًا؛ العميل ينتقل لمسار الإجابة المطابقة أو للمسار الآخر.','muted'));
     host.append(label('لو الشرط صحيح',target(node.yes,value=>{node.yes=value})));
     host.append(label('لو الشرط غلط',target(node.no,value=>{node.no=value})));
   }
   if(node.type==='DELAY')host.append(label('مدة الانتظار بالثواني (1 إلى 604800)',control(node.seconds,v=>{node.seconds=Number(v)})));
   if(node.type==='SUBFLOW'){host.append(label('معرف المسار الفرعي',control(node.subflowId,v=>{node.subflowId=v})),label('الإصدار المثبت',control(node.version,v=>{node.version=Number(v)})),label('ربط حقول الفرعي بحقول المستدعي — JSON',control(JSON.stringify(node.bindings||{}),v=>{try{node.bindings=JSON.parse(v)}catch{notify('ربط الحقول يجب أن يكون JSON صالحًا','error')}},true)));}
   if(node.type==='CONNECTOR'){const choice=el('select');const empty=el('option','اختر خدمة مزامنة محفوظة');empty.value='';choice.append(empty);for(const c of connectorChoices){const o=el('option',c.name+(c.connected&&c.enabled?'':' — تحتاج إعدادًا'));o.value=c.id;choice.append(o)}choice.value=node.connectorId;choice.onchange=()=>{node.connectorId=choice.value;markDirty()};host.append(label('خدمة المزامنة',choice),el('p','انتظار النتيجة اختياري للبوتات القديمة. فعّله لاستخدام مسارات النجاح والفشل والمهلة.'));}
   if(node.type==='WEBHOOK')host.append(label('معرف التكامل من الإعدادات',control(node.integrationId,v=>{node.integrationId=v})));
   if(node.type==='CATALOG')host.append(label('تصنيف الكتالوج (فارغ = الكل)',control(node.category||'',v=>{node.category=v})));
   if(node.type==='KEYWORD'){
    host.append(label('كلمات مفصولة بفاصلة',control(node.keywords.join(','),v=>{node.keywords=v.split(',').map(x=>x.trim()).filter(Boolean)})),label('عند التطابق',target(node.yes,v=>{node.yes=v})),label('بدون تطابق',target(node.no,v=>{node.no=v})));
   }
   if('next'in node)developerSettings.append(label('الخطوة التالية',target(node.next,value=>{node.next=value})));
   if(node.type==='BUTTONS'||node.type==='LIST'||node.type==='RANDOMIZER'){
     if(node.type==='LIST'){const listButton=control(node.buttonText||'اختار',value=>{node.buttonText=value});listButton.maxLength=20;host.append(label('عنوان زر فتح القائمة',listButton));}
     if(node.type==='RANDOMIZER')host.append(runtimeControls.check('تثبيت الفرع طوال المحادثة',Boolean(node.sticky),v=>node.sticky=v));
     host.append(el('h4','الاختيارات والزراير'));
     for(const [i,choice] of node.choices.entries()){
       const block=el('div',undefined,'builder-choice');
       if(node.type==='RANDOMIZER'){const weight=control(choice.weight,v=>{choice.weight=Number(v)});weight.type='number';weight.min='1';weight.max='100';block.append(label('نسبة الفرع % — المجموع يجب أن يساوي 100',weight));}
       const titleInput=control(choice.title,value=>{choice.title=value});titleInput.maxLength=node.type==='BUTTONS'?20:24;
       titleInput.setAttribute('aria-label','عنوان الاختيار '+(i+1));
       block.append(el('strong','الاختيار '+(i+1),'builder-choice-heading'),label('عنوان الاختيار',titleInput));
       const advancedChoice=el('details',undefined,'builder-choice-advanced');advancedChoice.append(el('summary','وجهة الاختيار وإعداداته'));
       advancedChoice.append(label('معرّف الاختيار',control(choice.id,value=>{choice.id=value})));
       if(node.type==='LIST'){const description=control(choice.description||'',value=>{choice.description=value});description.maxLength=72;block.append(label('وصف قصير',description));}
       if(node.type==='BUTTONS'){
        block.append(label('وظيفة الزر',runtimeControls.select(choice.action||'NODE',[['NODE','انتقال إلى خطوة'],['URL','فتح رابط HTTPS دون تغيير المسار']],v=>{choice.action=v;if(v==='URL'){choice.url??='https://example.com';delete choice.effects;delete choice.assign}renderEditor();canvas.draw()})));
        if(choice.action==='URL')block.append(label('رابط الزر',control(choice.url||'',v=>choice.url=v)));
        else{advancedChoice.append(label('تعيين حقل عند الضغط (اختياري)',control(choice.assign?.field||'',v=>{if(v)choice.assign={field:v,value:choice.assign?.value||''};else delete choice.assign})),label('قيمة الحقل',control(choice.assign?.value||'',v=>{if(choice.assign)choice.assign.value=v})));}
       }
       if(node.type==='BUTTONS')mountEffects(choice,{host:advancedChoice,el,label,control,button,changed:markDirty,render:renderEditor});
       if(choice.action!=='URL')advancedChoice.append(label('عند الضغط ينتقل إلى',target(choice.next,value=>{choice.next=value})));
       if(choice.action!=='URL')block.append(button('إضافة رد لهذا الاختيار',()=>openInsert({nodeId:node.id,key:'choice:'+choice.id})));block.append(advancedChoice);
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
       node.choices.push({id,title:'اختيار جديد',next:flow.nodes.at(-1).id,...(node.type==='RANDOMIZER'?{weight:1}:{})});markDirty();renderAll();
     }));
   }

   if('text'in node&&(flow.variables||[]).length){const tokens=el('select');tokens.append(el('option','إدراج متغير في النص…'));for(const v of flow.variables){const o=el('option',v.label+' · '+v.key);o.value=v.key;tokens.append(o)}tokens.onchange=()=>{if(!tokens.value)return;node.text+=' {{'+tokens.value+'}}';markDirty();renderEditor();canvas.draw()};host.append(label('المتغيرات',tokens));}
   // Visual-only preview: does not invoke the engine or transmit messages.
   const sample=el('section',undefined,'builder-step-sample');
   const paint=()=>{
     sample.replaceChildren(el('h4',['SET_FIELD','RANDOMIZER','CONDITION','TAG','DELAY','START'].includes(node.type)?'سلوك خطوة داخلية — لا تُرسل كرسالة':'شكل الرسالة للعميل'),el('p','معاينة تصميمية؛ ليست رسالة واتساب فعلية.','builder-sample-caption'));
     const screen=el('div',undefined,'builder-sample-screen');
     screen.append(el('div',String(node.text||node.caption||types[node.type]||'').trim(),'builder-sample-bubble'));for(const block of node.blocks||[])screen.append(block.type==='CARD'||block.type==='GALLERY'?renderGallery(block.type==='CARD'?[block.card]:block.cards):el('div',block.text||('['+block.mediaKind+'] '+block.url),'builder-sample-bubble'));
     if(node.type==='BUTTONS'||node.type==='LIST'){
       const choices=el('div',undefined,'builder-sample-choices');
       if(node.type==='LIST')choices.append(el('strong',node.buttonText||'عرض القائمة'));
       for(const choice of node.choices){const c=el('div',choice.title||'اختيار','builder-sample-choice');if(node.type==='LIST'&&choice.description)c.append(el('small',choice.description));choices.append(c)}
       screen.append(choices);
     }
     sample.append(screen);
   };
   paint();host.oninput=paint;host.prepend(sample);host.append(developerSettings,note);

   if(node.type!=='START')host.append(button('حذف الخطوة',()=>{
     const inbound=flow.nodes.filter(n=>n!==node&&(
       graphOutputs(n).some(e=>e.to===node.id)
     ));
     const options='next'in node?[node.next]:Array.isArray(node.choices)?node.choices.map(c=>c.next):
       ('yes'in node?[node.yes,node.no]:[]);
     const safe=options.length&&options.every(id=>id===options[0]&&id!==node.id)&&nodeById(options[0])?options[0]:null;
     if(inbound.length&&!safe){notify('هذه الخطوة متصلة بفروع أخرى. غيّر وجهة الفروع أولًا من لوحة التصميم قبل الحذف.','error');return;}
     if(!confirm(inbound.length?'حذف الخطوة وربط المسارات السابقة تلقائيًا بالخطوة التالية؟':'حذف الخطوة غير المرتبطة؟'))return;
     for(const parent of inbound)for(const output of graphOutputs(parent))if(output.to===node.id)setGraphOutput(parent,output.key,safe);
     flow.nodes=flow.nodes.filter(n=>n!==node);
     if(flow.layout)delete flow.layout[node.id];
     flow.groups=(flow.groups||[]).map(g=>({...g,nodeIds:g.nodeIds.filter(id=>id!==node.id)})).filter(g=>g.nodeIds.length>=2);
     selected=flow.startId;selectedNodes=new Set([selected]);markDirty();renderAll();
   },'danger'));
 }
 function renderStatus(){
   $('builder-version').textContent=published?'الإصدار المنشور: '+published.version:'مفيش إصدار منشور لسه';
   $('builder-unsaved').textContent=saveState||(dirty?'تعديلات غير محفوظة':'المسودة محفوظة أو جاهزة للتعديل');$('builder-unsaved').setAttribute('role','status');$('builder-save').disabled=saving;
 }
 function renderAll(){
   $('builder-name').value=flow.name;channelSelect.value=flow.channel||'WHATSAPP';runtimeControls.variables(variableHost);renderStatus();renderBlocks();renderEditor();canvas.draw();canvas.highlight(selected);
 }
 function addNode(type,anchor=null){
   if(flow.nodes.length>=100){notify('وصلت للحد الأقصى 100 خطوة. احذف خطوة غير مستخدمة أولًا.','error');return;}
   if(anchor&&nodeById(graphOutputs(nodeById(anchor.nodeId)).find(e=>e.key===anchor.key)?.to)&&['END','HANDOFF'].includes(type)){notify('للحفاظ على المسار المتصل، أضف نهاية المحادثة بعد آخر خطوة بدل إدراجها وسط مسار موجود.','error');return;}
   const origin=anchor?nodeById(anchor.nodeId):null;
   let oldTarget=origin?(graphOutputs(origin).find(e=>e.key===anchor.key)?.to):null;
   let n=flow.nodes.length+1,id='step'+n;while(nodeById(id))id='step'+(++n);
   let next=flow.nodes.find(n=>n.type==='END'||n.type==='HANDOFF')?.id;
   if(!next&&!['END','HANDOFF'].includes(type)){
    let endId='finish';while(nodeById(endId))endId+='x';
    flow.nodes.push({id:endId,type:'END',text:'شكرًا لتواصلك معنا.'});next=endId;
   }
   next??=flow.startId;
   if(origin&&!nodeById(oldTarget))oldTarget=['END','HANDOFF'].includes(type)?null:next;
   if(type==='BUTTONS'||type==='LIST')flow.nodes.push({id,type,text:'اختار من القائمة:',choices:[{id:'option',title:'اختيار',next}]});
   else if(type==='CONTROL')flow.nodes.push({id,type,operation:'PAUSE',next});
   else if(type==='CONSENT')flow.nodes.push({id,type,text:'هل توافق على تلقي تحديثاتنا التسويقية؟',purpose:'MARKETING',policyVersion:'v1',acceptNext:next,declineNext:next});
   else if(type==='CRM_ACTION')flow.nodes.push({id,type,operation:'SET_STAGE',value:'CONTACTED',next});
   else if(type==='SET_FIELD')flow.nodes.push({id,type,field:'lead_status',value:'qualified',next});
   else if(type==='RANDOMIZER')flow.nodes.push({id,type,choices:[{id:'a',title:'A',weight:50,next},{id:'b',title:'B',weight:50,next}]});
   else if(type==='BUSINESS_HOURS')flow.nodes.push({id,type,schedule:{timezone:'Africa/Cairo',weekdays:[1,2,3,4,5],open:'09:00',close:'17:00'},yes:next,no:next});
   else if(type==='GOAL')flow.nodes.push({id,type,goal:'qualified',next});
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
   else if(type==='CARD'||type==='GALLERY')flow.nodes.push({id,type:'TEXT',label:types[type],text:'اختر من المحتوى المعتمد',next,blocks:[type==='CARD'?{type,card:{title:'بطاقة جديدة',subtitle:''}}:{type,cards:[{title:'البطاقة الأولى',subtitle:''},{title:'البطاقة الثانية',subtitle:''}]}]});
   else if(type==='MEDIA')flow.nodes.push({id,type,mediaKind:'image',url:'https://example.com/image.jpg',caption:'',next});
   else if(type==='LINK')flow.nodes.push({id,type,text:'اعرف التفاصيل من الرابط',url:'https://example.com',next});
   else if(type==='HANDOFF'||type==='END')flow.nodes.push({id,type,text:type==='HANDOFF'?'هحوّل كلامك لموظف يساعدك.':'شكرًا لتواصلك معانا.'});
   else flow.nodes.push({id,type:'TEXT',text:'اكتب رسالة للعميل هنا',next});
   if(origin){
     const inserted=flow.nodes.at(-1);
     setGraphOutput(origin,anchor.key,id);
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
 const diagnostics=el('details',undefined,'builder-diagnostics');diagnostics.append(el('summary','مسار التنفيذ والمتغيرات التجريبية'));const traceHost=el('ol'),valuesHost=el('pre');diagnostics.append(traceHost,valuesHost);simulator.append(diagnostics);
 let previewBusy=false,simulationGeneration=0,simulationNow=Date.now();
 const simulatedStaff=el('select');for(const [value,title]of [['yes','موظف متاح — محاكاة'],['no','لا يوجد موظف — محاكاة']]){const o=el('option',title);o.value=value;simulatedStaff.append(o)}simulatedStaff.setAttribute('aria-label','توافر الموظفين في المحاكاة');const simulatedClock=el('input');simulatedClock.type='datetime-local';simulatedClock.setAttribute('aria-label','وقت المحاكاة');simulatedClock.onchange=()=>{if(simulatedClock.value)simulationNow=new Date(simulatedClock.value).getTime()};const simulatedChannel=el('select');for(const value of ['WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM']){const o=el('option',value);o.value=value;simulatedChannel.append(o)}simulatedChannel.value=flow.channel||'WHATSAPP';simulatedChannel.setAttribute('aria-label','قناة المحاكاة');const simulatedEvent=el('select');for(const [value,title]of [['','استنتاج الحدث'],['MESSAGE','رسالة نصية'],['POSTBACK','اختيار تفاعلي'],['MEDIA','مرفق وارد — Mock'],['LOCATION','موقع وارد — Mock']]){const o=el('option',title);o.value=value;simulatedEvent.append(o)}simulatedEvent.setAttribute('aria-label','حدث المحاكاة');simulator.append(label('القناة — محاكاة فقط',simulatedChannel),label('حدث القناة — محاكاة فقط',simulatedEvent));simulator.append(label('تجربة التحويل',simulatedStaff),label('وقت المحاكاة المحلي',simulatedClock));
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
 async function serverPreview(input,eventKind){
  if(previewBusy)return;previewBusy=true;const generation=simulationGeneration;
  try{
   const current=(previewRuntimeNodes||flow.nodes).find(n=>n.id===preview.at);const choice=current?.type==='BUTTONS'||current?.type==='LIST'||current?.type==='CONSENT';
   const inbound=eventKind?{kind:eventKind,value:input||''}:input!==undefined?{kind:choice?'CHOICE':'TEXT',value:choice?(current.type==='CONSENT'?input:'flow:'+current.id+':'+input):input}:undefined;
   const r=await api('/flows/preview',{method:'POST',body:{definition:flow,state:preview,input:inbound,simulation:{channel:simulatedChannel.value,...(simulatedEvent.value?{event:simulatedEvent.value}:{}),now:simulationNow,requests:requestMocks,staffAvailable:simulatedStaff.value==='yes'},...(previewRuntimeNodes?{runtimeNodes:previewRuntimeNodes}:{})}});
   if(generation!==simulationGeneration)return;
   if(input)bubble(choice?(current.type==='CONSENT'?({accept:'أوافق',decline:'لا أوافق',withdraw:'سحب الموافقة'}[input.split(':').at(-1)]||'اختيار الموافقة'):current.choices?.find(c=>c.id===input)?.title||input):input,'customer');
   for(const entry of r.trace||[]){const item=el('li',entry.nodeId+' · '+entry.type+' · '+entry.outcome);item.onclick=()=>{simulatorDialog.close();canvas.focus(entry.nodeId)};traceHost.append(item)}valuesHost.textContent=JSON.stringify(r.state.answers,null,2);canvas.highlight(r.state.at);
   preview=r.state;previewRuntimeNodes=r.runtimeNodes;$('builder-preview-options').replaceChildren();
   for(const message of r.messages){
    if(message.type==='GALLERY'){if(['WHATSAPP','TELEGRAM'].includes(flow.channel||'WHATSAPP')){for(const c of message.cards){if(c.imageUrl)bubble('[صورة] '+c.imageUrl);bubble([c.title,c.subtitle,...(c.actions||[]).map(a=>a.title+': '+a.url)].filter(Boolean).join('\n'))}}else $('builder-preview').append(renderGallery(message.cards))}else bubble(message.text||('['+message.mediaKind+'] '+message.url));
    if(message.choices)for(const c of message.choices){if(c.action==='URL'){const link=el('a',c.title,'builder-option');link.href=c.url;link.target='_blank';link.rel='noopener noreferrer';$('builder-preview-options').append(link)}else $('builder-preview-options').append(button(c.title,()=>execute(()=>serverPreview(c.id,atInputSkip(c)?'SKIP':undefined)),'builder-option'));}
   }
   if(r.botAction){bubble(r.botAction.operation==='STOP'?'انتهى تشغيل البوت.':'البوت متوقف مؤقتًا. الاستئناف هنا تجربة فقط.');if(r.botAction.operation==='PAUSE')$('builder-preview-options').append(button('استئناف التجربة',()=>{preview.at=r.botAction.next;previewRuntimeNodes=null;execute(()=>serverPreview())}));}
   if(r.waiting){const w=r.waiting;const isInput=w.kind==='INPUT'||w.kind==='CHOICE';bubble((isInput?'مهلة رد: ':'انتظار: ')+w.seconds+' ثانية — ساعة محاكاة');$('builder-preview-options').append(button(isInput?'محاكاة انتهاء المهلة':'استكمال التأخير في المعاينة',()=>{simulationNow=w.expiresAt||simulationNow+w.seconds*1000;if(isInput)execute(()=>serverPreview(w.token,'TIMEOUT'));else{preview.at=w.next;if(preview.runtime)delete preview.runtime.wait;execute(()=>serverPreview())}},'secondary'))}

   const at=(previewRuntimeNodes||flow.nodes).find(n=>n.id===preview.at);
   if(at?.type==='INPUT'||at?.type==='QUESTION'){
    const form=el('form',undefined,'builder-preview-input'),inp=el('input'),send=el('button','إرسال','primary');inp.required=at.policy?.required!==false;send.type='submit';form.append(inp,send);form.onsubmit=e=>{e.preventDefault();execute(()=>serverPreview(isPhoneField(at.field)?normalizePhone(inp.value):inp.value.trim()))};$('builder-preview-options').append(form);inputWithHandoff(form,at.field);
   }
  }catch(e){notify(e.message,'error')}finally{if(generation===simulationGeneration)previewBusy=false}
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
   }else if(preview.at&&(current?.type==='BUTTONS'||current?.type==='LIST'||current?.type==='CONSENT')){
     if(!input)return;
     const choice=current.choices.find(x=>x.id===input);
     if(!choice)return;
     bubble(choice.title,'customer');id=choice.next;
   }
   for(let steps=0;steps<30;steps++){
     const node=map.get(id);if(!node){bubble('الرابط مش صحيح: '+id);return}
     if(node.type==='START'||node.type==='TAG'||node.type==='TEXT'||node.type==='MEDIA'||node.type==='LINK'){
       if(node.type==='TEXT'){bubble(node.text);for(const block of node.blocks||[])bubble(block.text||('['+block.mediaKind+'] '+block.url))}if(node.type==='LINK')bubble(node.text+'\n'+node.url);if(node.type==='MEDIA')bubble('['+node.mediaKind+'] '+node.url+(node.caption?'\n'+node.caption:''));
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
 const atInputSkip=c=>c.id==='skip'&&(previewRuntimeNodes||flow.nodes).find(n=>n.id===preview.at)?.type==='INPUT';
 function resetPreview(){simulationNow=Date.now();simulationGeneration++;previewBusy=false;traceHost.replaceChildren();valuesHost.textContent='{}';previewRuntimeNodes=null;preview={at:null,answers:{},tags:[]};$('builder-preview').replaceChildren();$('builder-preview-options').replaceChildren();if(flow.nodes.length===1){bubble('ابدأ من علامة + لإضافة أول رسالة، ثم جرّب المحادثة هنا.');return;}previewAdvance()}
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
   selectedNodes=new Set([selected]);history=[deep(flow)];cursor=0;
   lastRecoveryScope=recoveryScope();retainRecovery.checked=recoveryStore.enabled(lastRecoveryScope);
   connectorChoices=state.demo?[]:await api('/connectors');await loadSnippets();renderAll();setEditorMode((state.editorMode||sessionStorage.getItem('eb-editor-mode:'+state.tenantId+':'+state.botId))==='simple');requestAnimationFrame(()=>canvas.fit());resetPreview();offerRecovery();
 }
 const guideHost=el('div',undefined,'boat-guide-mount');
 const primaryBar=$('builder-industry').closest('.builder-toolbar');primaryBar.append($('builder-unsaved').parentElement);
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
 const conflictDialog=el('dialog',undefined,'builder-conflict-dialog');conflictDialog.setAttribute('aria-label','مراجعة تعارض المسودة');
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
     if(state.botId&&await flowAuthoring.portable(definition))return;
     const inspected=await api('/flows/inspect-draft',{method:'POST',body:definition});
     if(state.tenantId!==scope.tenantId||state.botId!==scope.botId||JSON.stringify(flow)!==scope.local)throw new Error('تغيرت مساحة التحرير أثناء الفحص. اختر الملف مجددًا.');
     if(!confirm('استرجاع النسخة داخل المحرر سيستبدل تعديلاتك المحلية. لن تتغير مسودة الخادم أو النسخة المنشورة قبل الحفظ والنشر. هل تتابع؟'))return;
     const before=deep(flow);flow=deep(inspected.definition);selected=flow.startId;selectedNodes=new Set([selected]);history=[before,deep(flow)];cursor=1;dirty=true;renderAll();resetPreview();notify(inspected.publishable?'استُرجعت النسخة داخل المحرر بعد فحصها. راجعها ثم احفظ؛ لم يتم النشر.':'استُرجعت النسخة غير المكتملة. أكمل خطواتها ووصلاتها قبل النشر.');
   }finally{importButton.disabled=false;importFile.value=''}
 });

 async function saveDraft(automatic=false){
   if(state.demo){if(!automatic)notify('وضع المعاينة فقط؛ لا حفظ على الخادم.');return}
   if(automatic&&!navigator.locks?.request){autosave.checked=false;saveState='تنسيق النوافذ غير متاح في هذا المتصفح؛ استخدم الحفظ اليدوي الآمن.';renderStatus();return}
   if(saving)return;saving=true;saveState='جارٍ الحفظ…';renderStatus();
   const snapshot=deep(flow),serialized=JSON.stringify(flow),scope={tenant:state.tenantId,bot:state.botId};
   try{
    if(mainSnapshot){const saved=await api('/flows/subflows',{method:'POST',body:{id:editingSubflowId||undefined,definition:snapshot}});editingSubflowId=saved.id;if(JSON.stringify(flow)===serialized)dirty=false;await refreshSubflows();saveState='حُفظ الإصدار الفرعي';return}
    const mutationKey=recoveryKey()+':mutation';const mutation=await draftMutation({getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value)},mutationKey,snapshot,draftRevision);
    let r;const lease=await withDraftSaveLock(navigator.locks,recoveryScope(),async()=>{r=await api('/flows/draft',{method:'PUT',body:{...snapshot,expectedRevision:draftRevision,mutationId:mutation.id}})});
    if(!lease.acquired){saveState='نافذة أخرى تحفظ الآن؛ تعديلاتك باقية. أعد المحاولة بعد انتهائها.';if(!automatic)notify(saveState);return}
    if(r.superseded){const e=new Error('حُفظت هذه المحاولة سابقًا ثم وصلت نسخة أحدث. راجع النسختين.');e.status=409;throw e}
    forgetDraftMutation(mutationKey);try{sessionStorage.removeItem(mutationKey)}catch{}

    if(scope.tenant!==state.tenantId||scope.bot!==state.botId)return;
    draftRevision=r.draftRevision;mergeBase=deep(r.definition);
    if(JSON.stringify(flow)===serialized){flow=deep(r.definition);dirty=false;const key=recoveryKey();if(key)sessionStorage.removeItem(key);recoveryStore.clearMatching(recoveryScope(),serialized);renderAll()}else storeRecovery();
    saveState=dirty?'تعديلات أحدث تنتظر الحفظ':'تم الحفظ على الخادم';if(!automatic)notify(dirty?saveState:'تم حفظ مسودة المحادثة');
   }catch(error){saveState=error.status===409?'تعارض: راجع النسختين':'تعذر الحفظ؛ تعديلاتك باقية — أعد المحاولة';storeRecovery();if(error.status===409){clearTimeout(autosaveTimer);autosave.checked=false;await showDraftConflict()}else if(!automatic)notify(saveState+' · '+error.message,'error')}
   finally{saving=false;renderStatus();if(autosave.checked&&dirty&&saveState==='تعديلات أحدث تنتظر الحفظ')autosaveTimer=setTimeout(()=>void saveDraft(true),1200)}
 }
 const channelSelect=el('select');for(const channel of ['WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM']){const o=el('option',channel);o.value=channel;channelSelect.append(o)}channelSelect.setAttribute('aria-label','قناة التصميم');channelSelect.onchange=()=>{flow.channel=channelSelect.value;markDirty()};primaryBar.append(labelInput('قناة التصميم',channelSelect));
 mountFlowLabs({el,button,label,control,api,execute,getFlow:()=>flow,getSelected:()=>nodeById(selected),changed:()=>markDirty(),renderAll,toolbar:advancedButtons,replaceFlow:definition=>{flow=deep(definition);selected=flow.startId;selectedNodes=new Set([selected]);markDirty();renderAll();resetPreview()}});
 const preflightButton=button('مراجعة قبل النشر',()=>execute(async()=>{if(state.demo)return;const result=await baseApi(state.botId?'/bots/'+encodeURIComponent(state.botId)+'/flows/readiness':'/flows/preflight',{method:'POST',body:flow});const dialog=el('dialog',undefined,'builder-conflict-dialog');dialog.append(el('h3',result.publishable?'المسار جاهز بنيويًا لهذه القناة':'أصلح الأخطاء قبل النشر'),el('p','الفحص لا يربط قناة ولا يرسل أي رسالة.'));for(const issue of result.issues)dialog.append(button((issue.severity==='error'?'خطأ: ':'تنبيه: ')+issue.message,()=>{if(issue.nodeId){selected=issue.nodeId;selectedNodes=new Set([selected]);renderAll();canvas.focus(selected);showInspector();dialog.close();dialog.remove()}}));if(!result.issues.length)dialog.append(el('p','لا أخطاء في البنية أو المحتوى المعلن للقناة. يبقى فحص حساب المزود منفصلًا.'));dialog.append(button('إغلاق',()=>{dialog.close();dialog.remove()}));document.body.append(dialog);dialog.showModal()}));primaryBar.append(preflightButton);
 advancedButtons.append(button('تحليلات الخطوات',()=>execute(async()=>{if(!state.botId||state.demo){notify('افتح بوتًا محفوظًا لعرض أحداثه الفعلية');return}const data=await baseApi('/bots/'+encodeURIComponent(state.botId)+'/flow-insights?days=7');const dialog=el('dialog',undefined,'builder-conflict-dialog');dialog.append(el('h3','أحداث التنفيذ الفعلية — 7 أيام'),el('p','العدادات انتقالات فعلية وجلسات محادثة، وليست إيصالات تسليم. المحاكاة مستبعدة.'));const table=el('table');const head=el('tr');for(const t of ['الإصدار','الخطوة','النتيجة','الانتقالات','المحادثات'])head.append(el('th',t));table.append(head);for(const row of data.rows){const tr=el('tr');for(const value of [row.version,row.nodeId,row.outcome,row.events,row.sessions])tr.append(el('td',value));table.append(tr)}dialog.append(data.rows.length?table:el('p','لا توجد أحداث تشغيل فعلية لهذا البوت بعد.'),button('إغلاق',()=>{dialog.close();dialog.remove()}));document.body.append(dialog);dialog.showModal()})));
 const flowAuthoring=mountFlowAuthoring({el,button,api:baseApi,execute,notify,getScope:()=>({tenantId:state.tenantId,userId:state.userId,botId:state.botId,role:state.role,demo:state.demo}),getFlow:()=>flow,getRevision:()=>draftRevision,getSelected:()=>selected,replaceFlow:definition=>{const before=deep(flow);flow=deep(definition);selected=flow.startId;selectedNodes=new Set([selected]);history=[before,deep(flow)];cursor=1;dirty=true;renderAll();resetPreview()},focus:id=>{if(!nodeById(id))return;selected=id;selectedNodes=new Set([id]);renderAll();canvas.focus(id);showInspector()},toolbar:primaryBar});
 const scheduledOps=mountScheduledOperations({el,button,api:baseApi,execute,notify,getScope:()=>({tenantId:state.tenantId,userId:state.userId,botId:state.botId,demo:state.demo}),toolbar:advancedButtons});
 const experiments=mountFlowExperiments({el,button,label,api:baseApi,execute,notify,getScope:()=>({tenantId:state.tenantId,userId:state.userId,botId:state.botId,demo:state.demo}),toolbar:primaryBar});
 const conversationOps=mountConversationOperations({el,button,api:baseApi,execute,notify,getScope:()=>({tenantId:state.tenantId,userId:state.userId,botId:state.botId,demo:state.demo,role:state.role}),toolbar:primaryBar});
 const requestOps=mountRequestOperations({el,button,api:baseApi,execute,notify,getScope:()=>({tenantId:state.tenantId,userId:state.userId,botId:state.botId,demo:state.demo}),toolbar:primaryBar});
 const flowDiagnostics=mountFlowDiagnostics({el,button,api:baseApi,execute,notify,getScope:()=>({tenantId:state.tenantId,userId:state.userId,botId:state.botId,demo:state.demo}),toolbar:primaryBar,focusNode:id=>{if(!nodeById(id))return false;selected=id;selectedNodes=new Set([id]);renderAll();canvas.focus(id);showInspector();return true}});
 $('builder-save').onclick=()=>execute(()=>saveDraft());
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
   if(!event.target.closest('input,textarea,select,[contenteditable]')){
    const command=event.ctrlKey||event.metaKey,key=event.key.toLowerCase();
    if(command&&['c','v','d','a'].includes(key)){event.preventDefault();if(key==='c')copySelection();if(key==='v')pasteSelection();if(key==='d'){copySelection();pasteSelection()}if(key==='a'){selectedNodes=new Set(flow.nodes.map(n=>n.id));showSelection();canvas.highlight(selected)}}
    if((key==='delete'||key==='backspace')&&!canvasHost.querySelector('.canvas-edge-tools:not([hidden])')){event.preventDefault();deleteSelection()}
    if(key==='f'&&!command&&canvasHost.contains(event.target)){event.preventDefault();canvas.fit()}
   }
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!event.target.closest('input,textarea,select,[contenteditable]')){event.preventDefault();[...tools.querySelectorAll('button')].find(b=>b.textContent===(event.shiftKey?'إعادة':'تراجع'))?.click()}
 });
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
 return {load,hasUnsavedChanges:()=>dirty,reset(){forgetDraftMutation(recoveryKey()+':mutation');for(const d of [...recoveryDialogs]){d.close();d.remove()}recoveryDialogs.clear();if(lastRecoveryScope){recoveryStore.clearUser(lastRecoveryScope);const prefix='eb-recovery:'+lastRecoveryScope.tenantId+':'+lastRecoveryScope.userId+':';for(let i=sessionStorage.length-1;i>=0;i--){const item=sessionStorage.key(i);if(item?.startsWith(prefix))sessionStorage.removeItem(item)}}lastRecoveryScope=null;retainRecovery.checked=false;experiments.reset();conversationOps.reset();requestOps.reset();scheduledOps.reset();flowAuthoring.reset();flowDiagnostics.reset();clearTimeout(autosaveTimer);const key=recoveryKey();if(key)sessionStorage.removeItem(key);closeConflict();conflictDialog.replaceChildren();guide.reset();connectorChoices=[];subflows=[];editingSubflowId=null;mainSnapshot=null;library.replaceChildren();mode.textContent='تحرير المسار الرئيسي';flow=preset();mergeBase=null;published=null;dirty=false;draftRevision=0;previewRuntimeNodes=null;selected=flow.startId;history=[deep(flow)];cursor=0;preview={at:null,answers:{},tags:[]};$('builder-preview').replaceChildren();$('builder-preview-options').replaceChildren();renderAll()}};
}