/**
 * Accessible step-by-step presentation of the SAME live draft used by the Canvas.
 * Presentation only: no copied flow, API, save state, interpreter or persistence.
 * The inspector, insertion menu, and simulation are shared with the advanced editor.
 */
export function mountHybridBasicBuilder({host,getFlow,labels,getOutputs,onEdit,onLocate,onInsert,onPreview,onTemplate,onAdvanced}){
 const make=(tag,content,klass)=>{
  const node=document.createElement(tag);
  if(content!==undefined&&content!==null)node.textContent=String(content);
  if(klass)node.className=klass;
  return node;
 };
 const action=(title,callback,klass)=>{
  const node=make('button',title,klass||'hybrid-action');
  node.type='button';node.addEventListener('click',callback);return node;
 };
 const typeIcon={START:'▶',TEXT:'✉',BUTTONS:'▣',LIST:'☷',QUESTION:'?',INPUT:'✎',CONDITION:'◇',HANDOFF:'♧',END:'✓',DELAY:'◷',GALLERY:'▤',CARD:'▤',CATALOG:'▤',TAG:'#',MEDIA:'▧',CRM_ACTION:'↗'};
 const summary=(node)=>{
  if(node.type==='CONDITION')return 'شرط على '+String(node.field||'بيانات العميل');
  if(node.type==='INPUT'||node.type==='QUESTION')return String(node.text||'سؤال للعميل');
  if(node.type==='START')return 'يبدأ البوت هنا عند تحقق شرط التشغيل';
  if(node.type==='HANDOFF')return String(node.text||'تسليم المحادثة إلى موظف');
  if(node.type==='END')return String(node.text||'نهاية المحادثة');
  if(node.type==='TAG')return 'تصنيف: '+String(node.tag||'');
  if(node.type==='DELAY')return 'انتظار '+String(node.seconds??'')+' ثانية';
  return String(node.text||node.label||labels[node.type]||node.type);
 };
 const title=(node)=>String(node.label||labels[node.type]||node.type);
 const nodeGroup=(node)=>['BUTTONS','LIST','CONDITION','RANDOMIZER','KEYWORD','BUSINESS_HOURS'].includes(node.type)?'branch':node.type==='START'?'start':node.type==='HANDOFF'?'handoff':['END'].includes(node.type)?'end':['INPUT','QUESTION'].includes(node.type)?'input':'message';
 function orderedNodes(flow){
  const map=new Map((flow.nodes||[]).map(node=>[node.id,node]));
  const seen=new Set(),result=[],queue=[flow.startId];
  while(queue.length){
   const id=queue.shift();
   if(!id||seen.has(id)||!map.has(id))continue;
   seen.add(id);result.push(map.get(id));
   for(const output of getOutputs(map.get(id)))if(output.to&&!seen.has(output.to))queue.push(output.to);
  }
  return {connected:result,disconnected:(flow.nodes||[]).filter(node=>!seen.has(node.id)),map};
 }
 function renderNode(node,map,index){
  const card=make('article',undefined,'hybrid-step hybrid-step-'+nodeGroup(node));
  card.dataset.basicStepId=node.id;
  const header=make('header',undefined,'hybrid-step-head');
  const icon=make('span',typeIcon[node.type]||'⬡','hybrid-step-icon');
  icon.setAttribute('aria-hidden','true');
  const heading=make('div',undefined,'hybrid-step-heading');
  heading.append(make('small','خطوة '+(index+1)+' · '+(labels[node.type]||node.type)),make('h4',title(node)));
  const edit=action('تعديل',()=>onEdit(node.id),'hybrid-edit');
  edit.setAttribute('aria-label','تعديل خطوة '+title(node));
  header.append(icon,heading,edit);
  const content=make('div',undefined,'hybrid-step-content');
  content.append(make('p',summary(node),'hybrid-step-message'));
  if(Array.isArray(node.blocks)){
   for(const block of node.blocks.slice(0,2)){
    if(block.type==='CARD'||block.type==='GALLERY'){
     const cards=block.type==='CARD'?[block.card]:block.cards;
     const pills=make('div',undefined,'hybrid-card-pills');
     for(const item of (cards||[]).slice(0,3))pills.append(make('span',item?.title||'بطاقة','hybrid-card-pill'));
     content.append(pills);
    }
   }
  }
  if(node.type==='INPUT'||node.type==='QUESTION')content.append(make('p','الإجابة تُحفظ في: '+String(node.field||'حقل جديد'),'hybrid-step-hint'));
  if(node.type==='BUTTONS'||node.type==='LIST'){
   const choices=make('div',undefined,'hybrid-choice-preview');
   for(const choice of (node.choices||[]).slice(0,10))choices.append(make('span',choice.title||'اختيار','hybrid-choice'));
   content.append(choices);
  }
  const outputs=getOutputs(node);
  const routes=make('div',undefined,'hybrid-routes');
  for(const output of outputs){
   const row=make('div',undefined,'hybrid-route');
   const text=make('div',undefined,'hybrid-route-copy');
   text.append(make('small',output.label||'التالي'));
   const target=map.get(output.to);
   text.append(make('span',target?title(target):'غير موصول'));
   const plus=action('+ إضافة خطوة',()=>onInsert({nodeId:node.id,key:output.key}),'hybrid-insert');
   plus.setAttribute('aria-label','إضافة خطوة بعد '+title(node)+' في مسار '+String(output.label||'التالي'));
   row.append(text,plus);routes.append(row);
  }
  if(!outputs.length)routes.append(make('span','هذه نهاية المسار.','hybrid-step-hint'));
  const footer=make('footer',undefined,'hybrid-step-footer');
  footer.append(action('عرض في المخطط ↗',()=>onLocate(node.id),'hybrid-goto'));
  card.append(header,content,routes,footer);
  return card;
 }
 const hero=make('div',undefined,'hybrid-basic-hero');
 const heading=make('div',undefined,'hybrid-basic-heading');
 heading.append(make('span','BASIC BUILDER · سهل للمبتدئين','hybrid-kicker'),make('h2','ابنِ المحادثة خطوة بخطوة'),make('p','اختار خطوة وعدّلها أو أضف خطوة جديدة. كل تعديل يظهر فورًا في المخطط المتقدم ويحفظ ضمن نفس مسودة البوت.'));
 const controls=make('div',undefined,'hybrid-basic-controls');
 controls.append(action('▶ تجربة المحادثة',onPreview,'hybrid-preview'),action('عرض المخطط المتقدم ↗',onAdvanced,'hybrid-advanced'));
 hero.append(heading,controls);
 const templateStrip=make('div',undefined,'hybrid-basic-templates');
 templateStrip.append(make('strong','ابدأ من قالب جاهز:'));
 for(const [value,label]of [['general','عام'],['shop','متجر'],['clinic','عيادة'],['tourism','سياحة'],['restaurant','مطعم']])
  templateStrip.append(action(label,()=>onTemplate(value),'hybrid-template'));
 templateStrip.append(make('small','القالب يستبدل المسودة بعد التأكيد؛ نزّل نسخة احتياطية لو عندك تغييرات.'));
 const status=make('p',undefined,'hybrid-basic-status');
 status.setAttribute('role','status');
 const timeline=make('section',undefined,'hybrid-timeline');
 timeline.setAttribute('aria-label','الخطوات المرتبطة ببداية المحادثة');
 const detached=make('section',undefined,'hybrid-disconnected');
 host.append(hero,templateStrip,status,timeline,detached);
 function render(){
  const flow=getFlow();if(!flow||!Array.isArray(flow.nodes))return;
  const {connected,disconnected,map}=orderedNodes(flow);
  status.textContent=String(connected.length)+' خطوة متصلة · '+String(disconnected.length)+' خطوة غير متصلة · '+String(flow.nodes.length)+' إجمالي';
  timeline.replaceChildren();
  for(let i=0;i<connected.length;i++)timeline.append(renderNode(connected[i],map,i));
  detached.replaceChildren();
  if(disconnected.length){
   const warning=make('p',String(disconnected.length)+' خطوة خارج المسار الرئيسي — راجع وصلاتها قبل النشر.','hybrid-warning');
   const list=make('div',undefined,'hybrid-detached-list');
   for(const n of disconnected)list.append(action(title(n)+' ↗',()=>onLocate(n.id),'hybrid-goto'));
   detached.append(warning,list);
  }
 }
 return {render};
}
