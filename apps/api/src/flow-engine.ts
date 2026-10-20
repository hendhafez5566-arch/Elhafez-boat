/** Channel-neutral, tenant-independent definition and deterministic interpreter.
 * WhatsApp boundaries are intentionally enforced by the renderer/validator, not AI.
 */
export type ConditionRule={field:string;operator:'equals'|'contains'|'exists'|'not_equals'|'gt'|'gte'|'lt'|'lte';value?:string};
export type InputValidation={type:'text'|'email'|'phone'|'number'|'date'|'datetime'|'location';min?:number;max?:number;errorText?:string};
export type MessageBlock={type:'TEXT';text:string}|{type:'MEDIA';mediaKind:'image'|'video'|'document'|'audio';url:string;caption?:string}|{type:'LINK';text:string;url:string};
export type Choice = {id:string;title:string;description?:string;next:string};
export type FlowNode = (
 | {id:string;type:'SUBFLOW';subflowId:string;version:number;bindings?:Record<string,string>;next:string}
 | {id:string;type:'CONNECTOR';connectorId:string;next:string}
 | {id:string;type:'DELAY';seconds:number;next:string}
 | {id:string;type:'START';next:string}
 | {id:string;type:'SET_FIELD';field:string;value:string;next:string}
 | {id:string;type:'RANDOMIZER';choices:(Choice & {weight:number})[]}
 | {id:string;type:'CATALOG';category?:string;page?:number;next:string}
 | {id:string;type:'WEBHOOK';integrationId:string;next:string}
 | {id:string;type:'AI';field:string;next:string}
 | {id:string;type:'KEYWORD';keywords:string[];yes:string;no:string}
 | {id:string;type:'QUESTION';text:string;field:string;next:string}
 | {id:string;type:'TEXT';text:string;next:string;blocks?:MessageBlock[]}
 | {id:string;type:'BUTTONS';text:string;choices:Choice[]}
 | {id:string;type:'LIST';text:string;buttonText?:string;choices:Choice[]}
 | {id:string;type:'INPUT';text:string;field:string;next:string;validation?:InputValidation}
 | {id:string;type:'CONDITION';field:string;operator:'equals'|'contains'|'exists';value?:string;yes:string;no:string;match?:'all'|'any';rules?:ConditionRule[]}
 | {id:string;type:'TAG';tag:string;next:string}
 | {id:string;type:'MEDIA';mediaKind:'image'|'video'|'document'|'audio';url:string;caption?:string;next:string}
 | {id:string;type:'LINK';text:string;url:string;next:string}
 | {id:string;type:'HANDOFF';text:string}
 | {id:string;type:'END';text:string}) & {label?:string;note?:string};
