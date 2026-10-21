import {triggerMatches,validTriggerPostback,type TriggerContext} from './flow-triggers.js';
import {definitionHash} from './flow-release.js';
import {setBotControl} from './conversation-control.js';
import {recordFlowConsent} from './flow-consent.js';
import {businessIsOpen} from './flow-time.js';
import {flowReadiness} from './flow-release.js';
import {assertFlowApproved} from './flow-review.js';
import {galleryFallback,contentMedia} from './flow-content.js';
import {mapRequestResponse,type RequestMock} from './flow-request.js';
import {flowChannelIssues} from './flow-capabilities.js';
import {flowStorage} from './flow-storage.js';
import {resolveConversationBot} from './bot-routing.js';
import {createHash,randomUUID} from 'node:crypto';
import {compileSubflows} from './subflows.js';
import {enqueueConnector} from './connectors.js';
import {validateManagedMedia} from './media.js';
import {matchTrigger} from './triggers.js';
import {enqueueIntegration,webhookURL} from './integrations.js';
import {groundedReply} from './ai.js';
/** Tenant-scoped draft/publish operations for industry-independent chatbot flows. */
import {allow,HttpFailure,type Actor,type SqlClient} from './services.js';
import {exampleFlow,validateFlow,advanceFlow,initialFlowState,validVariableValue,renderFlowText as importRender,type FlowDefinition,type FlowMessage,type FlowInput,type FlowState} from './flow-engine.js';
import {registerInterest,readyForAgent} from './chatbot-leads.js';

export async function getFlowConfig(db:SqlClient,actor:Actor,botId?:string){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 const store=flowStorage(db,actor,botId);
 const [draft,live]=await Promise.all([store.draft(),store.published()]);
 return {draft:draft.rows[0]??{definition:exampleFlow(),draftRevision:0},published:live.rows[0]??null};
}
export async function saveFlowDraft(db:SqlClient,actor:Actor,input:unknown,internal=false,botId?:string){
 allow(actor,['OWNER','MANAGER']);
 let definition:FlowDefinition;
 try{definition=validateFlow(input,{draft:true})}catch(error){throw new HttpFailure(400,error instanceof Error?error.message:'Invalid flow')}
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const store=flowStorage(db,actor,botId);
 const current=await store.draft(true);
 const expected=(input as {expectedRevision?:unknown}).expectedRevision;
 const mutation=(input as {mutationId?:unknown}).mutationId;
 if(mutation!==undefined&&(typeof mutation!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mutation)))throw new HttpFailure(400,'Invalid save mutation identifier');
 const requestHash=definitionHash({definition,expectedRevision:expected});
 if(!internal&&mutation){
  const receipt=await db.query('SELECT request_hash,draft_revision FROM chatbot_flow_save_receipts WHERE tenant_id=$1 AND actor_id=$2 AND flow_scope=$3 AND mutation_id=$4 AND expires_at>now()',[actor.tenantId,actor.userId,botId??'default',mutation]);
  if(receipt.rowCount){const r=receipt.rows[0];if(r.request_hash!==requestHash)throw new HttpFailure(409,'Save mutation identifier was already used for different content');return {draftRevision:Number(r.draft_revision),definition,replayed:true,superseded:Number(current.rows[0]?.draftRevision)!==Number(r.draft_revision)};}
 }

 if(!internal&&(!Number.isInteger(expected)||Number(expected)!==Number(current.rows[0]?.draftRevision||0)))throw new HttpFailure(409,'Draft changed in another session; reload before saving');
 const saved=await store.save(definition);
 if(!botId)await db.query(`INSERT INTO chatbot_bots(tenant_id,id,name,legacy_default,created_by) VALUES($1,$1,'البوت الأساسي',true,$2) ON CONFLICT DO NOTHING`,[actor.tenantId,actor.userId]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'FLOW_DRAFT_SAVED','bot_flow',$3)`,[actor.tenantId,actor.userId,botId??'default']);
 if(!internal&&mutation){
  await db.query('DELETE FROM chatbot_flow_save_receipts WHERE tenant_id=$1 AND actor_id=$2 AND expires_at<=now()',[actor.tenantId,actor.userId]);
  await db.query('INSERT INTO chatbot_flow_save_receipts(tenant_id,actor_id,flow_scope,mutation_id,request_hash,draft_revision) VALUES($1,$2,$3,$4,$5,$6)',[actor.tenantId,actor.userId,botId??'default',mutation,requestHash,saved.rows[0].draftRevision]);
 }
 return {draftRevision:saved.rows[0].draftRevision,definition};
}
export async function publishFlowDraft(db:SqlClient,actor:Actor,botId?:string){
 allow(actor,['OWNER','MANAGER']);
 // Tenant row lock serializes competing publishes even across different workers.
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const store=flowStorage(db,actor,botId);
 const draft=await store.draft(true);
 if(draft.rowCount!==1)throw new HttpFailure(409,'Save a draft before publishing');
 const readiness=await flowReadiness(db,actor,draft.rows[0].definition,botId);
 if(!readiness.publishable||!readiness.definition||!readiness.source)throw new HttpFailure(400,readiness.issues.some(i=>i.code==='MEDIA_UNAVAILABLE')?'Managed media is unavailable in this company':readiness.issues.filter(i=>i.severity==='error').map(i=>i.message).join(' '));
 const definition=readiness.definition,sourceDefinition=readiness.source;
 await assertFlowApproved(db,actor,botId,Number(draft.rows[0].draftRevision),sourceDefinition);
 if(sourceDefinition.triggers!==undefined){
  const table=botId?'chatbot_bot_triggers':'chatbot_triggers';await db.query(`DELETE FROM ${table} WHERE tenant_id=$1${botId?' AND bot_id=$2':''}`,botId?[actor.tenantId,botId]:[actor.tenantId]);
  for(const trigger of sourceDefinition.triggers)await db.query(`INSERT INTO ${table}(tenant_id,kind,phrase,match_mode,target_node,priority,enabled,channel${botId?',bot_id':''}) VALUES($1,$2,$3,$4,$5,$6,$7,$8${botId?',$9':''})`,[actor.tenantId,trigger.kind,trigger.phrase,trigger.matchMode,trigger.targetNode,trigger.priority,trigger.enabled,trigger.channel??null,...(botId?[botId]:[])]);
 }
 const saved=await store.publish(definition,draft.rows[0].draftRevision,sourceDefinition);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'FLOW_PUBLISHED','bot_flow',$3)`,[actor.tenantId,actor.userId,(botId?botId+':':'')+String(saved.rows[0].version)]);
 return {version:saved.rows[0].version,publishedAt:saved.rows[0].publishedAt};
}
export async function listFlowVersions(db:SqlClient,actor:Actor,botId?:string){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 return (await flowStorage(db,actor,botId).versions()).rows;
}

