/** Descriptive first-exposure cohorts from committed telemetry. Never delivery/causality claims. */
import {botScope} from './bots.js';
import {HttpFailure,type Actor,type SqlClient} from './services.js';
import type {FlowDefinition} from './flow-engine.js';
export function conversionSummary(exposed:number,converted:number){
 if(!Number.isInteger(exposed)||!Number.isInteger(converted)||exposed<0||converted<0||converted>exposed)throw Error('Invalid conversion denominator');
 if(!exposed)return {rate:null,lower:null,upper:null};const p=converted/exposed,z=1.959963984540054,den=1+z*z/exposed,center=(p+z*z/(2*exposed))/den,margin=z*Math.sqrt((p*(1-p)+z*z/(4*exposed))/exposed)/den;
 return {rate:p,lower:converted===0?0:Math.max(0,center-margin),upper:converted===exposed?1:Math.min(1,center+margin)};
}
export async function flowExperiments(db:SqlClient,a:Actor,bot:string,params:URLSearchParams){
 const scope=await botScope(db,a,bot),version=params.has('version')?Number(params.get('version')):null,days=Number(params.get('days')||30),experiment=params.get('experiment'),goal=params.get('goal');
 if(version!==null&&(!Number.isInteger(version)||version<1)||![7,30,90].includes(days))throw new HttpFailure(400,'Invalid experiment period or version');
 const versions=scope===undefined?'chatbot_flow_versions':'chatbot_bot_versions',keys=scope===undefined?[a.tenantId]:[a.tenantId,scope],where=scope===undefined?'tenant_id=$1':'tenant_id=$1 AND bot_id=$2';
 const configs=await db.query(`SELECT version,definition FROM ${versions} WHERE ${where}${version!==null?' AND version=$'+(keys.length+1):''} ORDER BY version DESC LIMIT 100`,[...keys,...(version!==null?[version]:[])]);
 const catalog=configs.rows.map(row=>({version:Number(row.version),experiments:(row.definition as FlowDefinition).nodes.filter(n=>n.type==='RANDOMIZER').map(n=>({id:n.id,title:n.label||n.id,sticky:n.sticky===true,variants:n.choices.map(c=>({id:c.id,title:c.title,weight:c.weight}))})),goals:(row.definition as FlowDefinition).nodes.filter(n=>n.type==='GOAL').map(n=>({id:n.id,title:n.label||n.goal}))}));
 if(!experiment&&!goal)return {catalog,definition:'first conversation exposure per bot/version/experiment; subsequent committed goal within seven days'};
 if(!experiment||!goal||!version||experiment.length>180||goal.length>180)throw new HttpFailure(400,'Choose published version, experiment and goal');
 const config=catalog.find(c=>c.version===version),test=config?.experiments.find(e=>e.id===experiment);if(!test||!config?.goals.some(g=>g.id===goal))throw new HttpFailure(404,'Published experiment or goal unavailable');
 const values=[a.tenantId,bot,scope===undefined,version,experiment,goal,days];
 const result=await db.query(`WITH first_exposure AS (
 SELECT DISTINCT ON(e.conversation_id) e.conversation_id,e.outcome,e.recorded_at,e.created_at,e.execution_id,e.step_index
 FROM chatbot_flow_step_events e WHERE e.tenant_id=$1 AND (e.bot_id=$2 OR ($3::boolean AND e.bot_id IS NULL)) AND e.version=$4 AND e.node_id=$5 AND e.node_type='RANDOMIZER'
 ORDER BY e.conversation_id,coalesce(e.recorded_at,e.created_at),e.execution_id NULLS LAST,e.step_index NULLS LAST,e.id
 ), cohort AS (SELECT * FROM first_exposure WHERE coalesce(recorded_at,created_at)>=now()-($7::int*interval '1 day'))
 SELECT f.outcome AS variant,count(*) FILTER(WHERE f.recorded_at IS NOT NULL)::int AS exposed,
 count(*) FILTER(WHERE f.recorded_at IS NULL)::int AS "unknownOrder",
 count(*) FILTER(WHERE f.recorded_at<=now()-interval '7 days')::int AS mature,
 count(*) FILTER(WHERE f.recorded_at IS NOT NULL AND EXISTS(
 SELECT 1 FROM chatbot_flow_step_events g WHERE g.tenant_id=$1 AND g.conversation_id=f.conversation_id AND (g.bot_id=$2 OR ($3::boolean AND g.bot_id IS NULL)) AND g.version=$4 AND g.node_id=$6 AND g.node_type='GOAL' AND g.outcome LIKE 'goal:%' AND g.recorded_at<=f.recorded_at+interval '7 days' AND g.recorded_at<=now() AND (g.recorded_at>f.recorded_at OR (g.execution_id=f.execution_id AND g.step_index>f.step_index))
 ))::int AS converted,
 count(*) FILTER(WHERE f.recorded_at IS NOT NULL AND EXISTS(
 SELECT 1 FROM chatbot_flow_step_events x WHERE x.tenant_id=$1 AND x.conversation_id=f.conversation_id AND (x.bot_id=$2 OR ($3::boolean AND x.bot_id IS NULL)) AND x.version=$4 AND x.node_id=$5 AND x.node_type='RANDOMIZER' AND x.outcome<>f.outcome AND (x.recorded_at>f.recorded_at OR (x.execution_id=f.execution_id AND x.step_index>f.step_index))
 ))::int AS crossovers
 FROM cohort f GROUP BY f.outcome`,values);
 const rows=test.variants.map(v=>{const r=result.rows.find(row=>row.variant===v.id)||{exposed:0,converted:0,mature:0,crossovers:0,unknownOrder:0};return {...v,...r,...conversionSummary(Number(r.exposed),Number(r.converted))}});
 return {version,experiment,goal,days,attributionDays:7,cohort:'first_exposure',sticky:test.sticky,rows,unknownVariants:result.rows.filter(r=>!test.variants.some(v=>v.id===r.variant)).reduce((sum,r)=>sum+Number(r.exposed)+Number(r.unknownOrder),0),description:'Distinct conversations at their first assignment, same pinned bot/version, subsequent committed goal within seven days. Repeated goals count once. Unordered legacy exposures are excluded. Crossovers and immature cohorts are descriptive, not evidence of a winner or message delivery.'};
}
