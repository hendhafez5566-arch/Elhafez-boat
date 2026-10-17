import {validateManagedMedia} from './media.js';
import {matchTrigger} from './triggers.js';
import {enqueueIntegration,webhookURL} from './integrations.js';
import {groundedReply} from './ai.js';
/** Tenant-scoped draft/publish operations for industry-independent chatbot flows. */
import {allow,HttpFailure,type Actor,type SqlClient} from './services.js';
import {exampleFlow,validateFlow,advanceFlow,initialFlowState,type FlowDefinition,type FlowMessage} from './flow-engine.js';
import {registerInterest,readyForAgent} from './chatbot-leads.js';

export async function getFlowConfig(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 const [draft,live]=await Promise.all([
  db.query('SELECT definition,draft_revision AS "draftRevision",updated_at AS "updatedAt" FROM chatbot_flow_drafts WHERE tenant_id=$1',[actor.tenantId]),
  db.query('SELECT version,definition,published_at AS "publishedAt" FROM chatbot_flow_versions WHERE tenant_id=$1 ORDER BY version DESC LIMIT 1',[actor.tenantId])
 ]);
 return {draft:draft.rows[0]??{definition:exampleFlow(),draftRevision:0},published:live.rows[0]??null};
}
export async function saveFlowDraft(db:SqlClient,actor:Actor,input:unknown,internal=false){
 allow(actor,['OWNER','MANAGER']);
 let definition:FlowDefinition;
 try{definition=validateFlow(input,{draft:true})}catch(error){throw new HttpFailure(400,error instanceof Error?error.message:'Invalid flow')}
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const current=await db.query('SELECT draft_revision FROM chatbot_flow_drafts WHERE tenant_id=$1 FOR UPDATE',[actor.tenantId]);
 const expected=(input as {expectedRevision?:unknown}).expectedRevision;
 if(!internal&&(!Number.isInteger(expected)||Number(expected)!==Number(current.rows[0]?.draft_revision||0)))throw new HttpFailure(409,'Draft changed in another session; reload before saving');
 const saved=await db.query(`INSERT INTO chatbot_flow_drafts(tenant_id,definition,updated_by)
 VALUES($1,$2::jsonb,$3) ON CONFLICT(tenant_id) DO UPDATE
 SET definition=EXCLUDED.definition,draft_revision=chatbot_flow_drafts.draft_revision+1,
 updated_by=EXCLUDED.updated_by,updated_at=now()
 RETURNING draft_revision AS "draftRevision"`,[actor.tenantId,JSON.stringify(definition),actor.userId]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'FLOW_DRAFT_SAVED','bot_flow','default')`,[actor.tenantId,actor.userId]);
 return {draftRevision:saved.rows[0].draftRevision,definition};
}
export async function publishFlowDraft(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER']);
 // Tenant row lock serializes competing publishes even across different workers.
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const draft=await db.query('SELECT definition,draft_revision FROM chatbot_flow_drafts WHERE tenant_id=$1 FOR UPDATE',[actor.tenantId]);
 if(draft.rowCount!==1)throw new HttpFailure(409,'Save a draft before publishing');
 let definition:FlowDefinition;
 try{definition=validateFlow(draft.rows[0].definition)}catch(error){throw new HttpFailure(400,error instanceof Error?error.message:'Invalid flow')}
 const triggers=await db.query('SELECT target_node FROM chatbot_triggers WHERE tenant_id=$1 AND enabled=true',[actor.tenantId]);
 if(triggers.rows.some(t=>!definition.nodes.some(n=>n.id===t.target_node)))throw new HttpFailure(400,'An active trigger references a removed node; update triggers before publishing');
 for(const node of definition.nodes)if(node.type==='MEDIA')await validateManagedMedia(db,actor.tenantId,node.url,node.mediaKind);
 for(const node of definition.nodes)if(node.type==='WEBHOOK'){
  const integration=await db.query('SELECT url FROM chatbot_integrations WHERE tenant_id=$1 AND id=$2 AND enabled=true',[actor.tenantId,node.integrationId]);
  if(!integration.rowCount)throw new HttpFailure(400,'Flow references an unavailable integration');
  webhookURL(String(integration.rows[0].url));
 }
 const saved=await db.query(`INSERT INTO chatbot_flow_versions(tenant_id,version,definition,draft_revision,published_by)
 SELECT $1,COALESCE(MAX(version),0)+1,$2::jsonb,$3,$4 FROM chatbot_flow_versions WHERE tenant_id=$1
 RETURNING version,published_at AS "publishedAt"`,[actor.tenantId,JSON.stringify(definition),draft.rows[0].draft_revision,actor.userId]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'FLOW_PUBLISHED','bot_flow',$3)`,[actor.tenantId,actor.userId,String(saved.rows[0].version)]);
 return {version:saved.rows[0].version,publishedAt:saved.rows[0].publishedAt};
}
export async function listFlowVersions(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 return (await db.query('SELECT version,published_at AS "publishedAt" FROM chatbot_flow_versions WHERE tenant_id=$1 ORDER BY version DESC LIMIT 30',[actor.tenantId])).rows;
}

