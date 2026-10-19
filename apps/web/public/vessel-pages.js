/** Vessel: company page composition, no business logic or API replacement. */
export function initVesselPages(){
 const $=id=>document.getElementById(id),el=(tag,klass='',text)=>{const n=document.createElement(tag);if(klass)n.className=klass;if(text!==undefined)n.textContent=text;return n};
 const config={
  leads:['CUSTOMERS','إدارة علاقات العملاء','كل عميل مهتم له خطوة واضحة.','users'],
  catalog:['CATALOG','منتجاتك وخدماتك','اعرض بيانات شركتك المعتمدة للعميل.','box'],
  analytics:['ANALYTICS','أداء المحادثات','بيانات فعلية تساعدك تفهم اهتمام العملاء.','chart'],
  settings:['KNOWLEDGE','قاعدة المعرفة','الإجابات المعتمدة التي يستند إليها البوت.','book'],
  'ai-settings':['ASSISTANT','المساعد الذكي','راجع التعليمات واختبر المقترحات قبل استخدامها.','sparkle'],
  'wa-connect':['WHATSAPP','ربط واتساب','اتبع خطوات التفعيل والتحقق من قناتك الرسمية.','link'],
  team:['TEAM','فريق العمل','إدارة الموظفين والدعوات والصلاحيات.','users'],
  templates:['TEMPLATES','قوالب واتساب','قوالب معتمدة وموافقات واضحة.','mail'],
  triggers:['AUTOMATION','التشغيل التلقائي','حدد ماذا يحدث عند استقبال رسالة أو كلمة.','sparkle'],
  website:['WEBSITE CHAT','شات الموقع','تواصل زوار موقعك مع الفريق من مكان واحد.','link'],
  media:['MEDIA','مكتبة الوسائط','الصور والملفات المستخدمة في المحادثات.','box'],
  campaigns:['CAMPAIGNS','الحملات والتتابعات','التواصل باستخدام قوالب معتمدة مع موافقة العميل.','mail'],
  integrations:['INTEGRATIONS','التكاملات','إعدادات الربط الفني والأمان في مكان واضح.','link'],
  connectors:['CONNECTORS','الموصلات الأصلية','تابع أدوات شركتك والمزامنة.','link'],
  channels:['CHANNELS','القنوات الإضافية','حسابات التواصل المتصلة بهذه الشركة.','link'],
  'comment-automation':['SOCIAL','أتمتة التعليقات','راجع قواعد التفاعل والردود المقترحة.','sparkle'],
  privacy:['PRIVACY','الخصوصية','إعدادات حماية بيانات العملاء والاحتفاظ بها.','shield'],
  usage:['USAGE','الاستهلاك والسجلات','تابع حدود استخدام شركتك وتشغيل المهام.','chart']
 };
 const icons={
  users:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  box:'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',
  chart:'M4 20V9 M10 20V4 M16 20v-9 M22 20V7',
  book:'M4 5h9v16H4a2 2 0 0 0-2 2V7a2 2 0 0 1 2-2z M13 5h7v16h-7',
  sparkle:'M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z',
  link:'M9 15l6-6 M8 9H6a4 4 0 0 0 0 8h4 M14 7h4a4 4 0 0 1 0 8h-2',
  mail:'M3 5h18v14H3z M3 6l9 7 9-7',
  shield:'M12 3l9 4v5c0 5-3 8-9 10-6-2-9-5-9-10V7z'
 };
 for(const [id,[kicker,title,description,icon]] of Object.entries(config)){
  const page=$(id);if(!page)continue;
  page.classList.add('vessel-subpage','vessel-page-'+id);
  const heading=[...page.children].find(n=>n.matches('h2,.section-heading'));
  const oldTitle=heading?.matches('h2')?heading:heading?.querySelector('h2');
  const hero=el('header','vessel-page-hero'),text=el('div','vessel-page-hero-text');
  text.append(el('span','vessel-page-kicker',kicker));
  const h=oldTitle||el('h2');h.textContent=title;
  text.append(h,el('p','vessel-page-intro',description));
  const emblem=el('span','vessel-page-symbol'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',icons[icon]);svg.append(path);emblem.append(svg);
  hero.append(text,emblem);page.prepend(hero);
  if(heading?.classList.contains('section-heading'))heading.classList.add('vessel-page-legacy-heading');
 }
 const catalog=$('catalog'),grid=catalog?.querySelector('.grid');
 if(grid){
  grid.classList.add('vessel-catalog-layout');
  const [formPanel,listPanel]=grid.children;
  formPanel.classList.add('vessel-catalog-editor');listPanel.classList.add('vessel-catalog-library');
  formPanel.prepend(el('p','vessel-editor-tip','جهّز معلومات المنتج أو الخدمة واحفظها كمسودة، ثم اعتمدها عند النشر.'));
  const header=el('div','vessel-library-header'),headerTitle=el('div');
  headerTitle.append(el('span','vessel-page-kicker','LIBRARY'),el('h3','','العناصر المسجلة'));
  const search=el('input','vessel-library-search');search.type='search';search.placeholder='بحث في العناصر المعروضة';
  search.setAttribute('aria-label','البحث في عناصر الكتالوج المعروضة');
  const add=el('button','primary vessel-library-add','+ إضافة منتج أو خدمة');add.type='button';
  const veil=el('button','vessel-editor-backdrop');veil.hidden=true;veil.type='button';
  veil.setAttribute('aria-label','إغلاق نموذج المنتج');document.body.append(veil);
  const closeEditor=()=>{formPanel.hidden=true;formPanel.classList.remove('is-open');veil.hidden=true;add.focus()};
  const openEditor=()=>{formPanel.hidden=false;formPanel.classList.add('is-open');veil.hidden=false;formPanel.querySelector('input[name="title"]')?.focus()};
  add.onclick=()=>{formPanel.querySelector('#catalog-new')?.click();openEditor()};
  veil.onclick=closeEditor;
  const close=el('button','secondary vessel-editor-close','إغلاق ×');close.type='button';close.onclick=closeEditor;
  formPanel.prepend(close);formPanel.hidden=true;
  listPanel.addEventListener('click',event=>{if(event.target.closest('button')?.textContent?.trim()==='تعديل')openEditor()});
  header.append(headerTitle,search,add);
  const count=el('p','vessel-library-count');count.setAttribute('aria-live','polite');
  listPanel.prepend(header,count);
  const list=$('catalog-items');
  const noResults=el('div','vessel-catalog-empty');noResults.hidden=true;
  noResults.append(el('p','','لا توجد عناصر تطابق البحث.'));
  const reset=el('button','secondary','مسح البحث');reset.type='button';
  reset.onclick=()=>{search.value='';filter();search.focus()};
  noResults.append(reset);listPanel.append(noResults);
  const filter=()=>{
   const term=search.value.trim().toLocaleLowerCase('ar');let all=0,shown=0;
   for(const card of list.children){if(!card.classList.contains('card'))continue;all++;
    card.hidden=Boolean(term)&&!card.textContent.toLocaleLowerCase('ar').includes(term);if(!card.hidden)shown++}
   count.textContent=all?'عرض '+shown+' من '+all+' عنصر مسجّل':'لم تضف أي عناصر بعد';
   noResults.hidden=!all||shown>0;
  };
  search.addEventListener('input',filter);new MutationObserver(filter).observe(list,{childList:true});filter();
 }
 for(const id of ['settings','team','templates','triggers','website','campaigns','ai-settings','integrations']){
  $(id)?.querySelector(':scope > .grid')?.classList.add('vessel-subpage-grid');
 }
}