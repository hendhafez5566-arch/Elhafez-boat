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
export async function saveFlowDraft(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);
 let definition:FlowDefinition;
 try{definition=validateFlow(input)}catch(error){throw new HttpFailure(400,error instanceof Error?error.message:'Invalid flow')}
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
export async function respondToFlow(db:SqlClient,ctx:{tenantId:string;conversationId:string;contactId:string;actionId:string;body:string;fromWhatsApp:boolean}){
 const {tenantId,conversationId,contactId,actionId,body}=ctx;
 const session=await db.query(`SELECT version,node_id,answers,tags FROM chatbot_flow_sessions
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
 const restart=/^(القائمة|الرئيسية|ابدأ|start|menu)$/i.test(body.trim())||actionId==='flow:restart';
 let version=Number(previous?.version??0),flow:FlowDefinition;
 if(!previous||restart){
  const current=await db.query('SELECT version,definition FROM chatbot_flow_versions WHERE tenant_id=$1 ORDER BY version DESC LIMIT 1',[tenantId]);
  version=current.rowCount?Number(current.rows[0].version):0;
  flow=current.rowCount?validateFlow(current.rows[0].definition):exampleFlow('general');
 } else if(version===0){flow=exampleFlow('general')}
 else{
  const pinned=await db.query('SELECT definition FROM chatbot_flow_versions WHERE tenant_id=$1 AND version=$2',[tenantId,version]);
  if(pinned.rowCount!==1)throw new HttpFailure(409,'Published flow version unavailable');
  flow=validateFlow(pinned.rows[0].definition);
 }
 const state=(!previous||restart)?initialFlowState():{
  at:typeof previous.node_id==='string'?previous.node_id:null,
  answers:previous.answers&&typeof previous.answers==='object'&&!Array.isArray(previous.answers)?previous.answers as Record<string,string>:{},
  tags:Array.isArray(previous.tags)?previous.tags as string[]:[]
 };
 // Flow replies are untrusted until matching the current node & option ID.
 const inbound=actionId?{kind:'CHOICE' as const,value:actionId}:{kind:'TEXT' as const,value:body};
 const result=advanceFlow(flow,state,inbound);
 await db.query(`INSERT INTO chatbot_flow_sessions(tenant_id,conversation_id,version,node_id,answers,tags,updated_at)
 VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,now())
 ON CONFLICT(tenant_id,conversation_id) DO UPDATE SET version=EXCLUDED.version,node_id=EXCLUDED.node_id,
 answers=EXCLUDED.answers,tags=EXCLUDED.tags,updated_at=now()`,[
   tenantId,conversationId,version,result.state.at,JSON.stringify(result.state.answers),JSON.stringify(result.state.tags)
 ]);
 if(result.handoff){
  const leadId=await registerInterest(db,tenantId,conversationId,contactId,null);
  await db.query('UPDATE chatbot_leads SET custom_fields=$3::jsonb WHERE tenant_id=$1 AND id=$2',[tenantId,leadId,JSON.stringify(result.state.answers)]);
  await readyForAgent(db,tenantId,leadId,conversationId,null);
 }
 return {payloads:renderFlowMessages(flow,result.state.at,result.messages),handedOff:result.handoff};
}
/** Render choices with stable node identity: no untrusted titles used as routing IDs. */
export function renderFlowMessages(flow:FlowDefinition,at:string|null,messages:FlowMessage[]):Record<string,unknown>[]{
 const node=flow.nodes.find(n=>n.id===at);
 return messages.map(message=>{
  if(message.type==='TEXT')return {messaging_product:'whatsapp',type:'text',text:{preview_url:false,body:message.text}};
  if(!node||(node.type!=='BUTTONS'&&node.type!=='LIST'))throw new Error('Flow awaiting node not valid for options');
  const choices=message.choices.map(c=>({id:`flow:${node.id}:${c.id}`,title:c.title,description:c.description||''}));
  if(message.type==='BUTTONS')return {messaging_product:'whatsapp',type:'interactive',interactive:{type:'button',body:{text:message.text},action:{buttons:choices.map(c=>({type:'reply',reply:{id:c.id,title:c.title}}))}}};
  return {messaging_product:'whatsapp',type:'interactive',interactive:{type:'list',body:{text:message.text},action:{button:message.buttonText||'اختار',sections:[{title:'القائمة',rows:choices}]}}};
 });
}