/** Run published flow after signed Meta webhook receipt and under tenant transaction. */
export async function respondToFlow(db:SqlClient,ctx:{tenantId:string;conversationId:string;contactId:string;actionId:string;body:string;fromWhatsApp:boolean;triggerEvent?:import('./flow-triggers.js').TriggerEvent;resume?:{version:number;nodeId:string;waitToken?:string};integrationResume?:{jobId:string;token:string};connectorResume?:{jobId:string;token:string};operatorResume?:boolean}){
 const {tenantId,conversationId,contactId,actionId,body}=ctx;
 const ownership=await db.query('SELECT status,bot_control FROM conversations WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,conversationId]);
 const control=(ownership.rows[0]?.bot_control||{}) as {mode?:string};
 if(!ctx.operatorResume&&(ownership.rows[0]?.status==='HUMAN'||['PAUSED','STOPPED','HANDOFF'].includes(control.mode||'')))return {payloads:[],handedOff:false};

 const session=await db.query(`SELECT version,node_id,answers,tags,runtime_nodes,bot_id,runtime_state FROM chatbot_flow_sessions
 WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE`,[tenantId,conversationId]);
 const previous=session.rows[0],previousRuntime=previous?.runtime_state as FlowState['runtime'];
 const bot=previous&&!previous.bot_id?null:await resolveConversationBot(db,tenantId,conversationId,previous?.bot_id);
 const botId=bot?.id??null;
 const botVersions=bot&&!bot.legacy_default;
 const readVersion=async(version?:number)=>db.query(
  `SELECT version,definition FROM ${botVersions?'chatbot_bot_versions':'chatbot_flow_versions'} WHERE tenant_id=$1${botVersions?' AND bot_id=$2':''}${version===undefined?' ORDER BY version DESC LIMIT 1':` AND version=$${botVersions?3:2}`}`,
  [tenantId,...(botVersions?[botId]:[]),...(version===undefined?[]:[version])]);
 // Customer can request an employee at ANY point, even mid-question.
 if(actionId==='handoff'||/^(موظف|عايز موظف|عاوز موظف|خدمة العملاء|كلموني|عايز حد|عاوز حد|human|agent)$/i.test(body.trim())){
   const leadId=await registerInterest(db,tenantId,conversationId,contactId,null);
   const pinned=previous?.version?await readVersion(Number(previous.version)):undefined;
   const registry=(pinned?.rows[0]?.definition as FlowDefinition|undefined)?.variables;
   const contactAnswers=Object.fromEntries(Object.entries(previous?.answers||{}).filter(([key])=>!registry?.some(v=>v.key===key&&v.scope==='session')));
   if(previous?.answers&&typeof previous.answers==='object'&&!Array.isArray(previous.answers))
     await db.query('UPDATE chatbot_leads SET custom_fields=$3::jsonb WHERE tenant_id=$1 AND id=$2',
       [tenantId,leadId,JSON.stringify(contactAnswers)]);
   await readyForAgent(db,tenantId,leadId,conversationId,null);
   return {payloads:[{messaging_product:'whatsapp',type:'text',text:{preview_url:false,
     body:'تم تحويل محادثتك للموظف المختص. هيكمل معاك كل التفاصيل.'}}],handedOff:true};
 }
 const transport=await db.query('SELECT channel FROM conversations WHERE tenant_id=$1 AND id=$2',[tenantId,conversationId]);
 const channel=transport.rows[0]?.channel||(ctx.fromWhatsApp?'WHATSAPP':'WEBSITE');
 let validPostback=!actionId||(!previous&&actionId==='flow:restart');
 if(actionId&&previous?.version){const pinned=(await readVersion(Number(previous.version))).rows[0]?.definition as FlowDefinition|undefined;if(pinned)validPostback=validTriggerPostback({...pinned,nodes:Array.isArray(previous.runtime_nodes)?[...pinned.nodes,...previous.runtime_nodes]:pinned.nodes},typeof previous.node_id==='string'?previous.node_id:null,actionId,previousRuntime);}
 const triggered=validPostback&&!ctx.operatorResume&&!ctx.integrationResume&&!ctx.connectorResume&&!ctx.resume&&(!previous||body||actionId||ctx.triggerEvent)?await matchTrigger(db,tenantId,body,!previous,botVersions?String(botId):undefined,{channel:channel as import('./flow-engine.js').FlowChannel,event:ctx.triggerEvent||(actionId?'POSTBACK':'MESSAGE')}):undefined;
 const restart=Boolean(triggered)||/^(القائمة|الرئيسية|ابدأ|start|menu)$/i.test(body.trim())||actionId==='flow:restart';
 let version=Number(previous?.version??0),flow:FlowDefinition;
 if(!previous||restart){
  const current=await readVersion();
  version=current.rowCount?Number(current.rows[0].version):0;
  flow=current.rowCount?validateFlow(current.rows[0].definition,{runtime:true}):unpublishedFlow();
 } else if(version===0){flow=unpublishedFlow()}
 else{
  const pinned=await readVersion(version);
  if(pinned.rowCount!==1)throw new HttpFailure(409,'Published flow version unavailable');
  flow=validateFlow(pinned.rows[0].definition,{runtime:true});
 }
 if(previous?.runtime_nodes&&!restart&&Array.isArray(previous.runtime_nodes)){
  const runtime=previous.runtime_nodes as FlowDefinition['nodes'];
  // Only catalog choices need stable persisted snapshots. AI/webhook nodes must run anew.
  flow={...flow,nodes:[...flow.nodes.map(n=>n.type==='CATALOG'?(runtime.find(x=>x.id===n.id)||n):n),...runtime.filter(n=>n.id.startsWith('@catalog:'))]};
 }
 const state:FlowState=(!previous||restart)?initialFlowState():{
  at:typeof previous.node_id==='string'?previous.node_id:null,
  answers:previous.answers&&typeof previous.answers==='object'&&!Array.isArray(previous.answers)?previous.answers as Record<string,string>:{},
  tags:Array.isArray(previous.tags)?previous.tags as string[]:[],
  ...(previous.runtime_state&&typeof previous.runtime_state==='object'&&Object.keys(previous.runtime_state as object).length?{runtime:previous.runtime_state as FlowState['runtime']}:{})
 };
 if(restart&&Number(previous?.version)===version&&previousRuntime?.experiments)state.runtime={attempts:{},experiments:previousRuntime.experiments};
 if(triggered){
  if(!flow.nodes.some(n=>n.id===triggered))throw new HttpFailure(409,'Trigger target is not in the current published flow');
  state.at=triggered;
 }
 if(['WHATSAPP','WEBSITE','MESSENGER','INSTAGRAM','TELEGRAM'].includes(String(channel))&&flowChannelIssues(flow,channel as import('./flow-engine.js').FlowChannel).some(i=>i.severity==='error'))throw new HttpFailure(409,'Flow content is incompatible with this conversation channel');
 const waitingNode=flow.nodes.find(n=>n.id===state.at);
 let resumedInput:FlowInput|undefined;let requestOutcome:string|undefined;
 const asyncResume=ctx.integrationResume??ctx.connectorResume;
 if(asyncResume){
  const queue=ctx.connectorResume?'chatbot_connector_jobs':'chatbot_integration_jobs';
  const completion=await db.query(`SELECT flow_version,flow_node_id,wait_token,result_outcome,result_fields FROM ${queue} WHERE tenant_id=$1 AND id=$2 AND conversation_id=$3 AND completion_pending=true`,[tenantId,asyncResume.jobId,conversationId]);const job=completion.rows[0];
  if(!job||(waitingNode?.type!==(ctx.connectorResume?'CONNECTOR':'WEBHOOK'))||!waitingNode.request||Number(job.flow_version)!==version||job.flow_node_id!==state.at||job.wait_token!==asyncResume.token||state.runtime?.wait?.token!==asyncResume.token)return {payloads:[],handedOff:false};
  let outcome=state.runtime.wait.expiresAt<=Date.now()?'TIMEOUT':String(job.result_outcome);const fields=(job.result_fields||{}) as Record<string,string>;
  if(outcome==='SUCCESS'&&Object.entries(fields).some(([key,value])=>typeof value!=='string'||value.length>500||!validVariableValue(flow.variables?.find(v=>v.key===key),value))){outcome='ERROR';await db.query(`UPDATE ${queue} SET result_outcome='ERROR',result_fields='{}',last_error='TYPED_RESPONSE_INVALID' WHERE tenant_id=$1 AND id=$2`,[tenantId,asyncResume.jobId])}
  if(outcome==='SUCCESS')Object.assign(state.answers,fields);state.at=outcome==='SUCCESS'?waitingNode.next:outcome==='TIMEOUT'?waitingNode.request.timeoutNext:waitingNode.request.errorNext;delete state.runtime.wait;requestOutcome='request_'+outcome.toLowerCase();
 }
 if(ctx.resume){
  if(!previous||Number(previous.version)!==ctx.resume.version||previous.node_id!==ctx.resume.nodeId)return {payloads:[],handedOff:false};
  if(state.runtime?.wait){if(ctx.resume.waitToken!==state.runtime.wait.token)return {payloads:[],handedOff:false};if(state.runtime.wait.expiresAt>Date.now())return {payloads:[],handedOff:false,deferredUntil:state.runtime.wait.expiresAt}}
  else if(ctx.resume.waitToken)return {payloads:[],handedOff:false};
  if((waitingNode?.type==='WEBHOOK'||waitingNode?.type==='CONNECTOR')&&waitingNode.request){state.at=waitingNode.request.timeoutNext;if(state.runtime)delete state.runtime.wait;requestOutcome='request_timeout';await db.query(`UPDATE ${waitingNode.type==='CONNECTOR'?'chatbot_connector_jobs':'chatbot_integration_jobs'} SET status=CASE WHEN status='PROCESSING' THEN 'UNCERTAIN' ELSE 'CANCELLED' END,completion_pending=false,last_error='FLOW_DEADLINE' WHERE tenant_id=$1 AND conversation_id=$2 AND wait_token=$3 AND flow_request IS NOT NULL AND status IN ('PENDING','PROCESSING')`,[tenantId,conversationId,ctx.resume.waitToken])}
  else if(waitingNode?.type==='DELAY'){state.at=waitingNode.next;if(state.runtime)delete state.runtime.wait}
  else if((waitingNode?.type==='INPUT'||waitingNode?.type==='BUTTONS'||waitingNode?.type==='LIST')&&waitingNode.policy?.timeoutNext&&state.runtime?.wait)resumedInput={kind:'TIMEOUT',value:state.runtime.wait.token};
  else return {payloads:[],handedOff:false};
 }else if(!asyncResume&&(waitingNode?.type==='WEBHOOK'||waitingNode?.type==='CONNECTOR')&&waitingNode.request&&!restart)return {payloads:[],handedOff:false};
 else if(waitingNode?.type==='DELAY'&&!restart)return {payloads:[],handedOff:false};
 await db.query("UPDATE chatbot_delay_jobs SET status='CANCELLED' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING'",[tenantId,conversationId]);
 // Flow replies are untrusted until matching the current node & option ID.
 const inbound=actionId?{kind:'CHOICE' as const,value:actionId}:{kind:'TEXT' as const,value:body};
 const result=await executeFlow(db,tenantId,flow,state,asyncResume?undefined:ctx.resume?resumedInput:triggered?undefined:inbound,false,{contactId,conversationId,version,enter:Boolean(triggered||ctx.operatorResume||asyncResume||ctx.resume&&(waitingNode?.type==='DELAY'||waitingNode?.type==='WEBHOOK'||waitingNode?.type==='CONNECTOR'))});
 if(requestOutcome)result.trace.unshift({nodeId:waitingNode!.id,type:waitingNode!.type,outcome:requestOutcome,elapsedMs:0});
 flow=result.flow;
 const contactAnswers=Object.fromEntries(Object.entries(result.state.answers).filter(([key])=>!flow.variables?.some(v=>v.key===key&&v.scope==='session')));
 await db.query(`INSERT INTO chatbot_flow_sessions(tenant_id,conversation_id,version,node_id,answers,tags,runtime_nodes,updated_at,bot_id,runtime_state)
 VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,now(),$8,$9::jsonb)
 ON CONFLICT(tenant_id,conversation_id) DO UPDATE SET version=EXCLUDED.version,node_id=EXCLUDED.node_id,
 answers=EXCLUDED.answers,tags=EXCLUDED.tags,runtime_nodes=EXCLUDED.runtime_nodes,bot_id=EXCLUDED.bot_id,runtime_state=EXCLUDED.runtime_state,updated_at=now()`,[
   tenantId,conversationId,version,result.state.at,JSON.stringify(result.state.answers),JSON.stringify(result.state.tags),JSON.stringify(flow.nodes.filter(n=>n.id.startsWith('@catalog:')||result.flow.nodes.find(x=>x.id===n.id)?.type==='LIST')),botId,JSON.stringify(result.state.runtime||{})
 ]);
 if(result.waiting){
  const dueAt=result.waiting.expiresAt||Date.now()+result.waiting.seconds*1000;
  await db.query(`INSERT INTO chatbot_delay_jobs(tenant_id,conversation_id,version,node_id,due_at,wait_token) VALUES($1,$2,$3,$4,to_timestamp($5::double precision/1000),$6) ON CONFLICT(tenant_id,conversation_id) DO UPDATE SET version=$3,node_id=$4,due_at=EXCLUDED.due_at,wait_token=EXCLUDED.wait_token,purpose='FLOW',status='PENDING',error=NULL`,[tenantId,conversationId,version,result.state.at,dueAt,result.waiting.token||null]);
 }

 if(result.botAction?.operation==='PAUSE'&&result.botAction.seconds){const controlled=await db.query('SELECT bot_control FROM conversations WHERE tenant_id=$1 AND id=$2',[tenantId,conversationId]);const token=(controlled.rows[0].bot_control as any).token;await db.query(`INSERT INTO chatbot_delay_jobs(tenant_id,conversation_id,version,node_id,due_at,wait_token,purpose) VALUES($1,$2,$3,$4,now()+($5::int*interval '1 second'),$6,'BOT_RESUME') ON CONFLICT(tenant_id,conversation_id) DO UPDATE SET due_at=EXCLUDED.due_at,wait_token=EXCLUDED.wait_token,purpose=EXCLUDED.purpose,node_id=EXCLUDED.node_id,version=EXCLUDED.version,status='PENDING',error=NULL`,[tenantId,conversationId,version,result.state.at,result.botAction.seconds,token]);}
 // Events contain identifiers/outcomes only, never answer values or message bodies.
 if(result.trace?.length)await db.query(`INSERT INTO chatbot_flow_step_events(tenant_id,conversation_id,bot_id,version,node_id,node_type,outcome,elapsed_ms,execution_id,step_index,recorded_at) SELECT $1,$2,$3,$4,x."nodeId",x.type,x.outcome,coalesce(x."elapsedMs",0),$6,x."stepIndex",statement_timestamp() FROM jsonb_to_recordset($5::jsonb) AS x("nodeId" text,type text,outcome text,"elapsedMs" numeric,"stepIndex" integer)`,[tenantId,conversationId,botId,version,JSON.stringify(result.trace.map((entry,stepIndex)=>({...entry,stepIndex}))),randomUUID()]);
 if(!result.handoff&&(Object.keys(result.state.answers).length||result.state.tags.length)){
  const leadId=await registerInterest(db,tenantId,conversationId,contactId,null);
  await db.query('UPDATE chatbot_leads SET custom_fields=$3::jsonb,updated_at=now() WHERE tenant_id=$1 AND id=$2',[tenantId,leadId,JSON.stringify({...contactAnswers,lead_tags:result.state.tags.join(', ')})]);
 }
 if(result.crmStage&&!result.handoff)await db.query('UPDATE chatbot_leads SET stage=$3,updated_at=now() WHERE tenant_id=$1 AND conversation_id=$2',[tenantId,conversationId,result.crmStage]);
 if(result.handoff){
  const leadId=await registerInterest(db,tenantId,conversationId,contactId,null);
  await db.query('UPDATE chatbot_leads SET custom_fields=$3::jsonb WHERE tenant_id=$1 AND id=$2',[tenantId,leadId,JSON.stringify({...contactAnswers,lead_tags:result.state.tags.join(', ')})]);
  await readyForAgent(db,tenantId,leadId,conversationId,null);
 }
 if(result.handoff&&result.chosenHandoff){const {assigned,policy}=result.chosenHandoff;await setBotControl(db,tenantId,conversationId,{mode:'HANDOFF',queue:policy.queue,team:policy.team||'',resumeNode:policy.resumeNext??null,idleSeconds:policy.idleSeconds,idleAction:policy.idleAction},assigned);
  if(policy.idleSeconds){const c=await db.query('SELECT bot_control FROM conversations WHERE tenant_id=$1 AND id=$2',[tenantId,conversationId]);await db.query(`INSERT INTO chatbot_delay_jobs(tenant_id,conversation_id,version,node_id,due_at,wait_token,purpose) VALUES($1,$2,$3,$4,now()+($5::int*interval '1 second'),$6,'HUMAN_IDLE') ON CONFLICT(tenant_id,conversation_id) DO UPDATE SET due_at=EXCLUDED.due_at,wait_token=EXCLUDED.wait_token,purpose=EXCLUDED.purpose,version=EXCLUDED.version,node_id=EXCLUDED.node_id,status='PENDING',error=NULL`,[tenantId,conversationId,version,result.state.at,policy.idleSeconds,(c.rows[0].bot_control as any).token]);}}

 return {payloads:renderFlowMessages(flow,result.state.at,result.botAction&&result.botAction.operation!=='RESUME'?[]:result.messages,String(channel)),handedOff:result.handoff};
}
/** Render choices with stable node identity: no untrusted titles used as routing IDs. */
export function renderFlowMessages(flow:FlowDefinition,at:string|null,messages:FlowMessage[],channel='WHATSAPP'):Record<string,unknown>[]{
 const node=flow.nodes.find(n=>n.id===at);
 const payloads:Record<string,unknown>[]=messages.map(message=>{
  if(message.type==='GALLERY')return {type:'elhafez_gallery',cards:message.cards};
  if(message.type==='TEXT')return {messaging_product:'whatsapp',type:'text',text:{preview_url:false,body:message.text}};
  if(message.type==='MEDIA'){
    const attachment:Record<string,unknown>={link:message.url};
    if(message.caption && (message.mediaKind==='image'||message.mediaKind==='video'||message.mediaKind==='document'))attachment.caption=message.caption;
    return {messaging_product:'whatsapp',type:message.mediaKind,[message.mediaKind]:attachment};
  }
  if(!node||(node.type!=='CONSENT'&&node.type!=='BUTTONS'&&node.type!=='LIST'&&!(node.type==='INPUT'&&node.policy?.skipNext)))throw new Error('Flow awaiting node not valid for options');
  const urls=message.choices.filter(c=>c.action==='URL');
  if(urls.length===1&&urls.length===message.choices.length)return {messaging_product:'whatsapp',type:'interactive',interactive:{type:'cta_url',body:{text:message.text},action:{name:'cta_url',parameters:{display_text:urls[0].title,url:urls[0].url}}}};
  const choices=message.choices.map(c=>({id:node.type==='CONSENT'?c.id:`flow:${node.id}:${c.id}`,title:c.title,description:c.description||'',...(c.action==='URL'?{url:c.url}:{})}));
  if(message.type==='BUTTONS')return {messaging_product:'whatsapp',type:'interactive',interactive:{type:'button',body:{text:message.text},action:{buttons:choices.map(c=>c.url?{type:'url',url:c.url,title:c.title}:{type:'reply',reply:{id:c.id,title:c.title}})}}};
  return {messaging_product:'whatsapp',type:'interactive',interactive:{type:'list',body:{text:message.text},action:{button:message.buttonText||'اختار',sections:[{title:'القائمة',rows:choices}]}}};
 });return channel==='WHATSAPP'?payloads.flatMap(p=>p.type==='elhafez_gallery'?galleryFallback(p.cards as import('./flow-content.js').FlowCard[]):[p]):payloads;
}
/** Rollback creates a new immutable live revision; existing sessions remain pinned. */
export async function rollbackFlow(db:SqlClient,actor:Actor,version:string,botId?:string){
 allow(actor,['OWNER','MANAGER']);
 if(!/^[1-9][0-9]{0,8}$/.test(version))throw new HttpFailure(400,'Invalid version');
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const r=await flowStorage(db,actor,botId).published(Number(version));
 if(r.rowCount!==1)throw new HttpFailure(404,'Version not found');
 await saveFlowDraft(db,actor,r.rows[0].definition,true,botId);
 return publishFlowDraft(db,actor,botId);
}

/** Resolve approved dynamic content without changing immutable flow definitions. */
export async function resolveFlow(db:SqlClient,tenantId:string,flow:FlowDefinition,answers:Record<string,string>,incoming:string,onlyId?:string,dryRun=false,contactId?:string,origin?:{conversationId:string;version?:number}){
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
   if(!dryRun)await enqueueIntegration(db,tenantId,node.integrationId,{event:'FLOW_WEBHOOK',fields:answers,contactId},undefined,origin&&contactId?{...origin,contactId,version:origin.version!,nodeId:node.id}:undefined);
   nodes.push({id:node.id,type:'START' as const,next:node.next});
  }else if(node.type==='AI'&&(!onlyId||node.id===onlyId)){
   const result=dryRun?{handoff:false,text:'[Mock AI] رد تجريبي؛ لم يتم الاتصال بمزود ذكاء اصطناعي.'}:await groundedReply(db,tenantId,answers[node.field]||incoming);
   nodes.push(result.handoff?{id:node.id,type:'HANDOFF' as const,text:result.text}:{id:node.id,type:'TEXT' as const,text:result.text,next:node.next});
  }else nodes.push(node);
 }
 return {...flow,nodes:[...new Map(nodes.map(n=>[n.id,n])).values()]};
}

