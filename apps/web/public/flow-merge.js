/** Conservative three-way draft merge. Arrays (choices/groups) stay atomic to preserve routing. */
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const canonical=value=>value&&typeof value==='object'&&!Array.isArray(value)
 ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]))
 :Array.isArray(value)?value.map(canonical):value;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export {equal as sameDraftValue};
export function mergeFlowDrafts(base,local,remote,choices={}){
 const conflicts=[];
 function merge(before,mine,theirs,path,atomic=false){
  if(equal(mine,theirs))return clone(mine);
  if(equal(before,mine))return clone(theirs);
  if(equal(before,theirs))return clone(mine);
  if(!atomic&&[before,mine,theirs].every(value=>value&&typeof value==='object'&&!Array.isArray(value))){
   const keys=new Set([...Object.keys(theirs),...Object.keys(mine),...Object.keys(before)]);
   return Object.fromEntries([...keys].map(key=>[key,merge(before[key],mine[key],theirs[key],[...path,key])]).filter(([,value])=>value!==undefined));
  }
  const key=JSON.stringify(path),choice=choices[key];
  conflicts.push({key,path,base:clone(before),local:clone(mine),remote:clone(theirs),resolved:choice==='local'||choice==='remote'});
  return clone(choice==='local'?mine:theirs);
 }
 const maps=[base,local,remote].map(flow=>new Map((flow.nodes||[]).map(node=>[node.id,node])));
 // Keep server order, then append local additions. Step IDs and choice IDs are never regenerated.
 const ids=new Set([...maps[2].keys(),...maps[1].keys(),...maps[0].keys()]);
 const nodes=[];
 for(const id of ids){
  const [before,mine,theirs]=maps.map(map=>map.get(id));
  const changedType=mine&&theirs&&mine.type!==theirs.type;
  const node=merge(before,mine,theirs,['nodes',id],Boolean(changedType));
  if(node!==undefined)nodes.push(node);
 }
 const omitNodes=flow=>Object.fromEntries(Object.entries(flow).filter(([key])=>key!=='nodes'));
 const definition={...merge(omitNodes(base),omitNodes(local),omitNodes(remote),[]),nodes};
 return {definition,conflicts,unresolved:conflicts.filter(item=>!item.resolved).length};
}
