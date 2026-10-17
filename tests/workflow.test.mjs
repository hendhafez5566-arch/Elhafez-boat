import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const ts=createRequire(import.meta.url)("typescript");
const menuSource=readFileSync(new URL("../packages/contracts/src/menu.ts",import.meta.url),"utf8");
const flowSource=readFileSync(new URL("../packages/contracts/src/workflow.ts",import.meta.url),"utf8");
const modules={};
for(const [id,source] of [["./menu.js",menuSource],["./workflow.js",flowSource]]) {
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};new Function("module","exports","require",code)(m,m.exports,key=>modules[key]);modules[id]=m.exports;
}
const {homeMenu,categoryMenu,transition}=modules["./workflow.js"];
const program={id:"p",tenantId:"tenant-a",category:"UMRAH",title:"عمرة رمضان",priceMinor:2500000,currency:"EGP",published:true,availableSeats:5};
test("main menu offers interactive categories",()=>assert.equal(homeMenu().rows.length,5));
test("catalog hides other tenant programs",()=>assert.equal(categoryMenu("tenant-b","UMRAH",[program]).rows.length,0));
test("catalog displays published available programs",()=>assert.equal(categoryMenu("tenant-a","UMRAH",[program]).rows[0].id,"program:p"));
test("cross-tenant program action cannot access program",()=>assert.equal(transition({tenantId:"tenant-b",status:"BOT",currentMenu:"HOME"},"program:p",[program]).program,undefined));
test("human handoff blocks bot navigation",()=>{const a=transition({tenantId:"tenant-a",status:"BOT",currentMenu:"HOME"},"handoff",[program]);assert.equal(a.state.status,"HUMAN");assert.equal(transition(a.state,"category:UMRAH",[program]).view,undefined)});
