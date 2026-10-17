import test from 'node:test';
import assert from 'node:assert/strict';
import {templateComponents} from '../.build/apps/api/src/template-components.js';

const template=()=>[
 {type:'BODY',text:'أهلًا {{1}}، شوف العروض'},
 {type:'CAROUSEL',cards:[
  {components:[
   {type:'HEADER',format:'IMAGE'},
   {type:'BODY',text:'عرض {{1}}'},
   {type:'BUTTONS',buttons:[{type:'QUICK_REPLY',text:'مهتم'}]}
  ]},
  {components:[
   {type:'HEADER',format:'IMAGE'},
   {type:'BODY',text:'منتج {{1}}'},
   {type:'BUTTONS',buttons:[{type:'URL',url:'https://example.com/p/{{1}}',text:'تفاصيل'}]}
  ]}
 ]}
];
const values=()=>({body:['محمد'],cards:[
 {mediaUrl:'https://cdn.example.com/1.jpg',body:['الأول'],buttons:{'0':'interest_one'}},
 {mediaUrl:'https://cdn.example.com/2.jpg',body:['الثاني'],buttons:{'0':'sku_two'}}
]});
test('render provider-approved two-card carousel from explicit values',()=>{
 const out=templateComponents(template(),values());
 assert.equal(out[0].type,'body');
 assert.equal(out[1].type,'carousel');
 assert.equal(out[1].cards.length,2);
 assert.equal(out[1].cards[1].card_index,1);
 assert.deepEqual(out[1].cards[0].components[0].parameters,[{type:'image',image:{link:'https://cdn.example.com/1.jpg'}}]);
 assert.equal(out[1].cards[0].components[2].parameters[0].payload,'interest_one');
 assert.equal(out[1].cards[1].components[2].parameters[0].text,'sku_two');
});
test('carousel needs values for every card',()=>{
 const v=values();v.cards.pop();
 assert.throws(()=>templateComponents(template(),v),/every carousel card/);
});
test('carousel rejects unapproved extra card values',()=>{
 const v=values();v.cards[0].buttons['3']='extra';
 assert.throws(()=>templateComponents(template(),v),/Unexpected carousel card button/);
});
test('carousel rejects non-HTTPS media',()=>{
 const v=values();v.cards[0].mediaUrl='http://127.0.0.1/secret';
 assert.throws(()=>templateComponents(template(),v),/HTTPS/);
});
test('unsupported carousel card structures fail closed',()=>{
 const t=template();t[1].cards[0].components[0].format='DOCUMENT';
 assert.throws(()=>templateComponents(t,values()),/Unsupported carousel media header/);
});
test('unapproved more-than-two carousel buttons rejected',()=>{
 const t=template();t[1].cards[0].components[2].buttons.push(
  {type:'QUICK_REPLY',text:'2'},{type:'QUICK_REPLY',text:'3'});
 assert.throws(()=>templateComponents(t,values()),/up to two/);
});
test('carousel accepts only a single carousel component',()=>{
 const t=template();t.push(t[1]);
 assert.throws(()=>templateComponents(t,values()),/Only one approved carousel/);
});
test('normal approved template remains supported without carousel data',()=>{
 const t=[{type:'BODY',text:'مرحبًا {{1}}'}];
 assert.deepEqual(templateComponents(t,{body:['محمد']}),[{type:'body',parameters:[{type:'text',text:'محمد'}]}]);
});
