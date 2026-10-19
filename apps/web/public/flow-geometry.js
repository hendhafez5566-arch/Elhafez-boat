/** Pure canvas geometry. Coordinates affect the draft layout only, never the bot engine. */
export const NODE_WIDTH=286;
export const MAX_POSITION=9600;
export const GAP=28;
export function nodeFootprint(node={}){
 const options=Array.isArray(node.choices)?node.choices.length:0;
 const descriptions=Array.isArray(node.choices)?node.choices.filter(c=>c.description).length:0;
 const lines=Math.min(15,Math.ceil(String(node.text||'').length/26));
 // Reserve space for wrapping Arabic choices and real connector controls.
 return {width:NODE_WIDTH,height:Math.max(260,205+Math.max(1,lines)*25+options*57+descriptions*25)};
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
 const byId=new Map(flow.nodes.map(node=>[node.id,node]));
 const rank=new Map([[flow.startId,0]]),queue=[flow.startId];
 // Arrange successive conversation stages vertically, so an extended flow stays readable.
 for(let i=0;i<queue.length;i++){
  const id=queue[i];
  for(const edge of graphOutputs(byId.get(id)||{}))
   if(byId.has(edge.to)&&!rank.has(edge.to)){
    rank.set(edge.to,Math.min(22,rank.get(id)+1));queue.push(edge.to);
   }
 }
 let orphanRank=Math.max(0,...rank.values())+1;
 for(const node of flow.nodes)if(!rank.has(node.id))rank.set(node.id,orphanRank);
 const layers=new Map();
 for(const node of flow.nodes){const level=rank.get(node.id);if(!layers.has(level))layers.set(level,[]);layers.get(level).push(node)}
 const result=Object.create(null),occupied=[];let y=70;
 for(const [,nodes] of [...layers].sort((a,b)=>a[0]-b[0])){
  // Maximum four cards per row. The tallest rendered footprint governs the row gap.
  for(let index=0;index<nodes.length;index+=4){
   const row=nodes.slice(index,index+4),height=Math.max(...row.map(node=>nodeFootprint(node).height));
   for(let column=0;column<row.length;column++){
    const node=row[column],suggested={x:64+column*(NODE_WIDTH+105),y:Math.min(MAX_POSITION,y)};
    const position=placeWithoutOverlap(suggested,node,occupied,56);
    result[node.id]=position;occupied.push({...position,...nodeFootprint(node)});
   }
   y+=height+112;
  }
 }
 return result;
}
