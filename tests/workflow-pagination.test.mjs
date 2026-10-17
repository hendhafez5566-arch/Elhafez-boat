import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const modules={};
for(const [id,path] of [["./menu.js","../packages/contracts/src/menu.ts"],["./workflow.js","../packages/contracts/src/workflow.ts"]]){
 const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};new Function("module","exports","require",code)(m,m.exports,key=>modules[key]);modules[id]=m.exports;
}
const {categoryMenu,transition}=modules["./workflow.js"];
const programs=Array.from({length:18},(_,i)=>({id:"p"+i,tenantId:"a",category:"UMRAH",title:"برنامج "+i,priceMinor:10000,currency:"EGP",published:true,availableSeats:2}));
test("pagination respects list row maximum",()=>{for(let page=0;page<3;page++)assert.ok(categoryMenu("a","UMRAH",programs,page).rows.length<=10)});
test("next page returns subsequent programs",()=>{const s={tenantId:"a",status:"BOT",currentMenu:"UMRAH",page:0};const r=transition(s,"page:UMRAH:1",programs);assert.equal(r.view.rows[0].id,"program:p8")});
test("invalid page action is rejected",()=>{const s={tenantId:"a",status:"BOT",currentMenu:"UMRAH",page:0};const r=transition(s,"page:HAJJ:1",programs);assert.equal(r.state.page,0)});
test("last page has no next button",()=>assert.ok(!categoryMenu("a","UMRAH",programs,2).rows.some(r=>r.title==="التالي")));