/** Run published flow after signed Meta webhook receipt and under tenant transaction. */
export async function respondToFlow(db:SqlClient,ctx:{tenantId:string;conversationId:string;contactId:string;actionId:string;body:string;fromWhatsApp:boolean;resume?:{version:number;nodeId:string}}){
 const {tenantId,conversationId,contactId,actionId,body}=ctx;
 const session=await db.query(`SELECT version,node_id,answers,tags,runtime_nodes FROM chatbot_flow_sessions
 WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE`,[tenantId,conversationId]);
 const previous=session.rows[0];
 // Customer can request an employee at ANY point, even mid-question.
 if(actionId==='handoff'||/^(موظف|عايز موظف|عاوز موظف|خدمة العملاء|كلموني|عايز حد|عاوز حد|human|agent)$/i.test(body.trim())){
   const leadId=await registerInterest(db,tenantId,conversationId,contactId,null);
   if(previous?.answers&&typeof previous.answers==='object'&&!Array.isArray(previous.answers))
     await db.query('UPDATE chatbot_leads SET custom_fields=$3::jsonb WHERE tenant_id=$1 AND id=$2',
       [tenantId,leadId,JSON.stringify(previous.answers)]);
   await readyForAgent(db,tenantId,leadId,conversationId,null);
   return {payloads:[{messaging_product:'whatsapp',type:'text',text:{preview_url:false,
     body:'تم تحويل محادثتك للموظف المختص. هيكمل معاك كل التفاصيل.'}}],handedOff:true};
 }
 const triggered=!ctx.resume&&(!previous||body)?await matchTrigger(db,tenantId,body,!previous):undefined;
 const restart=Boolean(triggered)||/^(القائمة|الرئيسية|ابدأ|start|menu)$/i.test(body.trim())||actionId==='flow:restart';
 let version=Number(previous?.version??0),flow:FlowDefinition;
 if(!previous||restart){
  const current=await db.query('SELECT version,definition FROM chatbot_flow_versions WHERE tenant_id=$1 ORDER BY version DESC LIMIT 1',[tenantId]);
  version=current.rowCount?Number(current.rows[0].version):0;
  flow=current.rowCount?validateFlow(current.rows[0].definition):unpublishedFlow();
 } else if(version===0){flow=unpublishedFlow()}
 else{
  const pinned=await db.query('SELECT definition FROM chatbot_flow_versions WHERE tenant_id=$1 AND version=$2',[tenantId,version]);
  if(pinned.rowCount!==1)throw new HttpFailure(409,'Published flow version unavailable');
  flow=validateFlow(pinned.rows[0].definition);
 }
 if(previous?.runtime_nodes&&!restart&&Array.isArray(previous.runtime_nodes)){
  const runtime=previous.runtime_nodes as FlowDefinition['nodes'];
  // Only catalog choices need stable persisted snapshots. AI/webhook nodes must run anew.
  flow={...flow,nodes:[...flow.nodes.map(n=>n.type==='CATALOG'?(runtime.find(x=>x.id===n.id)||n):n),...runtime.filter(n=>n.id.startsWith('@catalog:'))]};
 }
 const state=(!previous||restart)?initialFlowState():{
  at:typeof previous.node_id==='string'?previous.node_id:null,
  answers:previous.answers&&typeof previous.answers==='object'&&!Array.isArray(previous.answers)?previous.answers as Record<string,string>:{},
  tags:Array.isArray(previous.tags)?previous.tags as string[]:[]
 };
 if(triggered){
  if(!flow.nodes.some(n=>n.id===triggered))throw new HttpFailure(409,'Trigger target is not in the current published flow');
  state.at=triggered;
 }
 const waitingNode=flow.nodes.find(n=>n.id===state.at);
 if(ctx.resume){
  if(!previous||Number(previous.version)!==ctx.resume.version||previous.node_id!==ctx.resume.nodeId||waitingNode?.type!=='DELAY')return {payloads:[],handedOff:false};
  state.at=waitingNode.next;
 }else if(waitingNode?.type==='DELAY'&&!restart)return {payloads:[],handedOff:false};
 await db.query("UPDATE chatbot_delay_jobs SET status='CANCELLED' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING'",[tenantId,conversationId]);
 // Flow replies are untrusted until matching the current node & option ID.
 const inbound=actionId?{kind:'CHOICE' as const,value:actionId}:{kind:'TEXT' as const,value:body};
 const result=await executeFlow(db,tenantId,flow,state,ctx.resume||triggered?undefined:inbound);
 flow=result.flow;
 await db.query(`INSERT INTO chatbot_flow_sessions(tenant_id,conversation_id,version,node_id,answers,tags,runtime_nodes,updated_at)
 VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,now())
 ON CONFLICT(tenant_id,conversation_id) DO UPDATE SET version=EXCLUDED.version,node_id=EXCLUDED.node_id,
 answers=EXCLUDED.answers,tags=EXCLUDED.tags,runtime_nodes=EXCLUDED.runtime_nodes,updated_at=now()`,[
   tenantId,conversationId,version,result.state.at,JSON.stringify(result.state.answers),JSON.stringify(result.state.tags),JSON.stringify(flow.nodes.filter(n=>n.id.startsWith('@catalog:')||result.flow.nodes.find(x=>x.id===n.id)?.type==='LIST'))
 ]);
 if(result.waiting){
  await db.query(`INSERT INTO chatbot_delay_jobs(tenant_id,conversation_id,version,node_id,due_at) VALUES($1,$2,$3,$4,now()+($5::int*interval '1 second')) ON CONFLICT(tenant_id,conversation_id) DO UPDATE SET version=$3,node_id=$4,due_at=EXCLUDED.due_at,status='PENDING',error=NULL`,[tenantId,conversationId,version,result.state.at,result.waiting.seconds]);
 }
 if(!result.handoff&&(Object.keys(result.state.answers).length||result.state.tags.length)){
  const leadId=await registerInterest(db,tenantId,conversationId,contactId,null);
  await db.query('UPDATE chatbot_leads SET custom_fields=$3::jsonb,updated_at=now() WHERE tenant_id=$1 AND id=$2',[tenantId,leadId,JSON.stringify({...result.state.answers,lead_tags:result.state.tags.join(', ')})]);
 }
 if(result.handoff){
  const leadId=await registerInterest(db,tenantId,conversationId,contactId,null);
  await db.query('UPDATE chatbot_leads SET custom_fields=$3::jsonb WHERE tenant_id=$1 AND id=$2',[tenantId,leadId,JSON.stringify({...result.state.answers,lead_tags:result.state.tags.join(', ')})]);
  await readyForAgent(db,tenantId,leadId,conversationId,null);
 }
 return {payloads:renderFlowMessages(flow,result.state.at,result.messages),handedOff:result.handoff};
}
/** Render choices with stable node identity: no untrusted titles used as routing IDs. */
export function renderFlowMessages(flow:FlowDefinition,at:string|null,messages:FlowMessage[]):Record<string,unknown>[]{
 const node=flow.nodes.find(n=>n.id===at);
 return messages.map(message=>{
  if(message.type==='TEXT')return {messaging_product:'whatsapp',type:'text',text:{preview_url:false,body:message.text}};
  if(message.type==='MEDIA'){
    const attachment:Record<string,unknown>={link:message.url};
    if(message.caption && (message.mediaKind==='image'||message.mediaKind==='video'||message.mediaKind==='document'))attachment.caption=message.caption;
    return {messaging_product:'whatsapp',type:message.mediaKind,[message.mediaKind]:attachment};
  }
  if(!node||(node.type!=='BUTTONS'&&node.type!=='LIST'))throw new Error('Flow awaiting node not valid for options');
  const choices=message.choices.map(c=>({id:`flow:${node.id}:${c.id}`,title:c.title,description:c.description||''}));
  if(message.type==='BUTTONS')return {messaging_product:'whatsapp',type:'interactive',interactive:{type:'button',body:{text:message.text},action:{buttons:choices.map(c=>({type:'reply',reply:{id:c.id,title:c.title}}))}}};
  return {messaging_product:'whatsapp',type:'interactive',interactive:{type:'list',body:{text:message.text},action:{button:message.buttonText||'اختار',sections:[{title:'القائمة',rows:choices}]}}};
 });
}
/** Rollback creates a new immutable live revision; existing sessions remain pinned. */
export async function rollbackFlow(db:SqlClient,actor:Actor,version:string){
 allow(actor,['OWNER','MANAGER']);
 if(!/^[1-9][0-9]{0,8}$/.test(version))throw new HttpFailure(400,'Invalid version');
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const r=await db.query('SELECT definition FROM chatbot_flow_versions WHERE tenant_id=$1 AND version=$2',[actor.tenantId,Number(version)]);
 if(r.rowCount!==1)throw new HttpFailure(404,'Version not found');
 await saveFlowDraft(db,actor,r.rows[0].definition,true);
 return publishFlowDraft(db,actor);
}

