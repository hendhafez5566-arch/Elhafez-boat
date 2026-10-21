/** Explicit resource remapping into a local draft, never implicit external activation. */
import {validateFlow,type FlowDefinition} from './flow-engine.js';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {flowReadiness} from './flow-release.js';
type Reference={key:string;kind:'INTEGRATION'|'CONNECTOR'|'SUBFLOW'|'ASSIGNEE'|'MEDIA';source:string;nodeId:string;version?:number;path:(string|number)[];mediaKind?:string};
export function flowReferences(flow:FlowDefinition):Reference[]{
 const refs:Reference[]=[];
 for(const [i,n]of flow.nodes.entries()){
  const add=(kind:Reference['kind'],source:string,path:(string|number)[],version?:number,mediaKind?:string)=>refs.push({key:n.id+':'+path.slice(2).join('.'),kind,source,nodeId:n.id,path,version,mediaKind});
  if(n.type==='WEBHOOK')add('INTEGRATION',n.integrationId,['nodes',i,'integrationId']);
  if(n.type==='CONNECTOR')add('CONNECTOR',n.connectorId,['nodes',i,'connectorId']);
  if(n.type==='SUBFLOW')add('SUBFLOW',n.subflowId,['nodes',i,'subflowId'],n.version);
  if(n.type==='CRM_ACTION'&&n.operation==='ASSIGN')add('ASSIGNEE',n.value,['nodes',i,'value']);
  if(n.type==='HANDOFF'&&n.handoffPolicy?.strategy==='MEMBER')add('ASSIGNEE',n.handoffPolicy.memberId!,['nodes',i,'handoffPolicy','memberId']);
  // Only media URLs are resource references. Ordinary HTTPS links remain content.
  const media=(v:unknown,path:(string|number)[])=>{if(!v||typeof v!=='object')return;for(const [k,value]of Object.entries(v)){const p=[...path,Array.isArray(v)?Number(k):k];if((k==='imageUrl'||k==='url'&&(v as any).type==='MEDIA'||k==='url'&&n.type==='MEDIA'&&path.length===2)&&typeof value==='string')add('MEDIA',value,p,undefined,k==='imageUrl'?'image':String((v as any).mediaKind||'image'));else if(value&&typeof value==='object')media(value,p)}};
  media(n,['nodes',i]);
 }
 return refs;
}
export async function inspectPortableFlow(db:SqlClient,a:Actor,input:unknown,botId?:string){
 allow(a,['OWNER','MANAGER']);const d=input as {definition?:unknown;mapping?:unknown};let flow:FlowDefinition;
 try{flow=validateFlow(d?.definition,{draft:true})}catch{throw new HttpFailure(400,'الملف لا يحتوي مسودة صالحة.');}
 const mapping=d.mapping??{};if(!mapping||typeof mapping!=='object'||Array.isArray(mapping)||Object.keys(mapping).length>250)throw new HttpFailure(400,'Invalid resource mapping');
 const refs=flowReferences(flow),known=new Set(refs.map(r=>r.key));if(Object.keys(mapping).some(k=>!known.has(k)))throw new HttpFailure(400,'Unknown resource mapping');
 flow=JSON.parse(JSON.stringify(flow));
 for(const ref of refs){
  const target=(mapping as Record<string,unknown>)[ref.key];if(target===undefined)continue;
  const t=target as {id?:unknown;version?:unknown};if(!t||typeof t!=='object'||typeof t.id!=='string'||t.id.length>2048||ref.kind!=='MEDIA'&&!isUuid(t.id)||ref.kind==='SUBFLOW'&&(!Number.isInteger(t.version)||Number(t.version)<1))throw new HttpFailure(400,'Invalid replacement resource');
  let parent:any=flow;for(const part of ref.path.slice(0,-1))parent=parent[part];parent[ref.path.at(-1)!]=t.id;if(ref.kind==='SUBFLOW')parent.version=t.version;
 }
 try{flow=validateFlow(flow,{draft:true})}catch{throw new HttpFailure(400,'المراجع البديلة لا توافق بنية المسودة.');}
 const reports=[];
 for(const r of flowReferences(flow)){
  let available=false;
  if(r.kind==='INTEGRATION')available=Boolean((await db.query('SELECT 1 FROM chatbot_integrations WHERE tenant_id=$1 AND id=$2 AND enabled=true',[a.tenantId,r.source])).rowCount);
  if(r.kind==='CONNECTOR')available=Boolean((await db.query('SELECT 1 FROM chatbot_connectors WHERE tenant_id=$1 AND id=$2 AND enabled=true AND credentials_encrypted IS NOT NULL',[a.tenantId,r.source])).rowCount);
  if(r.kind==='SUBFLOW')available=Boolean((await db.query('SELECT 1 FROM chatbot_subflow_versions WHERE tenant_id=$1 AND subflow_id=$2 AND version=$3',[a.tenantId,r.source,r.version])).rowCount);
  if(r.kind==='ASSIGNEE')available=Boolean((await db.query("SELECT 1 FROM memberships WHERE tenant_id=$1 AND user_id=$2 AND role IN ('OWNER','MANAGER','AGENT')",[a.tenantId,r.source])).rowCount);
  if(r.kind==='MEDIA'){const {validateManagedMedia}=await import('./media.js');try{const u=new URL(r.source);if(/^\/api\/v1\/media\/public\//.test(u.pathname)&&u.origin!==process.env.MEDIA_PUBLIC_ORIGIN)throw Error();await validateManagedMedia(db,a.tenantId,r.source,r.mediaKind||'image');available=true}catch{available=false}}
  reports.push({key:r.key,kind:r.kind,nodeId:r.nodeId,source:r.source,version:r.version,available,remapped:Object.hasOwn(mapping,r.key)});
 }
 const choices:Record<string,unknown[]>={};
 if(refs.some(r=>r.kind==='INTEGRATION'))choices.INTEGRATION=(await db.query('SELECT id,name FROM chatbot_integrations WHERE tenant_id=$1 AND enabled=true ORDER BY name LIMIT 100',[a.tenantId])).rows;
 if(refs.some(r=>r.kind==='CONNECTOR'))choices.CONNECTOR=(await db.query('SELECT id,name FROM chatbot_connectors WHERE tenant_id=$1 AND enabled=true AND credentials_encrypted IS NOT NULL ORDER BY name LIMIT 100',[a.tenantId])).rows;
 if(refs.some(r=>r.kind==='SUBFLOW'))choices.SUBFLOW=(await db.query('SELECT s.id,s.name,v.version FROM chatbot_subflows s JOIN chatbot_subflow_versions v ON v.tenant_id=s.tenant_id AND v.subflow_id=s.id WHERE s.tenant_id=$1 ORDER BY s.name,v.version DESC LIMIT 500',[a.tenantId])).rows;
 if(refs.some(r=>r.kind==='ASSIGNEE'))choices.ASSIGNEE=(await db.query("SELECT m.user_id AS id,u.email AS name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.tenant_id=$1 AND m.role IN ('OWNER','MANAGER','AGENT') ORDER BY u.email LIMIT 100",[a.tenantId])).rows;
 const readiness=await flowReadiness(db,a,flow,botId);
 return {definition:flow,references:reports,choices,canImport:reports.every(r=>r.available),publishable:readiness.publishable&&reports.every(r=>r.available),issues:readiness.issues,mode:'LOCAL_DRAFT_ONLY'};
}
