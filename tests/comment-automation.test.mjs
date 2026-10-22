import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMetaComments,matchComment,saveCommentRule,decideComment,privateReplyRequest} from '../.build/apps/api/src/comment-automation.js';
const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',account='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actor={tenantId:tenant,userId:tenant,role:'OWNER'};
test('Meta comment extractor only considers new supported comments',()=>{
 const entry={id:'123456789',time:Math.floor(Date.now()/1000),changes:[
  {field:'feed',value:{item:'comment',verb:'add',comment_id:'123_456',from:{id:'789'},message:'السعر من فضلك'}},
  {field:'feed',value:{item:'comment',verb:'remove',comment_id:'123_457',message:'السعر'}},
  {field:'feed',value:{item:'comment',verb:'add',comment_id:'123_458',from:{id:'123456789'},message:'السعر'}},
  {field:'feed',value:{item:'post',verb:'add',comment_id:'123_459',message:'السعر'}}]};
 const list=parseMetaComments({object:'page',entry:[entry]});
 assert.equal(list.length,1);assert.equal(list[0].commentId,'123_456');
 assert.equal(parseMetaComments({object:'invalid',entry:[entry]}).length,0);
 assert.equal(parseMetaComments({object:'instagram',entry:[{id:'123456789',time:entry.time,changes:[{field:'comments',value:{id:'987',text:'معلومات',from:{id:'123'}}}]}]}).length,1);
});
test('matching is explicit and no unknown/comment text is copied into replies',()=>{
 const r={id:tenant,keyword:'السعر',reply_text:'يسعدنا توضيح التفاصيل',mode:'REVIEW'};
 assert.equal(matchComment('السعر من فضلك',[r]).id,tenant);
 assert.equal(matchComment('شكرا جزيلا',[r]),null);
});
test('rule writes require company account, bounded content, and explicit enable',async()=>{
 const calls=[],db={query:async(sql,params)=>{calls.push({sql,params});return {rows:[{id:tenant}],rowCount:1}}};
 const out=await saveCommentRule(db,actor,{accountId:account,name:'الأسعار',keyword:'السعر',replyText:'أهلًا بحضرتك',mode:'REVIEW',enabled:false});
 assert.equal(out.externalDeliveryEnabled,false);
 assert.deepEqual(calls[0].params,[tenant,account]);
 assert.ok(calls[1].sql.includes('chatbot_comment_rules'));
 await assert.rejects(()=>saveCommentRule(db,actor,{accountId:account,name:'a',keyword:'x',replyText:'a',mode:'AUTO',enabled:true}));
 await assert.rejects(()=>saveCommentRule(db,{...actor,role:'VIEWER'},{}));
});
test('approval is per-tenant and only from REVIEW',async()=>{
 const calls=[],db={query:async(sql,params)=>{calls.push({sql,params});return {rows:[{id:tenant}],rowCount:1}}};
 const result=await decideComment(db,actor,tenant,{approve:true});
 assert.equal(result.status,'APPROVED');assert.deepEqual(calls[0].params,[tenant,tenant,'APPROVED']);
 assert.ok(calls[0].sql.includes("status='REVIEW'"));
});

test('private replies are addressed by comment ID through channel-specific messages edge',()=>{
 const ig=privateReplyRequest('INSTAGRAM','123456','123_789','أهلًا','v25.0');
 assert.equal(ig.host,'graph.instagram.com');
 assert.equal(ig.path,'v25.0/123456/messages');
 assert.deepEqual(ig.body.recipient,{comment_id:'123_789'});
 const fb=privateReplyRequest('MESSENGER','123456','123_789','أهلًا','v25.0');
 assert.equal(fb.host,'graph.facebook.com');
 assert.equal(fb.path,'v25.0/123456/messages');
 assert.throws(()=>privateReplyRequest('TELEGRAM','123456','123_789','أهلًا','v25.0'));
});
