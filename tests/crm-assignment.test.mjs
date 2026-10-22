import test from 'node:test';
import assert from 'node:assert/strict';
import {assignLead} from '../.build/apps/api/src/chatbot-leads.js';
const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',staff='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actor={tenantId:tenant,userId:tenant,role:'OWNER'};
test('CRM assigns only a tenant member to active lead with audit',async()=>{
 const queries=[];const db={query:async(sql,params)=>{queries.push({sql,params});return {rows:[{id:tenant}],rowCount:1}}};
 const out=await assignLead(db,actor,tenant,{userId:staff});
 assert.equal(out.assignedUserId,staff);
 assert.deepEqual(queries[0].params,[tenant,staff]);
 assert.ok(queries[0].sql.includes('memberships'));
 assert.ok(queries[1].sql.includes("stage!='CLOSED'"));
 assert.deepEqual(queries[1].params,[tenant,tenant,staff]);
 assert.ok(queries[2].sql.includes('audit_events'));
 await assert.rejects(()=>assignLead(db,{...actor,role:'VIEWER'},tenant,{userId:staff}));
 await assert.rejects(()=>assignLead(db,actor,tenant,{userId:'not-a-uuid'}));
});
test('assignment refuses members not belonging to company',async()=>{
 const db={query:async()=>({rows:[],rowCount:0})};
 await assert.rejects(()=>assignLead(db,actor,tenant,{userId:staff}),error=>error.status===404);
});
