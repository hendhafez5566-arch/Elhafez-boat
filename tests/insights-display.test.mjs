import test from 'node:test';
import assert from 'node:assert/strict';
import {initInsights} from '../apps/web/public/insights-ui.js';

function node(tag,text='',className=''){
 return {tag,textContent:text??'',className,style:{},children:[],
  append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children=items}};
}
function findMetric(root,title){
 const walk=n=>n.tag==='article'&&n.children[0]?.textContent===title?n:[...(n.children||[])].map(walk).find(Boolean);
 return walk(root);
}
test('insights renders a real nonzero lead capture percentage and preserves zero',async()=>{
 const root=node('div');
 const data={conversations:40,leads:15,leadCapturePct:37.5,ready:3,contacted:2,closedLeads:1,
  tasks:{open:4,overdue:1,done:7},campaigns:{active:0,total:2},channels:[],daily:[]};
 const api=async path=>{assert.equal(path,'/analytics/overview?days=30');return data};
 const insights=initInsights({api,$:id=>{assert.equal(id,'bot-insights');return root},el:node});
 await insights.load();
 const title='نسبة تحويل المحادثة إلى اهتمام';
 assert.equal(findMetric(root,title).children[1].textContent,new Intl.NumberFormat('ar-EG').format(37.5)+'٪');
 data.leadCapturePct=0;
 await insights.load();
 assert.equal(findMetric(root,title).children[1].textContent,new Intl.NumberFormat('ar-EG').format(0)+'٪');
});
