/** Reusable *copied* linear flow fragments. Existing/published versions never change when a library item is edited. */
import {validateFlow,type FlowDefinition,type FlowNode} from './flow-engine.js';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';

type LinearNode=Extract<FlowNode,{next:string}>;
export type FlowSnippet={name:string;steps:LinearNode[]};
const allowed=new Set(['TEXT','QUESTION','INPUT','TAG','MEDIA','LINK','DELAY','AI','WEBHOOK','CATALOG']);
const isRecord=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const deep=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;

/** All internal links must form exactly one ordered chain with a single __exit__ port. */
export function validateSnippet(value:unknown):FlowSnippet{
 if(!isRecord(value)||typeof value.name!=='string'||value.name.trim().length<2||value.name.length>80)
  throw new Error('Reusable section must have a name (2–80 characters)');
 if(!Array.isArray(value.steps)||value.steps.length<1||value.steps.length>20)
  throw new Error('Reusable section requires 1–20 linear steps');
 const steps=deep(value.steps) as LinearNode[];
 for(const [i,node] of steps.entries()){
  if(!isRecord(node)||!allowed.has(String(node.type))||typeof node.next!=='string')
   throw new Error('Reusable sections support sequential message, input, delay, tag, catalog, AI and webhook steps only');
  const next=i+1===steps.length?'__exit__':steps[i+1].id;
  if(node.next!==next)throw new Error('Reusable section must contain one linear path with a final exit');
 }
 // Reuse the normal channel/content validator, with a synthetic start and end.
 const check=deep(steps);
 check[check.length-1].next='snippet_end';
 validateFlow({name:'Reusable section',startId:'snippet_start',nodes:[
  {id:'snippet_start',type:'START',next:check[0].id},...check,
  {id:'snippet_end',type:'END',text:'Done'}]});
 return {name:value.name.trim(),steps};
}
/** Save a consecutive chain starting at a node; never capture a START, branch, or handoff. */
export function captureSnippet(flow:FlowDefinition,startId:string,count:number,name:string):FlowSnippet{
 if(!Number.isInteger(count)||count<1||count>20)throw new Error('Choose 1–20 steps');
 const nodes=new Map(flow.nodes.map(n=>[n.id,n]));
 const seen=new Set<string>(),steps:LinearNode[]=[];let id=startId;
 for(let i=0;i<count;i++){
  const node=nodes.get(id);
  if(!node||!allowed.has(node.type)||!('next'in node)||seen.has(id))
   throw new Error('Select a linear sequence; branching and ending nodes cannot be included');
  seen.add(id);steps.push(deep(node as LinearNode));id=node.next;
 }
 steps[steps.length-1].next='__exit__';
 return validateSnippet({name,steps});
}
/** Insert copied fragment after a sequential node, preserving all existing branches and undo history. */
export function insertSnippet(flow:FlowDefinition,afterId:string,input:unknown):FlowDefinition{
 const snippet=validateSnippet(input);
 const nextFlow=deep(flow),anchor=nextFlow.nodes.find(n=>n.id===afterId);
 if(!anchor||!('next'in anchor)||anchor.type==='DELAY'&&anchor.next===afterId)
  throw new Error('Choose a sequential step before inserting the reusable section');
 if(nextFlow.nodes.length+snippet.steps.length>100)throw new Error('Flow has reached the 100-step limit');
 const ids=new Set(nextFlow.nodes.map(n=>n.id)),rename=new Map<string,string>();
 let counter=1;
 for(const step of snippet.steps){let id:string;do{id='reuse'+counter++}while(ids.has(id));
  ids.add(id);rename.set(step.id,id);}
 const previousNext=anchor.next;
 const copied=snippet.steps.map((step,i)=>{
  const node=deep(step);node.id=rename.get(step.id)!;
  node.next=i===snippet.steps.length-1?previousNext:rename.get(step.next)!;
  return node;
 });
 anchor.next=copied[0].id;
 nextFlow.nodes.push(...copied);
 const point=nextFlow.layout?.[afterId];
 if(point){nextFlow.layout??={};copied.forEach((n,i)=>{nextFlow.layout![n.id]={x:Math.min(9500,point.x+290*(i+1)),y:point.y}})}
 // Ensure output is compatible with the same draft schema used by the published engine.
 return validateFlow(nextFlow,{draft:true});
}
export async function listFlowSnippets(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 return (await db.query(`SELECT id,name,definition,created_at AS "createdAt"
 FROM chatbot_flow_snippets WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100`,[actor.tenantId])).rows;
}
export async function createFlowSnippet(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);
 let snippet:FlowSnippet;try{snippet=validateSnippet(input)}catch(e){throw new HttpFailure(400,e instanceof Error?e.message:'Invalid section')}
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const count=await db.query('SELECT count(*)::int AS count FROM chatbot_flow_snippets WHERE tenant_id=$1',[actor.tenantId]);
 if(Number(count.rows[0]?.count??0)>=100)throw new HttpFailure(409,'Maximum 100 reusable sections per company');
 const saved=await db.query(`INSERT INTO chatbot_flow_snippets(tenant_id,name,definition,created_by)
 VALUES($1,$2,$3::jsonb,$4)
 RETURNING id,name,definition,created_at AS "createdAt"`,
 [actor.tenantId,snippet.name,JSON.stringify(snippet),actor.userId]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id)
 VALUES($1,$2,'FLOW_SNIPPET_CREATED','flow_snippet',$3)`,[actor.tenantId,actor.userId,String(saved.rows[0].id)]);
 return saved.rows[0];
}
export async function deleteFlowSnippet(db:SqlClient,actor:Actor,id:string){
 allow(actor,['OWNER','MANAGER']);
 if(!isUuid(id))throw new HttpFailure(400,'Invalid reusable section');
 const result=await db.query('DELETE FROM chatbot_flow_snippets WHERE tenant_id=$1 AND id=$2 RETURNING id',[actor.tenantId,id]);
 if(result.rowCount!==1)throw new HttpFailure(404,'Reusable section not found');
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id)
 VALUES($1,$2,'FLOW_SNIPPET_DELETED','flow_snippet',$3)`,[actor.tenantId,actor.userId,id]);
 return {deleted:true};
}
