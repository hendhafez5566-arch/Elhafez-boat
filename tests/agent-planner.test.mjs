import test from 'node:test';
import assert from 'node:assert/strict';
import {planApprovedAgent,previewAgent} from '../.build/apps/api/src/ai.js';
const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',actor={tenantId:tenant,userId:tenant,role:'OWNER'};
test('planned answers never synthesize business content',()=>{
 const faq=[{id:'faq:one',question:'مواعيد العمل',answer:'9 to 5'}];
 assert.deepEqual(planApprovedAgent('مواعيد العمل',faq).sourceIds,['faq:one']);
 assert.equal(planApprovedAgent('مواعيد العمل',faq).message,'9 to 5');
 assert.deepEqual(planApprovedAgent('عايز موظف',faq).actions,['HANDOFF']);
 assert.equal(planApprovedAgent('عايز احجز',faq).needsStaff,true);
 assert.deepEqual(planApprovedAgent('طلب معلومة غير معروفة',faq).sourceIds,[]);
});
test('preview uses tenant-scoped approved information and cannot send',async()=>{
 const queries=[];
 const db={query:async(sql,params)=>{queries.push({sql,params});return {rows:sql.includes('tenant_knowledge_articles')?[{id:'one',question:'مواعيد العمل',answer:'9 to 5'}]:[],rowCount:1}}};
 const data=await previewAgent(db,actor,{question:'مواعيد العمل'});
 assert.equal(data.preview,true);assert.equal(data.outboundMessages,0);assert.equal(data.message,'9 to 5');
 assert.equal(queries.length,2);for(const query of queries){assert.deepEqual(query.params,[tenant]);assert.ok(query.sql.includes("status='PUBLISHED'"))}
 await assert.rejects(()=>previewAgent(db,actor,{question:'x'}));
 await assert.rejects(()=>previewAgent(db,{...actor,role:'AGENT'},{question:'مواعيد العمل'}));
});
