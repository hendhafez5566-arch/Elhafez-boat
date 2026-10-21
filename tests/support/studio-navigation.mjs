/** Follow the same progressive-disclosure controls as a user; never force hidden clicks. */
export async function revealStudioControl(page,locator){
 if(await locator.isVisible())return;
 if(await locator.evaluate(el=>Boolean(el.closest('.builder-operations-dialog')))){
  const menu=page.locator('.builder-operations-dialog');if(!await menu.isVisible())await page.getByRole('button',{name:'إعدادات المسار',exact:true}).click();
 }
 for(let i=0;i<8&&!await locator.isVisible();i++){
  const ancestors=await locator.locator('xpath=ancestor::details[not(@open)]').all();let opened=false;
  for(const ancestor of ancestors){const summary=ancestor.locator(':scope>summary');if(await summary.isVisible()){await summary.click();opened=true;break}}
  if(!opened)throw Error('No visible disclosure can reveal the requested studio control');
 }
}
export async function studioClick(page,name){const target=page.getByRole('button',{name,exact:true}).first();await revealStudioControl(page,target);await target.click();}
