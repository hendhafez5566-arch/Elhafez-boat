import {validateHandoffPolicy,type HandoffPolicy,type BotAction} from './flow-conversation-policy.js';
import {validateRichBlock,validateEffects,type RichBlock,type FlowCard,type ChoiceEffect} from './flow-content.js';
import {validateFlowRequest,type FlowRequest} from './flow-request.js';
import {isUuid} from './services.js';
import {validateFormDrafts,type FlowFormDraft} from './flow-forms.js';
import {businessIsOpen,scheduledDelay,validateBusinessSchedule,validateDelaySchedule,validInstant,type BusinessSchedule,type DelaySchedule} from './flow-time.js';
/** Channel-neutral, tenant-independent definition and deterministic interpreter.
 * WhatsApp boundaries are intentionally enforced by the renderer/validator, not AI.
 */
export type ConditionRule={field:string;operator:'equals'|'contains'|'exists'|'not_exists'|'not_equals'|'gt'|'gte'|'lt'|'lte'|'date_before'|'date_after'|'tagged'|'not_tagged'|'in';value?:string}|{match:'all'|'any';rules:ConditionRule[]};
export type WaitPolicy={required?:boolean;maxAttempts?:number;invalidNext?:string;skipNext?:string;timeoutSeconds?:number;timeoutNext?:string};
export type FlowVariable={key:string;label:string;type:InputValidation['type']|'boolean'|'enum';scope:'contact'|'session';options?:string[]};
export type FlowRuntime={attempts:Record<string,number>;wait?:{nodeId:string;expiresAt:number;token:string};experiments?:Record<string,string>};
export type FlowInput={kind:'TEXT'|'CHOICE'|'SKIP'|'TIMEOUT';value:string};
export type InputValidation={type:'text'|'email'|'phone'|'number'|'date'|'datetime'|'location';min?:number;max?:number;errorText?:string};
export type MessageBlock=RichBlock|{type:'TEXT';text:string}|{type:'MEDIA';mediaKind:'image'|'video'|'document'|'audio';url:string;caption?:string}|{type:'LINK';text:string;url:string};
export type Choice = {id:string;title:string;description?:string;next:string;action?:'NODE'|'URL';url?:string;assign?:{field:string;value:string};effects?:ChoiceEffect[]};
export type FlowNode = (
 | {id:string;type:'SUBFLOW';subflowId:string;version:number;bindings?:Record<string,string>;next:string}
 | {id:string;type:'CONNECTOR';connectorId:string;next:string;request?:FlowRequest}
 | {id:string;type:'DELAY';seconds:number;next:string;schedule?:DelaySchedule;errorNext?:string}
 | {id:string;type:'START';next:string}
 | {id:string;type:'SET_FIELD';field:string;value:string;next:string;errorNext?:string}
 | {id:string;type:'RANDOMIZER';sticky?:boolean;choices:(Choice & {weight:number})[]}
 | {id:string;type:'BUSINESS_HOURS';schedule:BusinessSchedule;yes:string;no:string}
 | {id:string;type:'GOAL';goal:string;next:string}
 | {id:string;type:'CRM_ACTION';operation:'SET_STAGE'|'ASSIGN';value:string;next:string;errorNext?:string}
 | {id:string;type:'CATALOG';category?:string;page?:number;next:string}
 | {id:string;type:'WEBHOOK';integrationId:string;next:string;request?:FlowRequest}
 | {id:string;type:'AI';field:string;next:string}
 | {id:string;type:'KEYWORD';keywords:string[];yes:string;no:string}
 | {id:string;type:'QUESTION';text:string;field:string;next:string}
 | {id:string;type:'TEXT';text:string;next:string;blocks?:MessageBlock[]}
 | {id:string;type:'BUTTONS';text:string;choices:Choice[];policy?:WaitPolicy;blocks?:MessageBlock[]}
 | {id:string;type:'LIST';text:string;buttonText?:string;choices:Choice[];policy?:WaitPolicy}
 | {id:string;type:'INPUT';text:string;field:string;next:string;validation?:InputValidation;policy?:WaitPolicy}
 | {id:string;type:'CONDITION';field:string;operator:'equals'|'contains'|'exists';value?:string;yes:string;no:string;match?:'all'|'any';rules?:ConditionRule[]}
 | {id:string;type:'TAG';tag:string;next:string;mode?:'ADD'|'REMOVE'}
 | {id:string;type:'MEDIA';mediaKind:'image'|'video'|'document'|'audio';url:string;caption?:string;next:string}
 | {id:string;type:'LINK';text:string;url:string;next:string}
 | {id:string;type:'CONTROL';operation:BotAction['operation'];next:string;seconds?:number}
 | {id:string;type:'CONSENT';text:string;purpose:'SERVICE'|'MARKETING';policyVersion:string;acceptNext:string;declineNext:string;withdrawNext?:string}
 | {id:string;type:'HANDOFF';text:string;handoffPolicy?:HandoffPolicy}
 | {id:string;type:'END';text:string}) & {label?:string;note?:string};