/** Resolve approved dynamic content without changing immutable flow definitions. */
export async function resolveFlow(db:SqlClient,tenantId:string,flow:FlowDefinition,answers:Record<string,string>,incoming:string,onlyId?:string,dryRun=false){
 const nodes=[];
 const target=flow.nodes.find(n=>n.id===onlyId);
 const activeRoot=target?.type==='CATALOG'?(target.id.startsWith('@catalog:')?target.id.split(':')[1]:target.id):null;
 for(const node of flow.nodes){
  if(activeRoot&&target?.type==='CATALOG'){
   if(node.id.startsWith('@catalog:'+activeRoot+':')&&node.id!==target.id)continue;
   if(node.id===activeRoot&&node.id!==target.id){nodes.push({id:activeRoot,type:'CATALOG' as const,category:target.category,next:target.next});continue}
  }

  if(node.type==='CATALOG'&&(!onlyId||node.id===onlyId)){
   const page=Math.max(0,Math.min(10000,node.page||0));
   const r=await db.query(`SELECT id,title,description,price_text,external_url,image_url FROM chatbot_catalog_items WHERE tenant_id=$1 AND status='PUBLISHED' AND ($2='' OR category_label=$2) ORDER BY id LIMIT 9 OFFSET $3`,[tenantId,node.category||'',page*8]);
   if(!r.rows.length){nodes.push({id:node.id,type:'TEXT' as const,text:'لا توجد عناصر منشورة حاليًا في التصنيف.',next:node.next});continue}
   const choices=[];const root=node.id.startsWith('@catalog:')?node.id.split(':')[1]:node.id;
   for(const [i,item] of r.rows.slice(0,8).entries()){
    const detail='@catalog:'+root+':item:'+String(item.id).replace(/-/g,'');
    choices.push({id:'item'+i,title:String(item.title).slice(0,24),description:String(item.price_text||item.description).slice(0,72),next:detail});
    const text=[item.title,item.description,item.price_text,item.external_url].filter(Boolean).join('\n');
    nodes.push({id:detail,type:'TEXT' as const,text:text.slice(0,4096),next:detail+':actions'},
     {id:detail+':actions',type:'BUTTONS' as const,text:'هل تحب تتواصل مع موظف بخصوص '+String(item.title).slice(0,160)+'؟',choices:[{id:'interest',title:'مهتم — كلم موظف',next:detail+':handoff'},{id:'back',title:'رجوع للكتالوج',next:node.id},{id:'continue',title:'متابعة',next:node.next}]},
     {id:detail+':handoff',type:'HANDOFF' as const,text:'تم تسجيل اهتمامك بـ '+String(item.title).slice(0,160)+' وتحويله للفريق.'});
   }
   for(const [label,p] of [['السابق',page-1],['التالي',page+1]] as const){
    if(p<0||(label==='التالي'&&r.rows.length<9))continue;
    const id='@catalog:'+root+':page:'+p;choices.push({id:label==='التالي'?'nextpage':'prevpage',title:label,description:'',next:id});
    if(!nodes.some(n=>n.id===id))nodes.push({id,type:'CATALOG' as const,category:node.category,page:p,next:node.next});
   }
   nodes.push({id:node.id,type:'LIST' as const,text:'اختر منتجًا أو خدمة من الكتالوج المعتمد',buttonText:'عرض الكتالوج',choices});
  }else if(node.type==='WEBHOOK'&&(!onlyId||node.id===onlyId)){
   if(!dryRun)await enqueueIntegration(db,tenantId,node.integrationId,{event:'FLOW_WEBHOOK',fields:answers});
   nodes.push({id:node.id,type:'START' as const,next:node.next});
  }else if(node.type==='AI'&&(!onlyId||node.id===onlyId)){
   const result=await groundedReply(db,tenantId,answers[node.field]||incoming);
   nodes.push(result.handoff?{id:node.id,type:'HANDOFF' as const,text:result.text}:{id:node.id,type:'TEXT' as const,text:result.text,next:node.next});
  }else nodes.push(node);
 }
 return {...flow,nodes:[...new Map(nodes.map(n=>[n.id,n])).values()]};
}

export async function executeFlow(db:SqlClient,tenantId:string,definition:FlowDefinition,state:import('./flow-engine.js').FlowState,input?:{kind:'TEXT'|'CHOICE';value:string},dryRun=false){
 let flow=definition,result=advanceFlow(flow,state,input);const messages=[...result.messages];
 for(let hops=0;result.pending&&hops<20;hops++){
  flow=await resolveFlow(db,tenantId,flow,result.state.answers,input?.value||'',result.state.at||'',dryRun);
  result=advanceFlow(flow,result.state,input);messages.push(...result.messages);
 }
 if(result.pending)throw new HttpFailure(400,'Dynamic node execution limit exceeded');
 return {...result,messages,flow};
}

function unpublishedFlow():FlowDefinition{return {name:'مساعد الشركة',startId:'start',nodes:[{id:'start',type:'START',next:'handoff'},{id:'handoff',type:'HANDOFF',text:'معلومات الشركة لم تُنشر بعد. وصل استفسارك للفريق للرد عليك.'}]}}
