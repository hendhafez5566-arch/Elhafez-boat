import test from 'node:test';
import assert from 'node:assert/strict';
import {placeWithoutOverlap,collides,nodeFootprint,arrangeFlow} from '../apps/web/public/flow-geometry.js';

test('manual drag never commits a rectangle on another card',()=>{
 const first={x:100,y:100,...nodeFootprint({type:'BUTTONS',choices:[{},{},{}]})};
 const next={type:'TEXT',text:'رسالة'};
 const safe=placeWithoutOverlap({x:110,y:112},next,[first]);
 assert.equal(collides({...safe,...nodeFootprint(next)},first),false);
 assert.ok(safe.x<=9600&&safe.y<=9600);
});
test('large branching graph auto layout is bounded and avoids collisions',()=>{
 const nodes=[{id:'start',type:'START',next:'menu'},{id:'menu',type:'LIST',text:'اختار',choices:[]}];
 for(let i=0;i<18;i++){
  nodes[1].choices.push({id:'c'+i,title:'خيار '+i,next:'n'+i});
  nodes.push({id:'n'+i,type:'TEXT',text:'رسالة رقم '+i,next:'menu'});
 }
 const flow={startId:'start',nodes},a=arrangeFlow(flow),b=arrangeFlow(flow);
 assert.deepEqual(a,b,'Layout must be deterministic');
 const boxes=Object.entries(a).map(([id,pos])=>({...pos,...nodeFootprint(nodes.find(n=>n.id===id))}));
 for(let i=0;i<boxes.length;i++)for(let j=0;j<i;j++)
  assert.equal(collides(boxes[i],boxes[j]),false,'node '+i+' overlaps '+j);
});
test('already free point is preserved and does not rewrite graph content',()=>{
 const node={type:'TEXT',text:'أهلاً'};
 const at=placeWithoutOverlap({x:345,y:260},node,[]);
 assert.deepEqual(at,{x:345,y:260});
 assert.equal(node.text,'أهلاً');
});
