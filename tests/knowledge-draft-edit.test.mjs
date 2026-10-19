import test from 'node:test';
import assert from 'node:assert/strict';
import {updateKnowledgeDraft} from '../.build/apps/api/src/knowledge.js';

const actor={tenantId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',role:'OWNER'};
const id='12345678-1234-4123-8123-123456789012';
test('draft FAQ update changes only selected tenant-scoped DRAFT and records an audit event',async()=>{
 const seen=[];
 const db={async query(sql,args){seen.push({sql,args});
  if(sql.includes('UPDATE tenant_knowledge_articles'))return {rowCount:1,rows:[{id,question:args[2],answer:args[3],status:'DRAFT'}]};
  return {rowCount:1,rows:[]}
 }};
 const result=await updateKnowledgeDraft(db,actor,id,{question:'سؤال جديد للاختبار',answer:'إجابة جديدة للاختبار'});
 assert.equal(result.status,'DRAFT');
 assert.match(seen[0].sql,/status='DRAFT'/);
 assert.match(seen[0].sql,/tenant_id=\$1 AND id=\$2/);
 assert.equal(seen[0].args[0],actor.tenantId);
 assert.match(seen[1].sql,/FAQ_DRAFT_UPDATED/);
});
test('published FAQ cannot be edited by draft endpoint',async()=>{
 let count=0;
 const db={async query(sql){count++;if(sql.includes('UPDATE'))return{rowCount:0,rows:[]};throw new Error('should not insert audit event');}};
 await assert.rejects(updateKnowledgeDraft(db,actor,id,{question:'سؤال جديد',answer:'إجابة مختلفة'}),/Editable draft FAQ not found/);
 assert.equal(count,1);
});
test('FAQ draft edit rejects a viewer and invalid draft payload',async()=>{
 const db={async query(){throw new Error('must not query')}};
 await assert.rejects(updateKnowledgeDraft(db,{...actor,role:'VIEWER'},id,{question:'سؤال',answer:'إجابة'}));
 await assert.rejects(updateKnowledgeDraft(db,actor,id,{question:'',answer:'قصيرة'}),/Invalid question or answer/);
});