export async function executeFlow(db:SqlClient,tenantId:string,definition:FlowDefinition,state:import('./flow-engine.js').FlowState,input?:FlowInput,dryRun=false,context?:{contactId:string;conversationId:string;version?:number;enter?:boolean},simulation?:{now?:number;seed?:number;requests?:Record<string,RequestMock>;staffAvailable?:boolean;channel?:import('./flow-engine.js').FlowChannel;event?:TriggerContext['event']}):Promise<ReturnType<typeof advanceFlow>&{trace:import('./flow-engine.js').FlowTrace[];flow:FlowDefinition;crmStage?:string;chosenHandoff?:{assigned:string|null;policy:import('./flow-conversation-policy.js').HandoffPolicy};blockedService?:boolean}>{
 let crmStage:string|undefined;let chosenHandoff:{assigned:string|null;policy:import('./flow-conversation-policy.js').HandoffPolicy}|undefined;let blockedService=false;
 if(dryRun&&simulation){
  const channel=simulation.channel||definition.channel||'WHATSAPP';
  if(flowChannelIssues(definition,channel).some(i=>i.severity==='error'))throw new HttpFailure(400,'Flow is incompatible with simulated channel');
  if((!input||['TEXT','CHOICE'].includes(input.kind))&&(input?.kind!=='CHOICE'||validTriggerPostback(definition,state.at,input.value,state.runtime))){
   const event=simulation.event||(input?.kind==='CHOICE'?'POSTBACK':'MESSAGE');
   const trigger=[...(definition.triggers||[])].sort((a,b)=>b.priority-a.priority).find(t=>triggerMatches(t,input?.value||'',state.at===null,{channel,event}));
   if(trigger){state={at:trigger.targetNode,answers:{},tags:[]};input=undefined;context={contactId:'',conversationId:'',enter:true};}
  }
 }
 let flow=definition.nodes.some(n=>n.type==='SUBFLOW')?await compileSubflows(db,tenantId,definition):definition,result=advanceFlow(flow,state,input,simulation?.seed!==undefined?()=>simulation.seed!:undefined,{now:simulation?.now,enter:context?.enter});const messages=[...result.messages],trace=[...(result.trace||[])];
 for(let hops=0;result.pending&&hops<20;hops++){
  const pending=flow.nodes.find(n=>n.id===result.state.at);
  if(pending?.type==='CONTROL'&&result.botAction){
   const action=result.botAction;if(action.operation==='RESUME'){
    trace.push({nodeId:pending.id,type:pending.type,outcome:dryRun?'mock_bot_resume':'bot_resume',elapsedMs:0});flow={...flow,nodes:flow.nodes.map(n=>n.id===pending.id?{id:n.id,type:'START' as const,next:action.next}:n)};
   }else{
    if(!dryRun){if(!context)throw new HttpFailure(409,'Bot control requires a customer conversation');await setBotControl(db,tenantId,context.conversationId,{mode:action.operation==='STOP'?'STOPPED':'PAUSED',resumeNode:action.next});}
    return {...result,pending:false,messages,trace,flow,botAction:action};
   }
  }
  if(pending?.type==='CONSENT'&&result.consent){
   const consent=result.consent;if(!dryRun){if(!context)throw new HttpFailure(409,'Consent requires a customer conversation');const recorded=await recordFlowConsent(db,tenantId,context.contactId,context.conversationId,{purpose:consent.purpose,decision:consent.decision,source:'FLOW',nodeId:pending.id,policyVersion:consent.policyVersion,notice:consent.notice,flowVersion:context.version});blockedService=recorded.serviceBlocked;}
   trace.push({nodeId:pending.id,type:pending.type,outcome:(dryRun?'mock_':'')+'consent_'+consent.purpose.toLowerCase()+'_'+consent.decision.toLowerCase(),elapsedMs:0});flow={...flow,nodes:flow.nodes.map(n=>n.id===pending.id?{id:n.id,type:'START' as const,next:consent.next}:n)};
  }
  if(pending?.type==='HANDOFF'&&pending.handoffPolicy){
   const policy=pending.handoffPolicy;let available=true,assigned:string|null=null;
   try{if(policy.schedule)available=businessIsOpen(policy.schedule,simulation?.now??Date.now(),result.state.answers)}catch{available=false}
   if(available&&policy.strategy!=='QUEUE'){
    if(dryRun)available=simulation?.staffAvailable!==false;
    else{const members=await db.query(`SELECT m.user_id FROM memberships m WHERE m.tenant_id=$1 AND m.role IN ('OWNER','MANAGER','AGENT') AND m.inbox_available=true AND ($2::uuid IS NULL OR m.user_id=$2) AND ($3='' OR m.inbox_team=$3) ORDER BY (SELECT count(*) FROM conversations c WHERE c.tenant_id=m.tenant_id AND c.assigned_user_id=m.user_id AND c.status='HUMAN'),m.user_id LIMIT 1`,[tenantId,policy.strategy==='MEMBER'?policy.memberId:null,policy.strategy==='TEAM'?policy.team:'']);available=Boolean(members.rowCount);assigned=available?String(members.rows[0].user_id):null}
   }
   trace.push({nodeId:pending.id,type:pending.type,outcome:(dryRun?'mock_':'')+(available?'handoff_available':'handoff_unavailable'),elapsedMs:0});
   if(available){chosenHandoff={assigned,policy};flow={...flow,nodes:flow.nodes.map(n=>n.id===pending.id?{id:n.id,type:'HANDOFF' as const,text:pending.text}:n)}}else flow={...flow,nodes:flow.nodes.map(n=>n.id===pending.id?{id:n.id,type:'START' as const,next:policy.unavailableNext}:n)};
  }

  if((pending?.type==='WEBHOOK'||pending?.type==='CONNECTOR')&&pending.request){
   if(!dryRun){
    if(!context||context.version===undefined)throw new HttpFailure(409,'Response request requires a pinned conversation');
    const request=pending.request,total=request.timeoutSeconds*request.maxAttempts+2*(request.maxAttempts-1)+1,token=randomUUID(),expiresAt=Date.now()+total*1000;
    result.state.runtime??={attempts:{}};result.state.runtime.wait={nodeId:pending.id,token,expiresAt};
    const payload=Object.fromEntries(Object.entries(request.body).map(([key,value])=>[key,importRender(value,result.state.answers,500)]));
    try{if(pending.type==='CONNECTOR')await enqueueConnector(db,tenantId,pending.connectorId,context.contactId,{...result.state.answers,...payload},'flow:'+context.conversationId+':'+token,{conversationId:context.conversationId,version:context.version,nodeId:pending.id,token,request,deadline:expiresAt});else await enqueueIntegration(db,tenantId,pending.integrationId,payload,{conversationId:context.conversationId,contactId:context.contactId,version:context.version,nodeId:pending.id,token,request,deadline:expiresAt});
    trace.push({nodeId:pending.id,type:pending.type,outcome:'request_queued',elapsedMs:0});return {...result,pending:false,messages,trace,flow,waiting:{seconds:total,next:request.timeoutNext,kind:'INTEGRATION' as const,expiresAt,token}};
    }catch(error){if(!(error instanceof HttpFailure))throw error;delete result.state.runtime.wait;trace.push({nodeId:pending.id,type:pending.type,outcome:'request_enqueue_error',elapsedMs:0});flow={...flow,nodes:flow.nodes.map(n=>n.id===pending.id?{id:n.id,type:'START' as const,next:request.errorNext}:n)}}
   }else{
   const mock=simulation?.requests?.[pending.id]||{outcome:'SUCCESS' as const,body:pending.type==='CONNECTOR'?{external_id:'MOCK-123',provider:'MOCK'}:{}},request=pending.request;let next=request.errorNext,outcome='mock_request_http_error';
   if(mock.outcome==='TIMEOUT'){next=request.timeoutNext;outcome='mock_request_timeout'}
   else if(mock.outcome==='SUCCESS'){try{const fields=mapRequestResponse(request,mock.body??{});for(const [key,value]of Object.entries(fields))if(!validVariableValue(flow.variables?.find(v=>v.key===key),value))throw Error('Response field type mismatch');Object.assign(result.state.answers,fields);next=pending.next;outcome='mock_request_success'}catch{outcome='mock_request_mapping_error'}}
   trace.push({nodeId:pending.id,type:pending.type,outcome,elapsedMs:0});flow={...flow,nodes:flow.nodes.map(n=>n.id===pending.id?{id:n.id,type:'START' as const,next}:n)};
   }
  }
  if(pending?.type==='CRM_ACTION'){
   const started=performance.now();let next=pending.next,outcome=dryRun?'mock_crm_success':'crm_success';
   try{
    if(!dryRun){if(!context)throw new HttpFailure(409,'CRM action requires a customer conversation');
     if(pending.operation==='ASSIGN'){const member=await db.query("SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND role IN ('OWNER','MANAGER','AGENT')",[tenantId,pending.value]);if(!member.rowCount)throw new HttpFailure(400,'CRM assignee unavailable');await db.query('UPDATE conversations SET assigned_user_id=$3 WHERE tenant_id=$1 AND id=$2',[tenantId,context.conversationId,pending.value])}
     else{const lead=await registerInterest(db,tenantId,context.conversationId,context.contactId,null);await db.query('UPDATE chatbot_leads SET stage=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[tenantId,lead,pending.value]);crmStage=pending.value;}
    }
   }catch(e){if(!pending.errorNext)throw e;next=pending.errorNext;outcome='crm_error'}
   trace.push({nodeId:pending.id,type:pending.type,outcome,elapsedMs:performance.now()-started});flow={...flow,nodes:flow.nodes.map(n=>n.id===pending.id?{id:n.id,type:'START' as const,next}:n)};
  }
  if(pending?.type==='CONNECTOR'&&!pending.request){if(!dryRun){if(!context)throw new HttpFailure(409,'Connector requires a customer conversation');await enqueueConnector(db,tenantId,pending.connectorId,context.contactId,result.state.answers,createHash('sha256').update(context.conversationId+':'+pending.connectorId+':'+pending.id+':'+JSON.stringify(result.state.answers)).digest('hex'),undefined,{conversationId:context.conversationId,contactId:context.contactId,version:context.version!,nodeId:pending.id});}flow={...flow,nodes:flow.nodes.map(n=>n.id===pending.id?{id:n.id,type:'START' as const,next:pending.next}:n)};}
  flow=await resolveFlow(db,tenantId,flow,result.state.answers,input?.value||'',result.state.at||'',dryRun,context?.contactId,context);
  result=advanceFlow(flow,result.state,undefined,simulation?.seed!==undefined?()=>simulation.seed!:undefined,simulation);messages.push(...result.messages);trace.push(...(result.trace||[]));if(blockedService)return {...result,pending:false,messages:[],trace,flow,crmStage,chosenHandoff,blockedService};
 }
 if(result.pending)throw new HttpFailure(400,'Dynamic node execution limit exceeded');
 return {...result,messages,trace,flow,chosenHandoff,blockedService,...(crmStage?{crmStage}:{})};
}

function unpublishedFlow():FlowDefinition{return {name:'مساعد الشركة',startId:'start',nodes:[{id:'start',type:'START',next:'handoff'},{id:'handoff',type:'HANDOFF',text:'معلومات الشركة لم تُنشر بعد. وصل استفسارك للفريق للرد عليك.'}]}}
