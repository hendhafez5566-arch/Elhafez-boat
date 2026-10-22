import test from 'node:test';
import assert from 'node:assert/strict';
import {inferQuickSetup,buildGuidedFlow} from '../apps/web/public/flow-onboarding.js';
import {validateFlow} from '../.build/apps/api/src/flow-engine.js';

test('Arabic plain description suggests a matching company and goal offline',()=>{
 const examples=[
  ['شركة سياحة تعرض برامج العمرة والأسعار للزوار','tourism','catalog'],
  ['عيادة تريد الرد على أسئلة المرضى والاستفسارات','clinic','support'],
  ['مطعم يقدم منيو لعملاء الفرع','restaurant','catalog'],
  ['متجر ملابس ويجمع بيانات العملاء المهتمين','shop','leads'],
  ['شركة عقارات عايزة تعرض الشقق والعقارات','realestate','catalog'],
  ['مدرسة تقدم الكورسات وتسجل الطلاب المهتمين','education','leads']
 ];
 for(const [description,industry,goal] of examples){
  const suggestion=inferQuickSetup(description);
  assert.equal(suggestion.industry,industry,description);
  assert.equal(suggestion.goal,goal,description);
  validateFlow(buildGuidedFlow({...suggestion,businessName:'شركة اختبار'}));
 }
 assert.throws(()=>inferQuickSetup('مرحبا'),/وصف/);
});
