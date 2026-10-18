/** Pure canvas geometry. Coordinates affect the draft layout only, never the bot engine. */
export const NODE_WIDTH=286;
export const MAX_POSITION=9600;
export const GAP=28;
export function nodeFootprint(node={}){
 const options=Array.isArray(node.choices)?node.choices.length:0;
 const descriptions=Array.isArray(node.choices)?node.choices.filter(c=>c.description).length:0;
 const lines=Math.min(8,Math.ceil(String(node.text||'').length/36));
 return {width:NODE_WIDTH,height:Math.max(228,168+Math.max(1,lines)*20+options*47+descriptions*21)};
}
export function collides(a,b,gap=GAP){
 return a.x < b.x+b.width+gap && a.x+a.width+gap > b.x &&
        a.y < b.y+b.height+gap && a.y+a.height+gap > b.y;
}
const clamp=(n)=>Math.max(0,Math.min(MAX_POSITION,Math.round(Number(n)||0)));
export function placeWithoutOverlap(point,node,existing=[],gap=GAP,measured=null){
 const footprint=measured||nodeFootprint(node);
 const base={x:clamp(point.x),y:clamp(point.y),...footprint};
 if(!existing.some(r=>collides(base,r,gap)))return {x:base.x,y:base.y};
 const nearby=[...existing].sort((a,b)=>Math.hypot(a.x-base.x,a.y-base.y)-Math.hypot(b.x-base.x,b.y-base.y)).slice(0,24);
 const xs=new Set([base.x]),ys=new Set([base.y]);
 for(const other of nearby){
  xs.add(clamp(other.x+other.width+gap));xs.add(clamp(other.x-footprint.width-gap));
  ys.add(clamp(other.y+other.height+gap));ys.add(clamp(other.y-footprint.height-gap));
 }
 const candidates=[];
 for(const x of xs)for(const y of ys)candidates.push({x,y});
 candidates.sort((a,b)=>(Math.abs(a.x-base.x)+Math.abs(a.y-base.y))-(Math.abs(b.x-base.x)+Math.abs(b.y-base.y)));
 for(const c of candidates){const box={...c,...footprint};if(!existing.some(r=>collides(box,r,gap)))return c}
 // Bounded fallback for very dense/large boards, still inside the flow validator's coordinate range.
 for(let y=0;y<=MAX_POSITION;y+=240)for(let x=0;x<=MAX_POSITION;x+=340)
  if(!existing.some(r=>collides({...footprint,x,y},r,gap)))return {x,y};
 return {x:base.x,y:base.y}; // Only reachable if all legal canvas coordinates are occupied.
}
export function graphOutputs(node={}){
 if(Array.isArray(node.choices))return node.choices.map((c,i)=>({key:'choice:'+i,to:c.next,label:c.title||'اختيار'}));
 if(node.type==='CONDITION'||node.type==='KEYWORD')return [{key:'yes',to:node.yes,label:'نعم'},{key:'no',to:node.no,label:'لا'}];
 return 'next'in node?[{key:'next',to:node.next,label:'التالي'}]:[];
}
export function arrangeFlow(flow){
 const byId=new Map(flow.nodes.map(n=>[n.id,n]));
 const depth=new Map([[flow.startId,0]]),queue=[flow.startId];
 // Breadth-first rank: shortest distance protects cycles from infinite traversal.
 for(let index=0;index<queue.length;index++){
  const id=queue[index];for(const e of graphOutputs(byId.get(id)||{}))
   if(byId.has(e.to)&&!depth.has(e.to)){depth.set(e.to,Math.min(22,depth.get(id)+1));queue.push(e.to)}
 }
 for(const n of flow.nodes)if(!depth.has(n.id))depth.set(n.id,Math.min(22,Math.max(0,...depth.values())+1));
 const layers=new Map();for(const n of flow.nodes){const k=depth.get(n.id);if(!layers.has(k))layers.set(k,[]);layers.get(k).push(n.id)}
 // Order each layer by upstream sibling position to reduce line crossings.
 const placed=new Map(),result={};
 for(const [layer,ids] of [...layers].sort((a,b)=>a[0]-b[0])){
  ids.sort((a,b)=>{
   const parentScore=id=>{const positions=[];
    for(const parent of flow.nodes)if(graphOutputs(parent).some(e=>e.to===id)&&placed.has(parent.id))positions.push(placed.get(parent.id));
    return positions.length?positions.reduce((x,y)=>x+y,0)/positions.length:1e6};
   return parentScore(a)-parentScore(b)||flow.nodes.findIndex(n=>n.id===a)-flow.nodes.findIndex(n=>n.id===b);
  });
  ids.forEach((id,index)=>{
   const node=byId.get(id),bucket=Math.floor(index/19),slot=index%19;
   const x=Math.min(MAX_POSITION,64+layer*340+bucket*330),y=70+slot*455;
   const occupied=Object.entries(result).map(([nid,p])=>({...p,...nodeFootprint(byId.get(nid))}));
   const safe=placeWithoutOverlap({x,y},node,occupied);
   result[id]=safe;placed.set(id,safe.y);
  });
 }
 return result;
}
