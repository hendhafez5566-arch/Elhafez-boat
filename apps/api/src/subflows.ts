import {randomUUID,createHash} from 'node:crypto';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {validateFlow,mapConditionRules,type FlowDefinition,type FlowNode} from './flow-engine.js';
export async function listSubflows(db:SqlClient,actor:Actor){allow(actor,['OWNER','MANAGER']);return (await db.query(`SELECT s.id,s.name,v.version,v.definition FROM chatbot_subflows s JOIN chatbot_subflow_versions v ON v.tenant_id=s.tenant_id AND v.subflow_id=s.id WHERE s.tenant_id=$1 ORDER BY s.created_at DESC,v.version DESC LIMIT 500`,[actor.tenantId])).rows}
export async function saveSubflow(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);const d=input as {id?:string;definition?:unknown};let definition:FlowDefinition;
 try{definition=validateFlow(d.definition)}catch(e){throw new HttpFailure(400,e instanceof Error?e.message:'Invalid subflow')}
 if(!definition.nodes.some(n=>n.type==='END'))throw new HttpFailure(400,'Subflow requires an END return node');
 const id=d.id||randomUUID();if(!isUuid(id))throw new HttpFailure(400,'Invalid subflow id');
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 if(!d.id){const count=await db.query('SELECT count(*)::int AS n FROM chatbot_subflows WHERE tenant_id=$1',[actor.tenantId]);if(Number(count.rows[0].n)>=100)throw new HttpFailure(409,'Subflow library limit reached');await db.query('INSERT INTO chatbot_subflows(tenant_id,id,name) VALUES($1,$2,$3)',[actor.tenantId,id,definition.name]);}
 else{const r=await db.query('UPDATE chatbot_subflows SET name=$3 WHERE tenant_id=$1 AND id=$2 RETURNING id',[actor.tenantId,id,definition.name]);if(!r.rowCount)throw new HttpFailure(404,'Subflow not found')}
 // Resolve before saving: missing/cross-tenant references and expansion limits fail closed.
 await compileSubflows(db,actor.tenantId,definition,[id]);
 const r=await db.query(`INSERT INTO chatbot_subflow_versions(tenant_id,subflow_id,version,definition,created_by) SELECT $1,$2,coalesce(max(version),0)+1,$3::jsonb,$4 FROM chatbot_subflow_versions WHERE tenant_id=$1 AND subflow_id=$2 RETURNING version`,[actor.tenantId,id,JSON.stringify(definition),actor.userId]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'SUBFLOW_VERSION_CREATED','subflow',$3)`,[actor.tenantId,actor.userId,id]);return {id,version:r.rows[0].version,definition};
}
/** Resolve pinned tenant-private calls at publication. Immutable compiled graph returns at END.
 * This is compilation, not mutable copied snippets: source calls retain exact library versions.
 * Field bindings map callee keys to caller keys, so input/output persist safely across delays. */
export async function compileSubflows(db:SqlClient,tenantId:string,source:FlowDefinition,ancestors:string[]=[]):Promise<FlowDefinition>{
 let serial=0;const nodes:FlowNode[]=[],variables=new Map<string,import('./flow-engine.js').FlowVariable>();
 async function expand(flow:FlowDefinition,prefix:string,bindings:Record<string,string>,exit?:string,stack=ancestors){
  for(const field of flow.variables||[]){const key=Object.hasOwn(bindings,field.key)?bindings[field.key]:field.key;const v={...field,key};const existing=variables.get(key);if(existing&&(existing.type!==v.type||existing.scope!==v.scope||JSON.stringify(existing.options)!==JSON.stringify(v.options)))throw new HttpFailure(400,'Conflicting bound variable types');variables.set(key,v)}
  const map=(id:string)=>prefix?prefix+createHash('sha256').update(id).digest('hex').slice(0,20):id;
  for(const raw of flow.nodes){
   const n=JSON.parse(JSON.stringify(raw)) as FlowNode;n.id=map(n.id);
   if(n.type==='INPUT'&&!n.validation){const v=flow.variables?.find(v=>v.key===n.field);if(v&&['text','phone','email','number','date','datetime','location'].includes(v.type))n.validation={type:v.type as import('./flow-engine.js').InputValidation['type']}}
   const template=(text:string)=>text.replace(/\{\{([a-z][a-z0-9_]{0,39})\}\}/g,(token,key:string)=>Object.hasOwn(bindings,key)?'{{'+bindings[key]+'}}':token);
   if('text'in n)n.text=template(n.text);
   if(n.type==='MEDIA'&&n.caption)n.caption=template(n.caption);
   if(n.type==='SET_FIELD')n.value=template(n.value);
   if((n.type==='BUSINESS_HOURS'||n.type==='DELAY')&&n.schedule&&'timezoneField'in n.schedule&&n.schedule.timezoneField)n.schedule.timezoneField=Object.hasOwn(bindings,n.schedule.timezoneField)?bindings[n.schedule.timezoneField]:n.schedule.timezoneField;
   if((n.type==='TEXT'||n.type==='BUTTONS')&&n.blocks)n.blocks=n.blocks.map(b=>b.type==='MEDIA'?{...b,caption:template(b.caption||'')}:b.type==='CARD'?{...b,card:{...b.card,title:template(b.card.title),subtitle:template(b.card.subtitle||'')}}:b.type==='GALLERY'?{...b,cards:b.cards.map(c=>({...c,title:template(c.title),subtitle:template(c.subtitle||'')}))}:{...b,text:template(b.text)});
   if('field'in n)n.field=Object.hasOwn(bindings,n.field)?bindings[n.field]:n.field;
   if(n.type==='CONDITION'&&n.rules)n.rules=mapConditionRules(n.rules,field=>Object.hasOwn(bindings,field)?bindings[field]:field);
   if(n.type==='INPUT'&&n.acquisition)n.acquisition.unsupportedNext=map(n.acquisition.unsupportedNext);
   if('policy'in n&&n.policy){for(const key of ['invalidNext','timeoutNext','skipNext'] as const)if(n.policy[key])n.policy[key]=map(n.policy[key]!)}
   if((n.type==='WEBHOOK'||n.type==='CONNECTOR')&&n.request){n.request.errorNext=map(n.request.errorNext);n.request.timeoutNext=map(n.request.timeoutNext);n.request.body=Object.fromEntries(Object.entries(n.request.body).map(([key,value])=>[key,template(value)]));n.request.mapping=n.request.mapping.map(m=>({...m,field:Object.hasOwn(bindings,m.field)?bindings[m.field]:m.field}))}
   if(n.type==='CONSENT'){n.acceptNext=map(n.acceptNext);n.declineNext=map(n.declineNext);if(n.withdrawNext)n.withdrawNext=map(n.withdrawNext)}
   if(n.type==='HANDOFF'&&n.handoffPolicy){n.handoffPolicy.unavailableNext=map(n.handoffPolicy.unavailableNext);if(n.handoffPolicy.resumeNext)n.handoffPolicy.resumeNext=map(n.handoffPolicy.resumeNext);if(n.handoffPolicy.schedule?.timezoneField)n.handoffPolicy.schedule.timezoneField=Object.hasOwn(bindings,n.handoffPolicy.schedule.timezoneField)?bindings[n.handoffPolicy.schedule.timezoneField]:n.handoffPolicy.schedule.timezoneField;}
   if('errorNext'in n&&n.errorNext)n.errorNext=map(n.errorNext);
   if(n.type==='DELAY'){if(n.schedule?.mode==='AT'&&n.schedule.field)n.schedule.field=Object.hasOwn(bindings,n.schedule.field)?bindings[n.schedule.field]:n.schedule.field}
   if('next'in n)n.next=map(n.next);
   if(n.type==='BUTTONS'||n.type==='LIST'||n.type==='RANDOMIZER')n.choices=n.choices.map(c=>({...c,next:c.action==='URL'?c.next:map(c.next),...(c.effects?{effects:c.effects.map(e=>e.type==='SET_FIELD'?{...e,field:Object.hasOwn(bindings,e.field)?bindings[e.field]:e.field,value:template(e.value)}:e)}:{}),...(c.assign?{assign:{field:Object.hasOwn(bindings,c.assign.field)?bindings[c.assign.field]:c.assign.field,value:template(c.assign.value)}}:{})}));
   if(n.type==='CONDITION'||n.type==='KEYWORD'||n.type==='BUSINESS_HOURS'){n.yes=map(n.yes);n.no=map(n.no)}
   if(n.type==='SUBFLOW'){
    if(stack.includes(n.subflowId)||stack.length>=5)throw new HttpFailure(400,'Recursive or excessively nested subflow');
    const r=await db.query('SELECT definition FROM chatbot_subflow_versions WHERE tenant_id=$1 AND subflow_id=$2 AND version=$3',[tenantId,n.subflowId,n.version]);
    if(!r.rowCount)throw new HttpFailure(400,'Pinned subflow version unavailable in this company');
    const child=validateFlow(r.rows[0].definition),childPrefix='sf'+(++serial)+'_';
    const childBindings=Object.fromEntries(Object.entries(n.bindings||{}).map(([k,v])=>[k,Object.hasOwn(bindings,v)?bindings[v]:v]));
    nodes.push({id:n.id,type:'START',next:childPrefix+createHash('sha256').update(child.startId).digest('hex').slice(0,20)});
    await expand(child,childPrefix,childBindings,n.next,[...stack,n.subflowId]);
   }else if(n.type==='END'&&exit){nodes.push({id:n.id,type:'TEXT',text:n.text,next:exit})}
   else nodes.push(n);
   if(nodes.length>100)throw new HttpFailure(400,'Expanded flow exceeds 100 nodes');
  }
 }
 await expand(source,'',{});
 // Nested entry nodes become empty transitions (START); runtime validation allows several.
 const compiled={...source,nodes,...(variables.size?{variables:[...variables.values()]}:{})};validateFlow(compiled,{runtime:true});return compiled;
}
