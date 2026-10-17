/** Channel-neutral, tenant-independent definition and deterministic interpreter.
 * WhatsApp boundaries are intentionally enforced by the renderer/validator, not AI.
 */
export type Choice = {id:string;title:string;description?:string;next:string};
export type FlowNode =
 | {id:string;type:'START';next:string}
 | {id:string;type:'TEXT';text:string;next:string}
 | {id:string;type:'BUTTONS';text:string;choices:Choice[]}
 | {id:string;type:'LIST';text:string;buttonText?:string;choices:Choice[]}
 | {id:string;type:'INPUT';text:string;field:string;next:string}
 | {id:string;type:'CONDITION';field:string;operator:'equals'|'contains'|'exists';value?:string;yes:string;no:string}
 | {id:string;type:'TAG';tag:string;next:string}
 | {id:string;type:'HANDOFF';text:string}
 | {id:string;type:'END';text:string};
export type FlowDefinition={name:string;startId:string;nodes:FlowNode[]};
export type FlowState={at:string|null;answers:Record<string,string>;tags:string[]};
export type FlowMessage={type:'TEXT';text:string}|{type:'BUTTONS'|'LIST';text:string;choices:Choice[];buttonText?:string};
export type FlowAdvance={state:FlowState;messages:FlowMessage[];handoff:boolean;finished:boolean};
const key=/^[a-z][a-z0-9_]{0,39}$/;
const ident=/^[a-z][a-z0-9_-]{0,31}$/;
const own=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
function plain(v:unknown):v is Record<string,unknown>{return typeof v==='object'&&v!==null&&!Array.isArray(v)}
function bounded(v:unknown,max:number,min=1):v is string{return typeof v==='string'&&v.trim().length>=min&&v.length<=max}
function requireTrue(v:unknown,message:string):asserts v{if(!v)throw new Error(message)}
export function validateFlow(input:unknown):FlowDefinition{
 requireTrue(plain(input),'Flow must be an object');
 requireTrue(bounded(input.name,100,2),'Flow name must be 2–100 characters');
 requireTrue(typeof input.startId==='string'&&ident.test(input.startId),'Invalid start node ID');
 requireTrue(Array.isArray(input.nodes)&&input.nodes.length>1&&input.nodes.length<=100,'Flow requires 2–100 nodes');
 const seen=new Set<string>();const fields=new Set<string>();let startCount=0;
 for(const raw of input.nodes){
  requireTrue(plain(raw),'Invalid node object');
  requireTrue(typeof raw.id==='string'&&ident.test(raw.id)&&!seen.has(raw.id),'Duplicate or invalid node ID');
  seen.add(raw.id);
  const type=raw.type;
  requireTrue(['START','TEXT','BUTTONS','LIST','INPUT','CONDITION','TAG','HANDOFF','END'].includes(String(type)),'Unsupported node type');
  if(type==='START'){startCount++;}
  if(['TEXT','BUTTONS','LIST','INPUT','HANDOFF','END'].includes(String(type))){
    requireTrue(bounded(raw.text,type==='BUTTONS'||type==='LIST'?1024:4096),'Message text is required (max 4096 characters)');
  }
  if(type==='INPUT'||type==='CONDITION'){
    requireTrue(typeof raw.field==='string'&&key.test(raw.field),'Custom field must be an alphanumeric key');
    if(type==='INPUT')fields.add(raw.field);
  }
  if(type==='TAG')requireTrue(typeof raw.tag==='string'&&key.test(raw.tag),'Invalid tag');
  if(type==='CONDITION'){
    requireTrue(['equals','contains','exists'].includes(String(raw.operator)),'Invalid condition operator');
    if(raw.operator!=='exists')requireTrue(bounded(raw.value,160),'Invalid condition value');
  }
  if(type==='BUTTONS'||type==='LIST'){
    const count=type==='BUTTONS'?3:10;
    requireTrue(Array.isArray(raw.choices)&&raw.choices.length>=1&&raw.choices.length<=count,'Invalid number of options');
    if(type==='LIST'&&raw.buttonText!==undefined)requireTrue(bounded(raw.buttonText,20),'Invalid list button label');
    const choices=new Set<string>();
    for(const choice of raw.choices){
      requireTrue(plain(choice),'Invalid choice');
      requireTrue(typeof choice.id==='string'&&ident.test(choice.id)&&!choices.has(choice.id),'Duplicate or invalid choice ID');
      choices.add(choice.id);
      requireTrue(bounded(choice.title,type==='BUTTONS'?20:24),'Choice title exceeds WhatsApp limit');
      if(choice.description!==undefined)requireTrue(bounded(choice.description,72,0),'Choice description exceeds limit');
      requireTrue(typeof choice.next==='string'&&ident.test(choice.next),'Missing choice destination');
    }
  }
 }
 requireTrue(startCount===1&&seen.has(input.startId),'Flow needs exactly one START matching startId');
 const nodes=input.nodes as FlowNode[];
 const edges=(node:FlowNode):string[]=>{
  if(node.type==='START'||node.type==='TEXT'||node.type==='INPUT'||node.type==='TAG')return [node.next];
  if(node.type==='CONDITION')return [node.yes,node.no];
  if(node.type==='BUTTONS'||node.type==='LIST')return node.choices.map(c=>c.next);
  return [];
 };
 for(const node of nodes)for(const dest of edges(node))requireTrue(seen.has(dest),'Node '+node.id+' links to missing '+dest);
 // Unreachable blocks are configuration mistakes, not silently ignored.
 const reached=new Set<string>();const visit=(id:string)=>{if(reached.has(id))return;reached.add(id);for(const dest of edges(nodes.find(n=>n.id===id)!))visit(dest)};
 visit(input.startId);requireTrue(reached.size===nodes.length,'Flow has unreachable nodes');
 // Prevent automatic (no user input) loops. Choices/INPUT are permissible cycle breaks.
 const visiting=new Set<string>(),done=new Set<string>();
 const verifyAuto=(id:string)=>{
  if(done.has(id))return;
  if(visiting.has(id))throw new Error('Flow contains an automatic loop without customer input');
  visiting.add(id);
  const node=nodes.find(n=>n.id===id)!;
  if(!['BUTTONS','LIST','INPUT','END','HANDOFF'].includes(node.type))for(const dest of edges(node))verifyAuto(dest);
  visiting.delete(id);done.add(id);
 };
 for(const n of nodes)verifyAuto(n.id);
 return {name:input.name.trim(),startId:input.startId,nodes:JSON.parse(JSON.stringify(nodes)) as FlowNode[]};
}
export function initialFlowState():FlowState{return {at:null,answers:{},tags:[]}}
export function advanceFlow(flow:FlowDefinition,state:FlowState,input?:{kind:'TEXT'|'CHOICE';value:string}):FlowAdvance{
 const nodes=new Map(flow.nodes.map(n=>[n.id,n]));
 const answers={...state.answers},tags=[...state.tags];let at=state.at??flow.startId;
 const messages:FlowMessage[]=[];let handoff=false,finished=false;
 const current=nodes.get(at);if(!current)throw new Error('Unknown current flow node');
 if(state.at!==null){
  if(current.type==='BUTTONS'||current.type==='LIST'){
   const prefix=`flow:${current.id}:`;
   const selected=input?.kind==='CHOICE'&&input.value.startsWith(prefix)
     ? current.choices.find(c=>c.id===input.value.slice(prefix.length)):undefined;
   if(!selected){messages.push({type:current.type,text:current.text,choices:current.choices,buttonText:current.type==='LIST'?current.buttonText:undefined});return {state,messages,handoff,finished}}
   at=selected.next;
  } else if(current.type==='INPUT'){
   if(input?.kind!=='TEXT'||!bounded(input.value,500)){
    messages.push({type:'TEXT',text:current.text});return {state,messages,handoff,finished};
   }
   answers[current.field]=input.value.trim();at=current.next;
  } else if(current.type==='END'||current.type==='HANDOFF'){
   at=flow.startId;
  }
 }
 for(let hops=0;hops<40;hops++){
  const node=nodes.get(at);if(!node)throw new Error('Node destination unavailable');
  if(node.type==='START'){at=node.next;continue}
  if(node.type==='TEXT'){messages.push({type:'TEXT',text:node.text});at=node.next;continue}
  if(node.type==='TAG'){if(!tags.includes(node.tag))tags.push(node.tag);at=node.next;continue}
  if(node.type==='CONDITION'){
   const answer=answers[node.field]??'';
   const matches=node.operator==='exists'?Boolean(answer):node.operator==='equals'?answer.toLowerCase()===String(node.value).toLowerCase():answer.toLowerCase().includes(String(node.value).toLowerCase());
   at=matches?node.yes:node.no;continue;
  }
  if(node.type==='INPUT'){messages.push({type:'TEXT',text:node.text});return {state:{at,answers,tags},messages,handoff,finished}}
  if(node.type==='BUTTONS'||node.type==='LIST'){messages.push({type:node.type,text:node.text,choices:node.choices,buttonText:node.type==='LIST'?node.buttonText:undefined});return {state:{at,answers,tags},messages,handoff,finished}}
  if(node.type==='HANDOFF'){messages.push({type:'TEXT',text:node.text});handoff=true;return {state:{at,answers,tags},messages,handoff,finished}}
  messages.push({type:'TEXT',text:node.text});finished=true;
  return {state:{at,answers,tags},messages,handoff,finished};
 }
 throw new Error('Flow exceeded automatic step limit');
}
export function exampleFlow(industry:'retail'|'clinic'|'tourism'|'general'='general'):FlowDefinition{
 const titles={retail:['المنتجات','الأسعار والمقاسات'],clinic:['الخدمات','مواعيد التواصل'],tourism:['البرامج','الأسعار والمواعيد'],general:['المنتجات والخدمات','الأسعار والعروض']}[industry];
 return validateFlow({name:'مساعد العملاء',startId:'start',nodes:[
  {id:'start',type:'START',next:'welcome'},
  {id:'welcome',type:'TEXT',text:'أهلًا بيك 👋 ممكن أساعدك في إيه؟',next:'menu'},
  {id:'menu',type:'BUTTONS',text:'اختار من القائمة، أو اكتب سؤالك:',choices:[{id:'services',title:titles[0],next:'services'},{id:'pricing',title:titles[1],next:'pricing'},{id:'agent',title:'موظف',next:'handoff'}]},
  {id:'services',type:'TEXT',text:'دي رسالة تجريبية. أضف خدمات شركتك وأسئلتها المعتمدة من المصمم.',next:'menu'},
  {id:'pricing',type:'TEXT',text:'تفاصيل الأسعار متاحة لدى فريق الشركة. تقدر تسيب استفسارك لموظف.',next:'menu'},
  {id:'handoff',type:'HANDOFF',text:'وصل طلبك لفريق الشركة، وموظف هيتابع معاك قريب.'}
 ]});
}