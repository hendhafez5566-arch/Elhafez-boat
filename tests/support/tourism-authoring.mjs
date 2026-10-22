import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {studioClick,revealStudioControl} from './studio-navigation.mjs';

/** Every graph mutation below uses visible author controls; API reads only verify persistence. */
export async function authorTourismFlow({page,base,api,check,dir}){
 await page.setViewportSize({width:1440,height:1000});
 await studioClick(page,'إدارة البوتات');
 await page.locator('.bot-quick-create > summary').waitFor({state:'visible'});
 await page.screenshot({path:dir+'/22-bot-manager-navigation.png'});
 await page.locator('.bot-quick-create > summary').click();
 const form=page.locator('.bot-create-form');
 await form.locator('[name=name]').fill('قبول التأليف · شركة سياحة');
 await form.locator('[name=templateId]').selectOption('blank');
 await form.getByRole('button',{name:'إنشاء بوت',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.canvas-node').length===1);
 check('actual bot-manager UI creates a blank bot with one Start node');
 const botId=await page.evaluate(()=>location.hash.split('/')[1]);
 await page.getByLabel('قناة التصميم',{exact:true}).selectOption('WEBSITE');
 const editor=page.locator('#builder-editor');
 const add=async(type,title,text)=>{
  await page.getByRole('button',{name:'إضافة '+type,exact:true}).click();
  const id=await page.locator('.canvas-node.selected').getAttribute('data-node-id');
  await editor.getByLabel('اسم الخطوة',{exact:true}).fill(title);
  if(text)await editor.getByLabel(type==='سؤال وتسجيل إجابة'?'السؤال':'نص الرسالة',{exact:true}).fill(text);
  return id;
 };
 const choose=async title=>{
  await page.getByLabel('بحث المخطط بالاسم أو النص أو المعرف',{exact:true}).fill(title);
  await page.locator('.builder-search-results button').first().click();
 };
 const route=async(label,id)=>{const control=editor.getByLabel(label,{exact:true});await revealStudioControl(page,control);await control.selectOption(id)};
 const welcome=await add('رسالة نصية','ترحيب السياحة','أهلًا بك في الحافظ للسياحة. كيف نساعدك؟');
 const menu=await add('أزرار رد','خدمات السياحة','اختر الخدمة المناسبة');
 await editor.getByRole('button',{name:'إضافة اختيار',exact:true}).click();
 await editor.getByRole('button',{name:'إضافة اختيار',exact:true}).click();
 for(const [i,title]of ['البرامج السياحية','استفسار العروض','تحدث مع موظف'].entries())await editor.getByLabel('عنوان الاختيار '+(i+1),{exact:true}).fill(title);
 const gallery=await add('معرض بطاقات','برامج الرحلات');
 await editor.getByLabel('عنوان البطاقة 1',{exact:true}).fill('رحلات داخل مصر');
 await editor.getByLabel('عنوان البطاقة 2',{exact:true}).fill('رحلات خارج مصر');
 const input=await add('سؤال وتسجيل إجابة','جمع الاسم','ما اسمك؟');
 await editor.getByLabel('ما البيانات التي تجمعها؟',{exact:true}).selectOption('customer_name');
 const condition=await add('شرط','التحقق من الاسم');
 await editor.getByLabel('قارن إجابة العميل عن',{exact:true}).selectOption('customer_name');
 const handoff=await add('تحويل لموظف','خدمة العملاء','تم تحويل طلبك إلى فريق خدمة العملاء.');
 const offers=await add('رسالة نصية','استفسارات العروض','يراجع الموظف العروض المعتمدة معك.');
 check('visible library and Inspector author welcome, three buttons, two gallery cards, name question, condition and handoff');
 await route('الخطوة التالية',handoff);
 await choose('ترحيب السياحة');await route('الخطوة التالية',menu);
 await choose('خدمات السياحة');
 for(const [i,id]of [gallery,offers,handoff].entries()){
  const disclosure=editor.locator('.builder-choice-advanced').nth(i);
  await disclosure.locator('summary').click();
  await disclosure.getByLabel('عند الضغط ينتقل إلى',{exact:true}).selectOption(id);
 }
 await choose('برامج الرحلات');await route('الخطوة التالية',input);
 await choose('جمع الاسم');await route('الخطوة التالية',condition);
 await choose('التحقق من الاسم');await route('لو الشرط صحيح',handoff);await route('لو الشرط غلط',input);
 // The blank template deliberately has no outgoing route until the author connects it.
 await page.getByLabel('بحث المخطط بالاسم أو النص أو المعرف',{exact:true}).fill('start');
 await page.locator('.builder-search-results button').first().click();await route('الخطوة التالية',welcome);
 await choose('finish');await editor.getByRole('button',{name:'حذف الخطوة',exact:true}).click();
 await page.locator('#builder-save').click();await page.locator('#builder-unsaved').filter({hasText:'تم الحفظ على الخادم'}).waitFor();
 const path='/bots/'+botId+'/flows',saved=(await api(path)).data.draft.definition;
 assert.equal(saved.nodes.length,8);assert.equal(saved.nodes.some(n=>n.id==='finish'),false);
 assert.equal(saved.nodes.find(n=>n.id===menu).choices.length,3);
 assert.deepEqual(saved.nodes.find(n=>n.id===menu).choices.map(c=>c.next),[gallery,offers,handoff]);
 assert.equal(saved.nodes.find(n=>n.id===gallery).blocks[0].cards[1].title,'رحلات خارج مصر');
 assert.equal(saved.nodes.find(n=>n.id==='start').next,welcome);
 assert.equal(saved.nodes.find(n=>n.id===condition).yes,handoff);
 await page.reload();await page.waitForSelector('[data-node-id="'+menu+'"]');
 assert.deepEqual((await api(path)).data.draft.definition,saved);
 await writeFile(dir+'/authored-tourism.json',JSON.stringify({botId,definition:saved,transport:'NONE; all graph mutations through visible UI'},null,2)+'\n');
 check('visible UI creates a blank tourism bot, welcome, three routed buttons, gallery, customer input, condition and handoff; save/reopen preserves every setting');
 await studioClick(page,'تجربة المحادثة');const preview=page.locator('.builder-preview-dialog');
 await preview.getByRole('button',{name:'البرامج السياحية',exact:true}).click();
 await preview.getByText('ما اسمك؟',{exact:true}).waitFor();
 await preview.locator('.builder-preview-input input').fill('عميل قبول');await preview.locator('.builder-preview-input button').click();
 await preview.getByText('تم تحويل طلبك إلى فريق خدمة العملاء.',{exact:true}).waitFor();
 assert.equal(await preview.locator('.flow-content-card').count(),2);
 await preview.screenshot({path:dir+'/11-authored-tourism-preview.png'});
 await preview.locator('.builder-dialog-header button').click();
 if(await page.locator('.builder-properties>button').first().isVisible())await page.locator('.builder-properties>button').first().click();await studioClick(page,'ملاءمة المخطط');
 assert.equal(await page.locator('.flow-canvas').evaluate(host=>{const area=host.getBoundingClientRect();return [...host.querySelectorAll('.canvas-node')].every(node=>{const r=node.getBoundingClientRect();return r.left>=area.left&&r.right<=area.right&&r.top>=area.top&&r.bottom<=area.bottom})}),true,'Fit must keep every authored card inside Canvas, including bottom rows');
 await page.screenshot({path:dir+'/12-authored-tourism-workspace.png'});
 check('UI-authored tourism flow actually simulates gallery, typed name, condition and employee handoff through the shared engine');
}
