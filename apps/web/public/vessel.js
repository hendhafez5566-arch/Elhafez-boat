/** Vessel workspace: compose existing working UI, preserving all original IDs and handlers. */
export function initVesselWorkspace(){
 const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const app=$('app'),rail=app.querySelector('.sidebar'),nav=rail.querySelector('nav'),top=app.querySelector('.topbar');
 app.classList.add('vessel-app');rail.classList.add('vessel-rail');top.classList.add('vessel-top');
 const brand=rail.querySelector('.brand');brand.replaceChildren(make('span','vessel-monogram','B.'),make('small','vessel-logotype','BOAT'));brand.classList.add('vessel-brand');
 const all=[...nav.querySelectorAll('button[data-page]')],byId=new Map(all.map(b=>[b.dataset.page,b]));
 const legacy=nav.querySelector('.nav-advanced');if(legacy)legacy.style.display='none';
 const quick=['overview','wa-inbox','flow-builder','leads','catalog'];
 for(const id of quick){const b=byId.get(id);if(b){b.classList.add('vessel-rail-item');b.title=b.textContent.trim();nav.append(b)}}
 const trigger=make('button','vessel-menu-button','☷');trigger.type='button';trigger.setAttribute('aria-label','جميع الأقسام');trigger.setAttribute('aria-expanded','false');rail.insertBefore(trigger,nav);
 const drawer=make('aside','vessel-drawer');drawer.id='vessel-drawer';drawer.hidden=true;
 const heading=make('div','vessel-drawer-heading');const identity=make('div','vessel-drawer-identity');
 identity.append(make('strong','', 'Elhafez Boat'),make('small','','مساحة عمل شركتك'));
 const close=make('button','vessel-close','×');close.type='button';close.setAttribute('aria-label','إغلاق القائمة');
 heading.append(identity,close);
 const search=make('input','vessel-search');search.type='search';search.placeholder='ابحث عن قسم أو أداة';search.setAttribute('aria-label','البحث في أقسام المنصة');
 const groups=make('div','vessel-menu-groups');
 const categories=[['التقارير والأتمتة',['analytics','campaigns','triggers']],['المحتوى والمساعد',['media','templates','settings','ai-settings']],['القنوات والتكاملات',['website','wa-connect','channels','integrations','connectors','comment-automation']],['الإدارة',['team','privacy','usage']]];
 const grouped=new Set(quick);
 for(const [name,ids] of categories){const section=make('section','vessel-menu-section');section.append(make('h3','',name));for(const id of ids){grouped.add(id);const b=byId.get(id);if(b){b.classList.add('vessel-menu-link');section.append(b)}}groups.append(section)}
 const remaining=all.filter(b=>!grouped.has(b.dataset.page));
 if(remaining.length){const other=make('section','vessel-menu-section');other.append(make('h3','','المزيد'),...remaining);groups.append(other)}
 const foot=make('div','vessel-drawer-footer');foot.append($('logout'));
 drawer.append(heading,search,groups,foot);app.insertBefore(drawer,app.querySelector('.main-shell'));
 const backdrop=make('button','vessel-backdrop');backdrop.type='button';backdrop.hidden=true;backdrop.setAttribute('aria-label','إغلاق القائمة');app.insertBefore(backdrop,app.querySelector('.main-shell'));
 const header=make('div','vessel-page-heading');header.append(make('span','vessel-eyebrow','ELHAFEZ / WORKSPACE'),$('page-title'));
 const actions=make('div','vessel-header-actions');const tenant=$('company-name');tenant.classList.add('vessel-tenant');
 const command=make('button','vessel-command','⌕  بحث');command.type='button';command.setAttribute('aria-label','بحث عن أداة في المنصة');
 actions.append(tenant,command,$('notifications'));top.replaceChildren(header,actions);
 const filter=()=>{const q=search.value.trim().toLocaleLowerCase('ar');for(const group of groups.children){let count=0;for(const b of group.querySelectorAll('button[data-page]')){const matches=!q||b.textContent.toLocaleLowerCase('ar').includes(q);b.style.display=matches?'':'none';if(matches&&!b.hidden)count++}group.style.display=count?'':'none'}};
 const open=()=>{drawer.hidden=false;backdrop.hidden=false;trigger.setAttribute('aria-expanded','true');search.focus()};
 const hide=()=>{drawer.hidden=true;backdrop.hidden=true;trigger.setAttribute('aria-expanded','false');search.value='';filter()};
 trigger.onclick=()=>drawer.hidden?open():hide();command.onclick=open;close.onclick=hide;backdrop.onclick=hide;search.oninput=filter;
 for(const b of all)b.addEventListener('click',hide);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden){hide();trigger.focus()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!app.hidden){e.preventDefault();open()}});
 // Recompose the home screen into an editorial story without replacing live metric widgets.
 const home=$('overview'),oldHero=home.querySelector('.section-heading'),metric=$('dashboard-metrics'),start=$('getting-started'),grid=home.querySelector('.grid');
 const art=make('div','vessel-journey');art.setAttribute('aria-label','مثال توضيحي لمسار محادثة');art.setAttribute('role','img');
 for(const [symbol,title,subtitle] of [['✦','رسالة ترحيب','أهلًا بالعميل'],['☷','اختيارات تفاعلية','المنتجات • الأسعار'],['↗','تحويل لموظف','عندما يحتاج مساعدة']]){const tile=make('div','vessel-journey-tile');tile.append(make('span','vessel-journey-icon',symbol));const content=make('div');content.append(make('strong','',title),make('small','',subtitle));tile.append(content);art.append(tile)}
 const hero=make('div','vessel-hero');oldHero.classList.add('vessel-hero-copy');hero.append(oldHero,art);
 const metricsHeading=make('div','vessel-metrics-heading');metricsHeading.append(make('small','','نظرة عامة'),make('h3','','نشاط شركتك في لمحة'));
 const panels=make('div','vessel-home-panels');start.classList.add('vessel-start');const overviewCards=[...grid.children];const ready=overviewCards[0];ready.classList.add('vessel-ready');panels.append(start,ready);
 const channels=overviewCards[1];channels.classList.add('vessel-channels');
 home.replaceChildren(hero,metricsHeading,metric,panels,channels);home.classList.add('vessel-home');
 // True two-pane inbox workspace, existing message and reply controls retained.
 const inbox=$('wa-inbox'),columns=inbox.querySelector('.inbox-layout');
 inbox.classList.add('vessel-inbox');columns.classList.add('vessel-inbox-grid');
 const left=columns.children[0],right=columns.children[1];left.classList.remove('panel');right.classList.remove('panel');
 left.classList.add('vessel-thread-list');right.classList.add('vessel-thread-view');
 const chatHead=make('div','vessel-chat-header'),avatar=make('span','vessel-chat-avatar','◉'),who=make('div','vessel-chat-person');
 who.append($('thread-title'),make('small','','رسائل العميل ومتابعة الفريق'));chatHead.append(avatar,who);right.prepend(chatHead);
 $('thread-messages').classList.add('vessel-message-area');$('thread-tools').classList.add('vessel-composer');
}