export type FlowGroup={id:string;title:string;nodeIds:string[]};
export type FlowDefinition={name:string;startId:string;nodes:FlowNode[];layout?:Record<string,{x:number;y:number}>;groups?:FlowGroup[]};
export type FlowState={at:string|null;answers:Record<string,string>;tags:string[]};
export type FlowMessage={type:'TEXT';text:string}|{type:'BUTTONS'|'LIST';text:string;choices:Choice[];buttonText?:string}|{type:'MEDIA';mediaKind:'image'|'video'|'document'|'audio';url:string;caption?:string};
export type FlowTrace={nodeId:string;type:string;outcome:string};
export type FlowAdvance={trace?:FlowTrace[];state:FlowState;messages:FlowMessage[];handoff:boolean;finished:boolean;pending?:boolean;waiting?:{seconds:number;next:string}};
const key=/^[a-z][a-z0-9_]{0,39}$/;
const ident=/^[a-z][a-z0-9_-]{0,31}$/;
const own=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
export function normalizePhoneAnswer(value:string):string {
 return value.trim().replace(/[٠-٩۰-۹]/g,ch=>{
  const arabic='٠١٢٣٤٥٦٧٨٩'.indexOf(ch);return String(arabic>=0?arabic:'۰۱۲۳۴۵۶۷۸۹'.indexOf(ch));
 });
}
export function isPhoneField(field:string):boolean{return /(^|_)phone$/.test(field)}
export function validPhoneAnswer(field:string,value:string):boolean{
 return !isPhoneField(field)||/^\+?[0-9]{8,15}$/.test(normalizePhoneAnswer(value));
}
export function matchesRule(rule:ConditionRule,answers:Record<string,string>):boolean{
 const answer=answers[rule.field]??'',value=rule.value??'';
 if(rule.operator==='exists')return answer.trim().length>0;
 if(rule.operator==='equals')return answer.toLowerCase()===value.toLowerCase();
 if(rule.operator==='not_equals')return answer.toLowerCase()!==value.toLowerCase();
 if(rule.operator==='contains')return answer.toLowerCase().includes(value.toLowerCase());
 if(!answer.trim()||!value.trim()||!Number.isFinite(Number(answer))||!Number.isFinite(Number(value)))return false;
 return rule.operator==='gt'?Number(answer)>Number(value):rule.operator==='gte'?Number(answer)>=Number(value):rule.operator==='lt'?Number(answer)<Number(value):Number(answer)<=Number(value);
}
export function matchesCondition(node:Extract<FlowNode,{type:'CONDITION'}>,answers:Record<string,string>):boolean{
 const rules=node.rules||[node];return node.match==='any'?rules.some(r=>matchesRule(r,answers)):rules.every(r=>matchesRule(r,answers));
}
export function validateInputAnswer(node:Extract<FlowNode,{type:'INPUT'|'QUESTION'}>,raw:string):{valid:boolean;value:string;error:string}{
 const v=node.type==='INPUT'?node.validation:undefined,type=v?.type||(isPhoneField(node.field)?'phone':'text');
 const value=type==='phone'||type==='number'?normalizePhoneAnswer(raw):raw.trim();
 let valid=value.length>0&&value.length<=500;
 if(type==='phone')valid=valid&&/^\+?[0-9]{8,15}$/.test(value);
 if(type==='email')valid=valid&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
 if(type==='number')valid=valid&&Number.isFinite(Number(value))&&(v?.min===undefined||Number(value)>=v.min)&&(v?.max===undefined||Number(value)<=v.max);
 if(type==='text')valid=valid&&(v?.min===undefined||value.length>=v.min)&&(v?.max===undefined||value.length<=v.max);
 if(type==='date')valid=valid&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 if(type==='datetime')valid=valid&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&!Number.isNaN(Date.parse(value));
 if(type==='location'){const parts=value.split(',').map(x=>Number(x.trim()));valid=valid&&/^[-+\d.]+\s*,\s*[-+\d.]+$/.test(value)&&parts.length===2&&parts.every(Number.isFinite)&&Math.abs(parts[0])<=90&&Math.abs(parts[1])<=180}
 const errors={phone:'اكتب رقم هاتف صحيح من 8 إلى 15 رقمًا بدون حروف.',email:'اكتب بريدًا إلكترونيًا صحيحًا.',number:'اكتب رقمًا ضمن الحدود المحددة.',date:'اكتب تاريخًا صحيحًا بصيغة YYYY-MM-DD.',datetime:'اكتب تاريخًا ووقتًا مع المنطقة الزمنية.',location:'اكتب خط العرض، خط الطول بصورة صحيحة.',text:'راجع طول الإجابة المطلوبة.'};
 return {valid,value,error:v?.errorText||errors[type]};
}
function plain(v:unknown):v is Record<string,unknown>{return typeof v==='object'&&v!==null&&!Array.isArray(v)}
function bounded(v:unknown,max:number,min=1):v is string{return typeof v==='string'&&v.trim().length>=min&&v.length<=max}
function requireTrue(v:unknown,message:string):asserts v{if(!v)throw new Error(message)}
export function validateFlow(input:unknown,options:{draft?:boolean;runtime?:boolean}={}):FlowDefinition{
 requireTrue(plain(input),'Flow must be an object');
 requireTrue(bounded(input.name,100,2),'Flow name must be 2–100 characters');
 requireTrue(typeof input.startId==='string'&&ident.test(input.startId),'Invalid start node ID');
 requireTrue(Array.isArray(input.nodes)&&input.nodes.length>=(options.draft?1:2)&&input.nodes.length<=(options.runtime?500:100),'Flow requires 2–100 nodes');
 const seen=new Set<string>();const fields=new Set<string>();let startCount=0;
 for(const raw of input.nodes){
  requireTrue(plain(raw),'Invalid node object');
  requireTrue(typeof raw.id==='string'&&(options.runtime?/^@[a-zA-Z0-9:_-]{1,180}$/.test(raw.id)||ident.test(raw.id):ident.test(raw.id))&&!seen.has(raw.id),'Duplicate or invalid node ID');
  seen.add(raw.id);
  if(raw.label!==undefined)requireTrue(bounded(raw.label,80),'Step label must be 1–80 characters');
  if(raw.note!==undefined)requireTrue(bounded(raw.note,1000,0),'Step note must be at most 1000 characters');
  const type=raw.type;
  requireTrue(['START','TEXT','BUTTONS','LIST','INPUT','CONDITION','TAG','MEDIA','LINK','HANDOFF','END','CATALOG','AI','KEYWORD','QUESTION','WEBHOOK','DELAY','SUBFLOW','CONNECTOR','SET_FIELD','RANDOMIZER'].includes(String(type)),'Unsupported node type');
  if(type==='SUBFLOW'){requireTrue(typeof raw.subflowId==='string'&&/^[0-9a-f-]{36}$/i.test(raw.subflowId)&&Number.isInteger(raw.version)&&Number(raw.version)>0,'Invalid pinned subflow');if(raw.bindings!==undefined)requireTrue(plain(raw.bindings)&&Object.keys(raw.bindings).length<=30&&Object.entries(raw.bindings).every(([k,v])=>key.test(k)&&typeof v==='string'&&key.test(v)),'Invalid field bindings');}
  if(type==='CONNECTOR')requireTrue(typeof raw.connectorId==='string'&&/^[0-9a-f-]{36}$/i.test(raw.connectorId),'Invalid connector');
  if(type==='DELAY')requireTrue(Number.isInteger(raw.seconds)&&Number(raw.seconds)>=1&&Number(raw.seconds)<=604800,'Delay must be 1–604800 seconds');
  if(type==='START'){startCount++;}
  if(type==='WEBHOOK')requireTrue(typeof raw.integrationId==='string'&&/^[0-9a-f-]{36}$/i.test(raw.integrationId),'Invalid webhook integration ID');
  if(type==='CATALOG'&&raw.category!==undefined)requireTrue(bounded(raw.category,80,0),'Invalid catalog category');
  if(type==='KEYWORD')requireTrue(Array.isArray(raw.keywords)&&raw.keywords.length>0&&raw.keywords.length<=20&&raw.keywords.every(k=>bounded(k,80)),'Invalid keywords');

  if(['TEXT','BUTTONS','LIST','INPUT','HANDOFF','END','LINK','QUESTION'].includes(String(type))){
    requireTrue(bounded(raw.text,type==='BUTTONS'||type==='LIST'?1024:4096),'Message text is required (max 4096 characters)');
  }
  if(type==='INPUT'||type==='CONDITION'||type==='AI'||type==='QUESTION'||type==='SET_FIELD'){
    requireTrue(typeof raw.field==='string'&&key.test(raw.field),'Custom field must be an alphanumeric key');
    if(type==='INPUT')fields.add(raw.field);
  }
  if(type==='TEXT'&&raw.blocks!==undefined){
   requireTrue(Array.isArray(raw.blocks)&&raw.blocks.length<=10,'Message supports up to 10 content blocks');
   for(const block of raw.blocks){
    requireTrue(plain(block)&&['TEXT','MEDIA','LINK'].includes(String(block.type)),'Invalid message block');
    // Reuse existing public-resource and content limits without changing the stored legacy node.
    requireTrue(!('blocks'in block),'Nested content blocks are not allowed');
    validateFlow({name:'Content block',startId:'block_start',nodes:[{id:'block_start',type:'START',next:'block_body'},{...block,id:'block_body',next:'block_end'},{id:'block_end',type:'END',text:'Done'}]});
   }
  }
  if(type==='MEDIA'||type==='LINK'){
    requireTrue(bounded(raw.url,2048),'Valid HTTPS URL is required');
    let uri:URL;try{uri=new URL(raw.url as string)}catch{throw new Error('Invalid media or link URL')}
    requireTrue(uri.protocol==='https:'&&!uri.username&&!uri.password,'Only HTTPS URLs without credentials are allowed');
    requireTrue(uri.hostname.length>=4&& !['localhost','127.0.0.1','::1'].includes(uri.hostname),'Invalid public resource URL');
    if(type==='MEDIA'){requireTrue(['image','video','document','audio'].includes(String(raw.mediaKind)),'Unsupported media type');
      if(raw.caption!==undefined)requireTrue(bounded(raw.caption,1024,0),'Media caption too long');}
  }
  if(type==='SET_FIELD')requireTrue(bounded(raw.value,500,0),'Invalid field value');
  if(type==='TAG')requireTrue(typeof raw.tag==='string'&&key.test(raw.tag),'Invalid tag');
  if(type==='INPUT'&&raw.validation!==undefined){
   const v=raw.validation;requireTrue(plain(v)&&['text','email','phone','number','date','datetime','location'].includes(String(v.type)),'Invalid input validation type');
   for(const k of ['min','max'])if(v[k]!==undefined)requireTrue(typeof v[k]==='number'&&Number.isFinite(v[k])&&Math.abs(v[k] as number)<=1e9,'Invalid input validation bound');
   requireTrue(v.min===undefined||v.max===undefined||Number(v.min)<=Number(v.max),'Input minimum exceeds maximum');
   if(v.errorText!==undefined)requireTrue(bounded(v.errorText,500),'Invalid validation message');
  }
  if(type==='CONDITION'){
    if(raw.rules!==undefined){requireTrue(Array.isArray(raw.rules)&&raw.rules.length>=1&&raw.rules.length<=20&&['all','any'].includes(String(raw.match)),'Invalid condition rules');for(const rule of raw.rules){requireTrue(plain(rule)&&typeof rule.field==='string'&&key.test(rule.field)&&['equals','contains','exists','not_equals','gt','gte','lt','lte'].includes(String(rule.operator)),'Invalid condition rule');if(rule.operator!=='exists')requireTrue(bounded(rule.value,160),'Invalid rule value')}}
    requireTrue(['equals','contains','exists'].includes(String(raw.operator)),'Invalid condition operator');
    if(raw.operator!=='exists')requireTrue(bounded(raw.value,160),'Invalid condition value');
  }
  if(type==='BUTTONS'||type==='LIST'||type==='RANDOMIZER'){
    const count=type==='BUTTONS'?3:10;
    requireTrue(Array.isArray(raw.choices)&&raw.choices.length>=1&&raw.choices.length<=count,'Invalid number of options');
    if(type==='LIST'&&raw.buttonText!==undefined)requireTrue(bounded(raw.buttonText,20),'Invalid list button label');
    if(type==='RANDOMIZER')requireTrue((raw.choices as unknown[]).every(c=>plain(c)&&Number.isInteger(c.weight)&&Number(c.weight)>=1&&Number(c.weight)<=100)&&(raw.choices as {weight:number}[]).reduce((sum,c)=>sum+c.weight,0)===100,'Randomizer weights must total 100');
    const choices=new Set<string>();
    for(const choice of raw.choices){
      requireTrue(plain(choice),'Invalid choice');
      requireTrue(typeof choice.id==='string'&&(options.runtime?/^[a-z0-9_-]{1,40}$/i.test(choice.id):ident.test(choice.id))&&!choices.has(choice.id),'Duplicate or invalid choice ID');
      choices.add(choice.id);
      requireTrue(bounded(choice.title,type==='BUTTONS'?20:24),'Choice title exceeds WhatsApp limit');
      if(choice.description!==undefined)requireTrue(bounded(choice.description,72,0),'Choice description exceeds limit');
      requireTrue(typeof choice.next==='string'&&(options.draft&&choice.next===''|| (options.runtime?/^@[a-zA-Z0-9:_-]{1,180}$/.test(choice.next)||ident.test(choice.next):ident.test(choice.next))),'Missing choice destination');
    }
  }
 }
 requireTrue((options.runtime?startCount>=1:startCount===1)&&input.nodes.some(n=>plain(n)&&n.id===input.startId&&n.type==='START'),'Flow needs exactly one START matching startId');
 const nodes=input.nodes as FlowNode[];
 const edges=(node:FlowNode):string[]=>{
  if(node.type==='START'||node.type==='TEXT'||node.type==='INPUT'||node.type==='TAG'||node.type==='MEDIA'||node.type==='LINK'||node.type==='CATALOG'||node.type==='AI'||node.type==='QUESTION'||node.type==='WEBHOOK'||node.type==='DELAY'||node.type==='SUBFLOW'||node.type==='CONNECTOR'||node.type==='SET_FIELD')return [node.next];
  if(node.type==='CONDITION'||node.type==='KEYWORD')return [node.yes,node.no];
  if(node.type==='BUTTONS'||node.type==='LIST'||node.type==='RANDOMIZER')return node.choices.map(c=>c.next);
  return [];
 };
 if(!options.draft){
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
  if(!['BUTTONS','LIST','INPUT','QUESTION','END','HANDOFF','DELAY'].includes(node.type))for(const dest of edges(node))verifyAuto(dest);
  visiting.delete(id);done.add(id);
 };
 for(const n of nodes)verifyAuto(n.id);
 }
 const layout:Record<string,{x:number;y:number}>={};
 if(plain(input.layout))for(const [id,pos] of Object.entries(input.layout)){
  requireTrue(seen.has(id)&&plain(pos)&&typeof pos.x==='number'&&typeof pos.y==='number'&&Number.isFinite(pos.x)&&Number.isFinite(pos.y)&&Math.abs(pos.x)<=10000&&Math.abs(pos.y)<=10000,'Invalid canvas position');
  Object.defineProperty(layout,id,{value:{x:pos.x,y:pos.y},enumerable:true});
 }
 const groups:FlowGroup[]=[];
 if(input.groups!==undefined){
  requireTrue(Array.isArray(input.groups)&&input.groups.length<=20,'Flow can have up to 20 visual groups');
  const groupIds=new Set<string>(),members=new Set<string>();
  for(const rawGroup of input.groups){
   requireTrue(plain(rawGroup)&&typeof rawGroup.id==='string'&&ident.test(rawGroup.id)&&!groupIds.has(rawGroup.id),'Invalid group ID');
   groupIds.add(rawGroup.id);
   requireTrue(bounded(rawGroup.title,60,2),'Invalid group title (2–60 characters)');
   requireTrue(Array.isArray(rawGroup.nodeIds)&&rawGroup.nodeIds.length>=2&&rawGroup.nodeIds.length<=30,'Groups contain 2–30 steps');
   const nodeIds:string[]=[];
   for(const nodeId of rawGroup.nodeIds){
    requireTrue(typeof nodeId==='string'&&seen.has(nodeId)&&!members.has(nodeId),'Overlapping or unknown grouped step');
    members.add(nodeId);nodeIds.push(nodeId);
   }
   groups.push({id:rawGroup.id,title:rawGroup.title.trim(),nodeIds});
  }
 }
 return {name:input.name.trim(),startId:input.startId,nodes:JSON.parse(JSON.stringify(nodes)) as FlowNode[],layout,groups};
}
export function renderFlowText(text:string,answers:Record<string,string>,limit=4096):string{return text.replace(/\{\{([a-z][a-z0-9_]{0,39})\}\}/g,(_,key:string)=>Object.hasOwn(answers,key)?answers[key]:'').slice(0,limit)}
export function initialFlowState():FlowState{return {at:null,answers:{},tags:[]}}
export function advanceFlow(flow:FlowDefinition,state:FlowState,input?:{kind:'TEXT'|'CHOICE';value:string},random:()=>number=Math.random):FlowAdvance{
 const nodes=new Map(flow.nodes.map(n=>[n.id,n]));
 const answers:Record<string,string>=Object.assign(Object.create(null),state.answers),tags=[...state.tags];let at=state.at??flow.startId;
 const trace:FlowTrace[]=[];const messages:FlowMessage[]=[];let handoff=false,finished=false;
 const current=nodes.get(at);if(!current)throw new Error('Unknown current flow node');
 if(state.at!==null){
  if(current.type==='BUTTONS'||current.type==='LIST'){
   const prefix=`flow:${current.id}:`;
   const selected=input?.kind==='CHOICE'&&input.value.startsWith(prefix)
     ? current.choices.find(c=>c.id===input.value.slice(prefix.length)):undefined;
   if(!selected){messages.push({type:current.type,text:current.text,choices:current.choices,buttonText:current.type==='LIST'?current.buttonText:undefined});return {trace,state,messages,handoff,finished}}
   answers['choice_'+current.id]=selected.title;at=selected.next;
  } else if((current.type==='INPUT'||current.type==='QUESTION')){
   if(input?.kind!=='TEXT'||!bounded(input.value,500)){
    messages.push({type:'TEXT',text:current.text});return {trace,state,messages,handoff,finished};
   }
   const checked=validateInputAnswer(current,input.value);
   if(!checked.valid){
     messages.push({type:'TEXT',text:checked.error});
     return {trace,state,messages,handoff,finished};
    }
    answers[current.field]=checked.value;at=current.next;
  } else if(current.type==='END'||current.type==='HANDOFF'){
   at=flow.startId;
  }
 }
 for(let hops=0;hops<120;hops++){
  const node=nodes.get(at);if(!node)throw new Error('Node destination unavailable');
  const entry:FlowTrace={nodeId:node.id,type:node.type,outcome:'entered'};trace.push(entry);
  if(node.type==='DELAY')return {trace,state:{at,answers,tags},messages,handoff,finished,waiting:{seconds:node.seconds,next:node.next}};
  if(node.type==='KEYWORD'){const text=input?.kind==='TEXT'?input.value.toLowerCase():'';at=node.keywords.some(k=>text.includes(k.toLowerCase()))?node.yes:node.no;continue}
  if(node.type==='SUBFLOW')throw new Error('Subflow must be compiled before execution');
  if(node.type==='CATALOG'||node.type==='AI'||node.type==='WEBHOOK'||node.type==='CONNECTOR')return {trace,state:{at,answers,tags},messages,handoff,finished,pending:true};
  if(node.type==='SET_FIELD'){answers[node.field]=renderFlowText(node.value,answers,500);entry.outcome='field_updated';at=node.next;continue}
  if(node.type==='RANDOMIZER'){let remaining=Math.max(0,Math.min(.999999,random()))*100;const branch=node.choices.find(c=>{remaining-=c.weight;return remaining<0})||node.choices[node.choices.length-1];entry.outcome=branch.id;at=branch.next;continue}
  if(node.type==='START'){at=node.next;continue}
  if(node.type==='TEXT'){
   messages.push({type:'TEXT',text:renderFlowText(node.text,answers)});for(const block of node.blocks||[])messages.push(block.type==='MEDIA'?{...block,caption:renderFlowText(block.caption||'',answers,1024)}:{type:'TEXT',text:renderFlowText(block.type==='LINK'?block.text+'\n'+block.url:block.text,answers)});at=node.next;continue;
  }
  if(node.type==='LINK'){messages.push({type:'TEXT',text:node.text+'\n'+node.url});at=node.next;continue}
  if(node.type==='MEDIA'){messages.push({type:'MEDIA',mediaKind:node.mediaKind,url:node.url,caption:node.caption});at=node.next;continue}
  if(node.type==='TAG'){if(!tags.includes(node.tag))tags.push(node.tag);at=node.next;continue}
  if(node.type==='CONDITION'){
   const matches=matchesCondition(node,answers);entry.outcome=matches?'yes':'no';
   at=matches?node.yes:node.no;continue;
  }
  if(node.type==='INPUT'||node.type==='QUESTION'){messages.push({type:'TEXT',text:node.text});return {trace,state:{at,answers,tags},messages,handoff,finished}}
  if(node.type==='BUTTONS'||node.type==='LIST'){messages.push({type:node.type,text:node.text,choices:node.choices,buttonText:node.type==='LIST'?node.buttonText:undefined});return {trace,state:{at,answers,tags},messages,handoff,finished}}
  if(node.type==='HANDOFF'){messages.push({type:'TEXT',text:node.text});handoff=true;return {trace,state:{at,answers,tags},messages,handoff,finished}}
  messages.push({type:'TEXT',text:node.text});finished=true;
  return {trace,state:{at,answers,tags},messages,handoff,finished};
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