export type FlowGroup={id:string;title:string;nodeIds:string[];collapsed?:boolean};
export type DraftTrigger={kind:'KEYWORD'|'FIRST_MESSAGE';phrase:string;matchMode:'EXACT'|'CONTAINS';targetNode:string;priority:number;enabled:boolean};
export type FlowDefinition={name:string;startId:string;nodes:FlowNode[];layout?:Record<string,{x:number;y:number}>;groups?:FlowGroup[];variables?:FlowVariable[];channel?:FlowChannel;triggers?:DraftTrigger[];forms?:FlowFormDraft[]};
export type FlowChannel='WHATSAPP'|'WEBSITE'|'MESSENGER'|'INSTAGRAM'|'TELEGRAM';
export type FlowState={at:string|null;answers:Record<string,string>;tags:string[];runtime?:FlowRuntime};
export type FlowMessage={type:'GALLERY';cards:FlowCard[]}|{type:'TEXT';text:string}|{type:'BUTTONS'|'LIST';text:string;choices:Choice[];buttonText?:string}|{type:'MEDIA';mediaKind:'image'|'video'|'document'|'audio';url:string;caption?:string};
export type FlowTrace={nodeId:string;type:string;outcome:string;elapsedMs?:number};
export type FlowAdvance={trace?:FlowTrace[];state:FlowState;messages:FlowMessage[];handoff:boolean;finished:boolean;pending?:boolean;botAction?:BotAction;consent?:{purpose:'SERVICE'|'MARKETING';decision:'GRANT'|'DENY'|'WITHDRAW';next:string;nodeId:string;policyVersion:string;notice:string};waiting?:{seconds:number;next:string;kind?:'INPUT'|'CHOICE'|'DELAY'|'INTEGRATION';expiresAt?:number;token?:string}};
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
export function matchesRule(rule:ConditionRule,answers:Record<string,string>,tags:string[]=[]):boolean{
 if('rules'in rule)return rule.match==='any'?rule.rules.some(r=>matchesRule(r,answers,tags)):rule.rules.every(r=>matchesRule(r,answers,tags));
 const answer=Object.hasOwn(answers,rule.field)?answers[rule.field]:'',value=rule.value??'';
 if(rule.operator==='exists')return answer.trim().length>0;
 if(rule.operator==='not_exists')return !answer.trim();
 if(rule.operator==='tagged')return tags.includes(value);
 if(rule.operator==='not_tagged')return !tags.includes(value);
 if(rule.operator==='equals')return answer.toLowerCase()===value.toLowerCase();
 if(rule.operator==='not_equals')return answer.toLowerCase()!==value.toLowerCase();
 if(rule.operator==='contains')return answer.toLowerCase().includes(value.toLowerCase());
 if(rule.operator==='in')return value.split(',').map(v=>v.trim().toLowerCase()).includes(answer.toLowerCase());
 if(rule.operator==='date_before'||rule.operator==='date_after'){
  const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)?(new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v?Date.parse(v+'T00:00:00Z'):NaN):validInstant(v)?Date.parse(v):NaN;
  let a,b;try{a=date(answer);b=date(value)}catch{return false}if(!Number.isFinite(a)||!Number.isFinite(b))return false;return rule.operator==='date_before'?a<b:a>b;
 }
 if(!answer.trim()||!value.trim()||!Number.isFinite(Number(answer))||!Number.isFinite(Number(value)))return false;
 return rule.operator==='gt'?Number(answer)>Number(value):rule.operator==='gte'?Number(answer)>=Number(value):rule.operator==='lt'?Number(answer)<Number(value):Number(answer)<=Number(value);
}
export function matchesCondition(node:Extract<FlowNode,{type:'CONDITION'}>,answers:Record<string,string>,tags:string[]=[]):boolean{
 const rules=node.rules||[node];return node.match==='any'?rules.some(r=>matchesRule(r,answers,tags)):rules.every(r=>matchesRule(r,answers,tags));
}
export function validateConditionRules(rules:unknown,depth=0,budget={remaining:60}):asserts rules is ConditionRule[]{
 if(depth>5||!Array.isArray(rules)||!rules.length||rules.length>20)throw Error('Condition groups require 1–20 rules and at most 5 levels');
 for(const rule of rules){if(--budget.remaining<0||!plain(rule))throw Error('Condition rule budget exceeded');if('rules'in rule){if(!['all','any'].includes(String(rule.match)))throw Error('Invalid condition group');validateConditionRules(rule.rules,depth+1,budget);continue}
  requireTrue(typeof rule.field==='string'&&key.test(rule.field)&&['equals','contains','exists','not_exists','not_equals','gt','gte','lt','lte','date_before','date_after','tagged','not_tagged','in'].includes(String(rule.operator)),'Invalid condition rule');
  if(!['exists','not_exists'].includes(String(rule.operator)))requireTrue(bounded(rule.value,500),'Invalid rule value');
 }
}
export function mapConditionRules(rules:ConditionRule[],map:(field:string)=>string):ConditionRule[]{return rules.map(r=>'rules'in r?{...r,rules:mapConditionRules(r.rules,map)}:{...r,field:map(r.field)})}
export function flowDestinations(node:FlowNode):string[]{
 const destinations:string[]=[];if(node.type==='CONSENT')destinations.push(node.acceptNext,node.declineNext,...(node.withdrawNext?[node.withdrawNext]:[]));if(node.type==='HANDOFF'&&node.handoffPolicy)destinations.push(node.handoffPolicy.unavailableNext,...(node.handoffPolicy.resumeNext?[node.handoffPolicy.resumeNext]:[]));if('next'in node)destinations.push(node.next);if('yes'in node)destinations.push(node.yes,node.no);if('choices'in node)destinations.push(...node.choices.filter(c=>c.action!=='URL').map(c=>c.next));
 if('policy'in node&&node.policy)for(const key of ['invalidNext','skipNext','timeoutNext'] as const)if(node.policy[key])destinations.push(node.policy[key]!);
 if((node.type==='WEBHOOK'||node.type==='CONNECTOR')&&node.request)destinations.push(node.request.errorNext,node.request.timeoutNext);
 if('errorNext'in node&&node.errorNext)destinations.push(node.errorNext);return destinations;
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
 if(type==='datetime')valid=valid&&validInstant(value);
 if(type==='location'){const parts=value.split(',').map(x=>Number(x.trim()));valid=valid&&/^[-+\d.]+\s*,\s*[-+\d.]+$/.test(value)&&parts.length===2&&parts.every(Number.isFinite)&&Math.abs(parts[0])<=90&&Math.abs(parts[1])<=180}
 const errors={phone:'اكتب رقم هاتف صحيح من 8 إلى 15 رقمًا بدون حروف.',email:'اكتب بريدًا إلكترونيًا صحيحًا.',number:'اكتب رقمًا ضمن الحدود المحددة.',date:'اكتب تاريخًا صحيحًا بصيغة YYYY-MM-DD.',datetime:'اكتب تاريخًا ووقتًا مع المنطقة الزمنية.',location:'اكتب خط العرض، خط الطول بصورة صحيحة.',text:'راجع طول الإجابة المطلوبة.'};
 return {valid,value,error:v?.errorText||errors[type]};
}
export function validVariableValue(variable:FlowVariable|undefined,value:string):boolean{
 if(!variable)return true;if(variable.type==='enum')return Boolean(variable.options?.includes(value));if(variable.type==='boolean')return ['true','false'].includes(value);
 return validateInputAnswer({id:'variable',type:'INPUT',field:variable.key,text:'Value',next:'end',validation:{type:variable.type}},value).valid;
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
  requireTrue(['START','TEXT','BUTTONS','LIST','INPUT','CONDITION','TAG','MEDIA','LINK','HANDOFF','END','CATALOG','AI','KEYWORD','QUESTION','WEBHOOK','DELAY','SUBFLOW','CONNECTOR','SET_FIELD','RANDOMIZER','BUSINESS_HOURS','GOAL','CRM_ACTION','CONTROL','CONSENT'].includes(String(type)),'Unsupported node type');
  if(type==='HANDOFF'&&raw.handoffPolicy!==undefined)validateHandoffPolicy(raw.handoffPolicy);
  if(type==='CONTROL'){requireTrue(['PAUSE','RESUME','STOP'].includes(String(raw.operation)),'Invalid bot control operation');if(raw.seconds!==undefined)requireTrue(raw.operation==='PAUSE'&&Number.isInteger(raw.seconds)&&Number(raw.seconds)>=1&&Number(raw.seconds)<=604800,'Pause timer must be 1–604800 seconds');}
  if(type==='CONSENT'){requireTrue(bounded(raw.text,1024),'Consent notice must be 1–1024 characters');requireTrue(['SERVICE','MARKETING'].includes(String(raw.purpose))&&bounded(raw.policyVersion,80),'Choose consent purpose and policy version');for(const k of ['acceptNext','declineNext'] as const)requireTrue(typeof raw[k]==='string'&&raw[k].length<=180,'Consent requires accept/decline routes');if(raw.withdrawNext!==undefined)requireTrue(typeof raw.withdrawNext==='string'&&raw.withdrawNext.length<=180,'Invalid consent withdrawal route');}
  if(type==='SUBFLOW'){requireTrue(typeof raw.subflowId==='string'&&/^[0-9a-f-]{36}$/i.test(raw.subflowId)&&Number.isInteger(raw.version)&&Number(raw.version)>0,'Invalid pinned subflow');if(raw.bindings!==undefined)requireTrue(plain(raw.bindings)&&Object.keys(raw.bindings).length<=30&&Object.entries(raw.bindings).every(([k,v])=>key.test(k)&&typeof v==='string'&&key.test(v)),'Invalid field bindings');}
  if(type==='CONNECTOR')requireTrue(typeof raw.connectorId==='string'&&/^[0-9a-f-]{36}$/i.test(raw.connectorId),'Invalid connector');
  if(type==='DELAY')requireTrue(Number.isInteger(raw.seconds)&&Number(raw.seconds)>=1&&Number(raw.seconds)<=604800,'Delay must be 1–604800 seconds');
  if(type==='START'){startCount++;}
  if(type==='BUSINESS_HOURS')validateBusinessSchedule(raw.schedule);
  if(type==='DELAY'&&raw.schedule!==undefined)validateDelaySchedule(raw.schedule);
  if(raw.errorNext!==undefined)requireTrue(typeof raw.errorNext==='string'&&(options.draft?raw.errorNext===''||ident.test(raw.errorNext):ident.test(raw.errorNext)),'Invalid error destination');
  if(type==='CRM_ACTION'){requireTrue(['SET_STAGE','ASSIGN'].includes(String(raw.operation))&&typeof raw.value==='string','Invalid CRM action');requireTrue(raw.operation==='SET_STAGE'?['INTERESTED','CONTACTED','READY_FOR_AGENT','CLOSED'].includes(raw.value as string):isUuid(raw.value),'Invalid CRM action value')}
  if(type==='GOAL')requireTrue(typeof raw.goal==='string'&&key.test(raw.goal),'Invalid goal key');
  if(type==='TAG'&&raw.mode!==undefined)requireTrue(['ADD','REMOVE'].includes(String(raw.mode)),'Invalid tag action');
  if(type==='RANDOMIZER'&&raw.sticky!==undefined)requireTrue(typeof raw.sticky==='boolean','Invalid experiment policy');
  if((type==='WEBHOOK'||type==='CONNECTOR')&&raw.request!==undefined){validateFlowRequest(raw.request);if(type==='CONNECTOR')requireTrue(raw.request.method==='POST'&&raw.request.maxAttempts===1,'Native connector upserts cannot retry automatically');}
  if(type==='WEBHOOK')requireTrue(typeof raw.integrationId==='string'&&/^[0-9a-f-]{36}$/i.test(raw.integrationId),'Invalid webhook integration ID');
  if(type==='CATALOG'&&raw.category!==undefined)requireTrue(bounded(raw.category,80,0),'Invalid catalog category');
  if(type==='KEYWORD')requireTrue(Array.isArray(raw.keywords)&&raw.keywords.length>0&&raw.keywords.length<=20&&raw.keywords.every(k=>bounded(k,80)),'Invalid keywords');

  if(['TEXT','BUTTONS','LIST','INPUT','HANDOFF','END','LINK','QUESTION','CONSENT'].includes(String(type))){
    requireTrue(bounded(raw.text,type==='BUTTONS'||type==='LIST'?1024:4096),'Message text is required (max 4096 characters)');
  }
  if(type==='INPUT'||type==='CONDITION'||type==='AI'||type==='QUESTION'||type==='SET_FIELD'){
    requireTrue(typeof raw.field==='string'&&key.test(raw.field),'Custom field must be an alphanumeric key');
    if(type==='INPUT')fields.add(raw.field);
  }
  if((type==='TEXT'||type==='BUTTONS')&&raw.blocks!==undefined){
   requireTrue(Array.isArray(raw.blocks)&&raw.blocks.length<=10,'Message supports up to 10 content blocks');
   requireTrue(raw.blocks.reduce((n,b)=>n+(plain(b)&&b.type==='CARD'?1:plain(b)&&b.type==='GALLERY'&&Array.isArray(b.cards)?b.cards.length:0),0)<=10,'Message allows at most 10 cards in total');
   for(const block of raw.blocks){
    requireTrue(plain(block)&&['TEXT','MEDIA','LINK','CARD','GALLERY'].includes(String(block.type)),'Invalid message block');
    if(block.type==='CARD'||block.type==='GALLERY'){validateRichBlock(block);continue}
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
    if(raw.rules!==undefined){requireTrue(['all','any'].includes(String(raw.match)),'Invalid condition rules');validateConditionRules(raw.rules)}
    requireTrue(['equals','contains','exists'].includes(String(raw.operator)),'Invalid condition operator');
    if(raw.operator!=='exists')requireTrue(bounded(raw.value,160),'Invalid condition value');
  }
  if(['INPUT','BUTTONS','LIST'].includes(String(type))&&raw.policy!==undefined){
   const p=raw.policy;requireTrue(plain(p),'Invalid input policy');
   for(const k of ['invalidNext','skipNext','timeoutNext'])if(p[k]!==undefined)requireTrue(typeof p[k]==='string'&&p[k].length<=180,'Invalid input route');
   if(p.required!==undefined)requireTrue(typeof p.required==='boolean','Invalid required flag');
   if(p.skipNext!==undefined)requireTrue(type==='INPUT'&&p.required===false,'Only optional questions can have a skip route');
   if(p.maxAttempts!==undefined)requireTrue(Number.isInteger(p.maxAttempts)&&Number(p.maxAttempts)>=1&&Number(p.maxAttempts)<=10&&typeof p.invalidNext==='string','Retry limit needs 1–10 attempts and an invalid route');
   if(p.timeoutSeconds!==undefined)requireTrue(Number.isInteger(p.timeoutSeconds)&&Number(p.timeoutSeconds)>=1&&Number(p.timeoutSeconds)<=604800&&typeof p.timeoutNext==='string','Timeout needs 1–604800 seconds and a route');
   requireTrue((p.maxAttempts===undefined)===(p.invalidNext===undefined),'Invalid route and retry limit must be configured together');
   requireTrue((p.timeoutSeconds===undefined)===(p.timeoutNext===undefined),'Timeout route and seconds must be configured together');
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
      if(choice.effects!==undefined){validateEffects(choice.effects);requireTrue(type==='BUTTONS'&&!(choice.action==='URL'&&(choice.effects as unknown[]).length),'Only reply buttons execute effects')}
      if(choice.action!==undefined)requireTrue(type==='BUTTONS'&&['NODE','URL'].includes(String(choice.action)),'Invalid button action');
      if(choice.action==='URL'){
       requireTrue(bounded(choice.url,2048),'URL button needs HTTPS');let u;try{u=new URL(choice.url as string)}catch{throw Error('Invalid button URL')}
       requireTrue(u.protocol==='https:'&&!u.username&&!u.password&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname),'Only public HTTPS button URLs without credentials');
      }
      if(choice.assign!==undefined){const a=choice.assign;requireTrue(plain(a)&&typeof a.field==='string'&&key.test(a.field)&&bounded(a.value,500,0)&&choice.action!=='URL','Invalid button field assignment')}
      requireTrue(typeof choice.next==='string'&&(choice.action==='URL'||options.draft&&choice.next===''|| (options.runtime?/^@[a-zA-Z0-9:_-]{1,180}$/.test(choice.next)||ident.test(choice.next):ident.test(choice.next))),'Missing choice destination');
    }
  }
 }
 requireTrue((options.runtime?startCount>=1:startCount===1)&&input.nodes.some(n=>plain(n)&&n.id===input.startId&&n.type==='START'),'Flow needs exactly one START matching startId');
 const nodes=input.nodes as FlowNode[];
 const edges=flowDestinations;
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
  if(!['BUTTONS','LIST','INPUT','QUESTION','END','HANDOFF','DELAY','CONSENT'].includes(node.type)&&!(node.type==='CONTROL'&&node.operation!=='RESUME'))for(const dest of edges(node))verifyAuto(dest);
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
   if(rawGroup.collapsed!==undefined)requireTrue(typeof rawGroup.collapsed==='boolean','Invalid collapsed group');
   groups.push({id:rawGroup.id,title:rawGroup.title.trim(),nodeIds,...(rawGroup.collapsed!==undefined?{collapsed:rawGroup.collapsed as boolean}:{})});
  }
 }
 if(input.forms!==undefined)validateFormDrafts(input.forms);
 const triggers:DraftTrigger[]=[];
 if(input.triggers!==undefined){requireTrue(Array.isArray(input.triggers)&&input.triggers.length<=100,'Maximum 100 start triggers');const used=new Set<string>();for(const t of input.triggers){requireTrue(plain(t)&&['KEYWORD','FIRST_MESSAGE'].includes(String(t.kind))&&bounded(t.phrase,80,t.kind==='FIRST_MESSAGE'?0:1)&&['EXACT','CONTAINS'].includes(String(t.matchMode))&&typeof t.targetNode==='string'&&ident.test(t.targetNode)&&Number.isInteger(t.priority)&&Math.abs(Number(t.priority))<=100&&typeof t.enabled==='boolean','Invalid start trigger');const signature=t.kind+':'+t.matchMode+':'+t.phrase.normalize('NFKC').trim().toLowerCase();if(t.enabled){requireTrue(!used.has(signature),'Duplicate enabled start triggers');used.add(signature);if(!options.draft)requireTrue(seen.has(t.targetNode),'Trigger target is unavailable')}triggers.push(t as DraftTrigger)}}
 const variables:FlowVariable[]=[];
 if(input.variables!==undefined){requireTrue(Array.isArray(input.variables)&&input.variables.length<=100,'Maximum 100 variables');const names=new Set();for(const v of input.variables){requireTrue(plain(v)&&typeof v.key==='string'&&key.test(v.key)&&!names.has(v.key)&&bounded(v.label,80)&&['text','phone','email','number','date','datetime','location','boolean','enum'].includes(String(v.type))&&['session','contact'].includes(String(v.scope)),'Invalid typed variable');names.add(v.key);if(v.type==='enum')requireTrue(Array.isArray(v.options)&&v.options.length>=1&&v.options.length<=50&&v.options.every(o=>bounded(o,100)),'Enum requires bounded options');variables.push(v as FlowVariable)}}
 if(input.channel!==undefined)requireTrue(['WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM'].includes(String(input.channel)),'Invalid authoring channel');
 return {...(input.forms!==undefined?{forms:input.forms as FlowFormDraft[]}:{}),...(input.triggers!==undefined?{triggers}:{}),...(input.variables!==undefined?{variables}:{}),...(input.channel!==undefined?{channel:input.channel as FlowChannel}:{}),name:input.name.trim(),startId:input.startId,nodes:JSON.parse(JSON.stringify(nodes)) as FlowNode[],layout,groups};
}
export function renderFlowText(text:string,answers:Record<string,string>,limit=4096):string{return text.replace(/\{\{([a-z][a-z0-9_]{0,39})\}\}/g,(_,key:string)=>Object.hasOwn(answers,key)?answers[key]:'').slice(0,limit)}
export function initialFlowState():FlowState{return {at:null,answers:{},tags:[]}}
export function advanceFlow(flow:FlowDefinition,state:FlowState,input?:FlowInput,random:()=>number=Math.random,context:{now?:number;enter?:boolean}={}):FlowAdvance{
 const now=context.now??Date.now(),nodes=new Map(flow.nodes.map(n=>[n.id,n]));
 const answers:Record<string,string>=Object.assign(Object.create(null),state.answers),tags=[...state.tags];let at=state.at??flow.startId;
 let runtime:FlowRuntime|undefined=state.runtime?JSON.parse(JSON.stringify(state.runtime)):undefined;
 const ensureRuntime=():FlowRuntime=>runtime??={attempts:Object.create(null)};
 const snapshot=():FlowState=>({at,answers,tags,...(runtime?{runtime}:{})});
 const trace:FlowTrace[]=[],messages:FlowMessage[]=[];let handoff=false,finished=false;let stepAt=performance.now();const finishStep=()=>{const now=performance.now();if(trace.length)trace[trace.length-1].elapsedMs=Math.max(0,now-stepAt);stepAt=now};
 const result=(extra:Partial<FlowAdvance>={}):FlowAdvance=>{finishStep();return {trace,state:snapshot(),messages,handoff,finished,...extra}};
 const clearWait=()=>{if(runtime?.wait)delete runtime.wait};
 const wait=(node:FlowNode,seconds:number,next:string,kind:'INPUT'|'CHOICE'|'DELAY')=>{
  const r=ensureRuntime();if(!r.wait||r.wait.nodeId!==node.id)r.wait={nodeId:node.id,expiresAt:now+seconds*1000,token:crypto.randomUUID()};
  return {seconds:Math.max(0,Math.ceil((r.wait.expiresAt-now)/1000)),next,kind,expiresAt:r.wait.expiresAt,token:r.wait.token};
 };
 const emitBlocks=(blocks:MessageBlock[]=[])=>{for(const block of blocks){if(block.type==='CARD'||block.type==='GALLERY'){const cards=block.type==='CARD'?[block.card]:block.cards;messages.push({type:'GALLERY',cards:cards.map(c=>({...c,title:renderFlowText(c.title,answers,80),subtitle:renderFlowText(c.subtitle||'',answers,160)}))})}else messages.push(block.type==='MEDIA'?{...block,caption:renderFlowText(block.caption||'',answers,1024)}:{type:'TEXT',text:renderFlowText(block.type==='LINK'?block.text+'\n'+block.url:block.text,answers)})}};
 const prompt=(node:Extract<FlowNode,{type:'INPUT'|'QUESTION'|'BUTTONS'|'LIST'}>)=>{
  if(node.type==='BUTTONS'&&node.blocks)emitBlocks(node.blocks);
  if(node.type==='BUTTONS'||node.type==='LIST')messages.push({type:node.type,text:renderFlowText(node.text,answers,1024),choices:node.choices,buttonText:node.type==='LIST'?node.buttonText:undefined});
  else if(node.type==='INPUT'&&node.policy?.skipNext)messages.push({type:'BUTTONS',text:renderFlowText(node.text,answers,1024),choices:[{id:'skip',title:'تخطي',next:node.policy.skipNext}]});
  else messages.push({type:'TEXT',text:renderFlowText(node.text,answers)});
 };
 const consentPrompt=(node:Extract<FlowNode,{type:'CONSENT'}>)=>messages.push({type:'BUTTONS',text:renderFlowText(node.text,answers,1024),choices:[{id:'accept',title:'أوافق',next:node.acceptNext},{id:'decline',title:'لا أوافق',next:node.declineNext},...(node.withdrawNext?[{id:'withdraw',title:'سحب الموافقة',next:node.withdrawNext}]:[])]});
 const current=nodes.get(at);if(!current)throw Error('Unknown current flow node');
 if(state.at!==null&&!context.enter){
  if(current.type==='CONSENT'){const prefix='flow:'+current.id+':',id=input?.kind==='CHOICE'&&input.value.startsWith(prefix)?input.value.slice(prefix.length):'';const next=id==='accept'?current.acceptNext:id==='decline'?current.declineNext:id==='withdraw'?current.withdrawNext:undefined;if(next)return result({pending:true,consent:{purpose:current.purpose,decision:id==='accept'?'GRANT':id==='decline'?'DENY':'WITHDRAW',next,nodeId:current.id,policyVersion:current.policyVersion,notice:renderFlowText(current.text,answers,1024)}});consentPrompt(current);return result();}
  if(current.type==='INPUT'||current.type==='QUESTION'||current.type==='BUTTONS'||current.type==='LIST'){
   const policy='policy'in current?current.policy:undefined,entry:FlowTrace={nodeId:current.id,type:current.type,outcome:'resume'};trace.push(entry);
   const timedOut=runtime?.wait?.nodeId===current.id&&now>=runtime.wait.expiresAt;
   if(input?.kind==='TIMEOUT'&&(!timedOut||input.value!==runtime?.wait?.token))return result();
   if(timedOut&&policy?.timeoutNext){at=policy.timeoutNext;entry.outcome='timeout';clearWait();if(runtime)delete runtime.attempts[current.id]}
   else if(current.type==='INPUT'&&(input?.kind==='SKIP'||input?.kind==='CHOICE'&&input.value==='flow:'+current.id+':skip'||input?.kind==='TEXT'&&!input.value.trim()&&policy?.required===false)&&policy?.required===false){at=policy.skipNext||current.next;entry.outcome='skip';clearWait();if(runtime)delete runtime.attempts[current.id]}
   else{
    let valid=false,error='اختر إجابة من الخيارات المتاحة.';
    if(current.type==='BUTTONS'||current.type==='LIST'){
     const prefix='flow:'+current.id+':',choice=input?.kind==='CHOICE'&&input.value.startsWith(prefix)?current.choices.find(c=>c.action!=='URL'&&c.id===input.value.slice(prefix.length)):undefined;
     if(choice){const effects:ChoiceEffect[]=[...(choice.assign?[{type:'SET_FIELD' as const,...choice.assign}]:[]),...(choice.effects||[])],staged={...answers};let effectsValid=true;for(const effect of effects)if(effect.type==='SET_FIELD'){const value=renderFlowText(effect.value,staged,500);if(!validVariableValue(flow.variables?.find(v=>v.key===effect.field),value))effectsValid=false;staged[effect.field]=value}if(effectsValid){Object.assign(answers,staged);for(const effect of effects)if(effect.type==='TAG'){const i=tags.indexOf(effect.tag);if(effect.mode==='ADD'&&i<0)tags.push(effect.tag);if(effect.mode==='REMOVE'&&i>=0)tags.splice(i,1)}answers['choice_'+current.id]=choice.title;answers['pick_'+current.id]=choice.id;at=choice.next;valid=true;entry.outcome='choice:'+choice.id}else entry.outcome='effect_invalid'}
    }else{
     if(input?.kind==='TEXT'){
      const variable=flow.variables?.find(v=>v.key===current.field),validation=current.type==='INPUT'?current.validation:undefined;
      const effective=current.type==='INPUT'&&!validation&&variable&&['text','email','phone','number','date','datetime','location'].includes(variable.type)?{...current,validation:{type:variable.type as InputValidation['type']}}:current;
      const checked=validateInputAnswer(effective,input.value);if(checked.valid&&!validVariableValue(variable,checked.value)){checked.valid=false;checked.error='الإجابة لا تطابق نوع الحقل أو قيمه المسموحة.'}error=checked.error;
      if(checked.valid){answers[current.field]=checked.value;at=current.next;valid=true;entry.outcome='input_valid'}
     }
    }
    if(!valid){
     if(input&&input.kind!=='TIMEOUT'&&policy?.maxAttempts){const r=ensureRuntime();r.attempts[current.id]=(r.attempts[current.id]||0)+1;if(r.attempts[current.id]>=policy.maxAttempts){at=policy.invalidNext!;entry.outcome='attempts_exhausted';clearWait();delete r.attempts[current.id]}else entry.outcome='invalid:'+r.attempts[current.id]}
     if(at===current.id){if(input?.kind==='TEXT'&&(current.type==='INPUT'||current.type==='QUESTION')&&input.value.trim())messages.push({type:'TEXT',text:error});if(policy||!messages.length||current.type==='BUTTONS'||current.type==='LIST')prompt(current);const waiting=policy?.timeoutSeconds?wait(current,policy.timeoutSeconds,policy.timeoutNext!,'INPUT'):undefined;const r=result(waiting?{waiting}:{});if(!policy)r.state=state;return r}
    }else{clearWait();if(runtime)delete runtime.attempts[current.id]}
   }
  }else if(current.type==='END'||current.type==='HANDOFF')at=flow.startId;
 }
 for(let hops=0;hops<120;hops++){
  const node=nodes.get(at);if(!node)throw Error('Node destination unavailable');finishStep();const entry:FlowTrace={nodeId:node.id,type:node.type,outcome:'entered',elapsedMs:0};trace.push(entry);
  if(node.type==='CONSENT'){consentPrompt(node);return result();}
  if(node.type==='CONTROL'){clearWait();entry.outcome='bot_'+node.operation.toLowerCase();return result({pending:true,botAction:{operation:node.operation,next:node.next,seconds:node.seconds}});}
  if(node.type==='HANDOFF'&&node.handoffPolicy)return result({pending:true});
  if(node.type==='DELAY'){
   let seconds=node.seconds;try{if(node.schedule)seconds=scheduledDelay(node.schedule,now,answers)}catch(e){if(node.errorNext){at=node.errorNext;entry.outcome='schedule_error';continue}throw e}
   if(!seconds){at=node.next;entry.outcome='schedule_ready';continue}
   // Old seconds-only DELAY states retain their original shape for compatibility.
   return result({waiting:node.schedule?wait(node,seconds,node.next,'DELAY'):{seconds,next:node.next}});
  }
  if(node.type==='BUSINESS_HOURS'){try{const open=businessIsOpen(node.schedule,now,answers);entry.outcome=open?'open':'closed';at=open?node.yes:node.no}catch{entry.outcome='schedule_error';at=node.no}continue}
  if(node.type==='KEYWORD'){const text=input?.kind==='TEXT'?input.value.toLowerCase():'';at=node.keywords.some(k=>text.includes(k.toLowerCase()))?node.yes:node.no;continue}
  if(node.type==='SUBFLOW')throw Error('Subflow must be compiled before execution');
  if(node.type==='CATALOG'||node.type==='AI'||node.type==='WEBHOOK'||node.type==='CONNECTOR'||node.type==='CRM_ACTION')return result({pending:true});
  if(node.type==='SET_FIELD'){const value=renderFlowText(node.value,answers,500);if(!validVariableValue(flow.variables?.find(v=>v.key===node.field),value)){entry.outcome='field_invalid';if(node.errorNext){at=node.errorNext;continue}throw Error('Assigned value does not match the typed variable')}answers[node.field]=value;entry.outcome='field_updated';at=node.next;continue}
  if(node.type==='GOAL'){entry.outcome='goal:'+node.goal;at=node.next;continue}
  if(node.type==='RANDOMIZER'){
   const saved=node.sticky?runtime?.experiments?.[node.id]:undefined;let branch=node.choices.find(c=>c.id===saved);
   if(!branch){let remaining=Math.max(0,Math.min(.999999,random()))*100;branch=node.choices.find(c=>{remaining-=c.weight;return remaining<0})||node.choices[node.choices.length-1];if(node.sticky){const r=ensureRuntime();r.experiments??=Object.create(null);r.experiments![node.id]=branch.id}}
   entry.outcome=branch.id;at=branch.next;continue;
  }
  if(node.type==='START'){at=node.next;continue}
  if(node.type==='TEXT'){messages.push({type:'TEXT',text:renderFlowText(node.text,answers)});emitBlocks(node.blocks);at=node.next;continue}
  if(node.type==='LINK'){messages.push({type:'TEXT',text:renderFlowText(node.text,answers)+'\n'+node.url});at=node.next;continue}
  if(node.type==='MEDIA'){messages.push({type:'MEDIA',mediaKind:node.mediaKind,url:node.url,caption:renderFlowText(node.caption||'',answers,1024)});at=node.next;continue}
  if(node.type==='TAG'){if(node.mode==='REMOVE'){const i=tags.indexOf(node.tag);if(i>=0)tags.splice(i,1)}else if(!tags.includes(node.tag))tags.push(node.tag);entry.outcome=node.mode==='REMOVE'?'tag_removed':'tag_added';at=node.next;continue}
  if(node.type==='CONDITION'){const matches=matchesCondition(node,answers,tags);entry.outcome=matches?'yes':'no';at=matches?node.yes:node.no;continue}
  if(node.type==='INPUT'||node.type==='QUESTION'||node.type==='BUTTONS'||node.type==='LIST'){
   prompt(node);const policy='policy'in node?node.policy:undefined;if(policy?.maxAttempts)ensureRuntime().attempts[node.id]=0;
   const waiting=policy?.timeoutSeconds?wait(node,policy.timeoutSeconds,policy.timeoutNext!,node.type==='INPUT'?'INPUT':'CHOICE'):undefined;return result(waiting?{waiting}:{});
  }
  messages.push({type:'TEXT',text:renderFlowText(node.text,answers)});if(node.type==='HANDOFF')handoff=true;else finished=true;clearWait();return result();
 }
 throw Error('Flow exceeded automatic step limit');
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