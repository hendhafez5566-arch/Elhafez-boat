import {emptyState} from './ui-states.js';
/** Authenticated advanced settings. Every action calls the real API; secrets never render. */
export function initAdvanced({state,api,notify,$,el,button,card,bind,execute}){
 let connectors=[];
 const makeForm=()=>{const f=el('form');f.onsubmit=e=>e.preventDefault();return f};
 const json=(value,fallback={})=>{try{return value?JSON.parse(value):fallback}catch{throw new Error('صيغة JSON غير صحيحة')}};
 function field(form,label,name,type='text',value='',required=false){const l=el('label',label),input=el(type==='textarea'?'textarea':'input');input.name=name;if(type!=='textarea')input.type=type;input.value=value;input.required=required;if(type==='password')input.autocomplete='off';l.append(input);form.append(l);return input}
 function select(form,label,name,options){const l=el('label',label),s=el('select');s.name=name;for(const [value,text]of options){const o=el('option',text);o.value=value;s.append(o)}l.append(s);form.append(l);return s}
 async function connectorPage(){
 const host=$('native-connectors');host.replaceChildren();connectors=await api('/connectors');
 if(state.role==='OWNER'){
 const form=makeForm();form.append(el('h3','ربط Google Sheets / HubSpot / المتاجر'));
 field(form,'اسم الربط','name','text','',true);const provider=select(form,'النظام','provider',[['GOOGLE_SHEETS','Google Sheets — OAuth'],['HUBSPOT','HubSpot — OAuth أو تطبيق خاص'],['WOOCOMMERCE','WooCommerce — REST API'],['SHOPIFY','Shopify — OAuth أو رمز تطبيق']]);
 const hostInput=field(form,'نطاق المتجر فقط — مطلوب للمتاجر','host');
  const tokenInput=field(form,'رمز التطبيق — أو اتركه فارغًا للـOAuth','access_token','password');
  const wooKey=field(form,'WooCommerce consumer key','consumer_key','password');
  const wooSecret=field(form,'WooCommerce consumer secret','consumer_secret','password');
  const help=el('p','','muted');form.append(help);
  const updateFields=()=>{
    const store=['WOOCOMMERCE','SHOPIFY'].includes(provider.value),woo=provider.value==='WOOCOMMERCE';
    for(const [input,visible] of [[hostInput,store],[tokenInput,!woo&&provider.value!=='GOOGLE_SHEETS'],[wooKey,woo],[wooSecret,woo]]){
      input.closest('label').hidden=!visible;input.disabled=!visible;if(!visible)input.value='';
    }
    hostInput.required=store;
    help.textContent=woo?'أدخل نطاق المتجر ومفاتيح WooCommerce. لا نعرضها بعد الحفظ.':provider.value==='GOOGLE_SHEETS'?'Google Sheets يتم ربطه عبر OAuth من بطاقة الموصل بعد إنشائه.':provider.value==='HUBSPOT'?'HubSpot: أنشئ الموصل ثم أكمل OAuth، أو أدخل رمز تطبيق خاص.':'Shopify: أدخل نطاق المتجر، وأكمل OAuth أو رمز التطبيق.';
  };
  provider.onchange=updateFields;updateFields();
 form.append(button('إضافة وربط',async()=>{if(!form.reportValidity())return;const d=Object.fromEntries(new FormData(form)),credentials=d.provider==='WOOCOMMERCE'?{consumer_key:d.consumer_key,consumer_secret:d.consumer_secret}:d.access_token?{access_token:d.access_token}:undefined;const result=await api('/connectors',{method:'POST',body:{name:d.name,provider:d.provider,config:{host:d.host||undefined},credentials}});form.reset();if(!credentials&&d.provider!=='WOOCOMMERCE')notify('تمت الإضافة؛ افتح زر OAuth للموصل لإكمال الربط');else notify('تم حفظ الاعتمادات؛ الإرسال الحقيقي يحتاج التحقق');await connectorPage()},'primary'));host.append(form);
 }
 for(const c of connectors){const pane=card(c.name,c.provider+' • '+(c.connected?'اعتمادات محفوظة — لا تثبت نجاح التسليم':'بانتظار الربط')+' • '+(c.enabled?'مفعل':'معطل'));pane.append(el('code',c.id));
 if(state.role==='OWNER'){
 if(c.provider!=='GOOGLE_SHEETS'){const rotation=makeForm();rotation.append(el('h4','تبديل اعتماد التطبيق'));if(c.provider==='WOOCOMMERCE'){field(rotation,'Consumer key الجديد','consumer_key','password','',true);field(rotation,'Consumer secret الجديد','consumer_secret','password','',true)}else field(rotation,'رمز التطبيق الجديد','access_token','password','',true);rotation.append(button('تحديث الاعتماد المشفر',async()=>{if(!rotation.reportValidity())return;await api('/connectors',{method:'POST',body:{...c,credentials:Object.fromEntries(new FormData(rotation))}});rotation.reset();await connectorPage()}));pane.append(rotation);}

 if(c.provider!=='WOOCOMMERCE')pane.append(button('ربط / تجديد OAuth',async()=>{const result=await api('/connectors/'+c.id+'/oauth',{method:'POST'});window.open(result.url,'_blank','noopener,noreferrer')}));
 pane.append(button(c.enabled?'تعطيل':'تفعيل',async()=>{await api('/connectors',{method:'POST',body:{...c,enabled:!c.enabled}});await connectorPage()}));
 const configForm=makeForm();configForm.append(el('h4','إعدادات الحقول والوجهة'));
 const spreadsheet=field(configForm,'Spreadsheet ID','spreadsheetId','text',c.config.spreadsheetId||'');const sheet=field(configForm,'اسم Sheet — مخصص للمزامنة، العمود A لمعرف العميل','sheet','text',c.config.sheet||'');
 if(c.provider==='GOOGLE_SHEETS'&&c.connected){const spreadsheets=el('select'),sheets=el('select');spreadsheets.append(el('option','اختر ملفًا'));sheets.append(el('option','اختر ورقة'));configForm.append(button('جلب ملفات Google',async()=>{const r=await api('/connectors/'+c.id+'/resources');spreadsheets.replaceChildren(el('option','اختر ملفًا'));for(const file of r.files||[]){const o=el('option',file.name);o.value=file.id;spreadsheets.append(o)}notify(r.nextPageToken?'عُرض أول 100 ملف؛ يمكن لصق معرف أي ملف آخر':'تم جلب الملفات')}),spreadsheets,button('جلب الأوراق',async()=>{const id=spreadsheet.value||spreadsheets.value;if(!id)throw new Error('اختر الملف أولًا');spreadsheet.value=id;const r=await api('/connectors/'+c.id+'/resources?spreadsheetId='+encodeURIComponent(id));sheets.replaceChildren(el('option','اختر ورقة'));for(const item of r.sheets||[]){const o=el('option',item.properties.title);o.value=item.properties.title;sheets.append(o)}}),sheets);spreadsheets.onchange=()=>{spreadsheet.value=spreadsheets.value};sheets.onchange=()=>{sheet.value=sheets.value};}
 field(configForm,'أعمدة Google بعد معرف العميل — مفاتيح مفصولة بفاصلة','fields','text',(c.config.fields||['name','email','phone']).join(','));field(configForm,'ربط الحقول المحلية بخصائص النظام الخارجي — JSON','mapping','textarea',JSON.stringify(c.config.mapping||{},null,2));
 configForm.append(button('حفظ إعدادات الموصل',async()=>{const d=Object.fromEntries(new FormData(configForm));await api('/connectors',{method:'POST',body:{...c,config:{...c.config,spreadsheetId:d.spreadsheetId||undefined,sheet:d.sheet||undefined,fields:d.fields.split(',').map(x=>x.trim()).filter(Boolean),mapping:json(d.mapping)}}});await connectorPage()},'primary'));pane.append(configForm);
 }
 if(c.connected&&c.enabled){const sync=makeForm();select(sync,'العميل','contactId',(await api('/contacts')).filter(x=>!x.do_not_contact).map(x=>[x.id,x.full_name]));field(sync,'الحقول المخصصة — JSON، email مطلوب للموصلات التجارية','fields','textarea','{}');sync.append(button('مزامنة العميل عبر الطابور',async()=>{if(!sync.reportValidity())return;const d=Object.fromEntries(new FormData(sync));await api('/connectors/'+c.id+'/sync',{method:'POST',body:{contactId:d.contactId,fields:json(d.fields),requestId:crypto.randomUUID()}});notify('تمت الجدولة؛ راجع نتيجة الوظيفة في السجلات')},'primary'));pane.append(sync)}host.append(pane);
 }
 const jobs=await api('/connectors/jobs');const block=el('section');block.append(el('h3','نتائج المزامنة'));for(const j of jobs)block.append(card(j.id,j.status+' • محاولات '+j.attempts+' • '+(j.last_error||'')));host.append(block);
 }
 async function channelPage(){const host=$('social-accounts');host.replaceChildren();const rows=await api('/channels/accounts');if(!rows.length)emptyState(host,'لا توجد قنوات مرتبطة','الربط يحتاج بيانات وصلاحيات حساب الشركة.');for(const r of rows){const c=card(r.channel,r.external_id+' • '+(r.enabled?'مفعل في الإعدادات — اختبر الاستقبال والتسليم':'معطل'));if(state.role==='OWNER'&&r.enabled)c.append(button('تعطيل الحساب',async()=>{await api('/channels/accounts/'+r.id,{method:'DELETE'});await channelPage()},'danger'));host.append(c)}$('social-form').hidden=state.role!=='OWNER';}
 bind('social-form',async(d,f)=>{await api('/channels/accounts',{method:'POST',body:d});f.reset();await channelPage();notify('تم التحقق من اعتماد الحساب وحفظ الإعدادات؛ لم يُثبت اختبار محادثة حقيقية')});
 async function commentPage(){
  const rulesHost=$('comment-rule-editor'),candidatesHost=$('comment-candidates');rulesHost.replaceChildren();candidatesHost.replaceChildren();
  rulesHost.append(el('h3','قواعد استقبال التعليقات'));
  const [accounts,rules,candidates]=await Promise.all([api('/channels/accounts'),api('/comments/rules'),api('/comments/candidates')]);
  const meta=accounts.filter(a=>['MESSENGER','INSTAGRAM'].includes(a.channel));
  if(!meta.length){emptyState(rulesHost,'لا يوجد حساب مؤهل للتعليقات','اربط صفحة Facebook أو Instagram أولًا، ثم ارجع لإنشاء القاعدة.');
     rulesHost.append(button('الانتقال إلى إعداد القنوات',()=>(document.querySelector('.vessel-drawer [data-page="channels"]')||document.querySelector('.sidebar [data-page="channels"]'))?.click(),'secondary'));
   }
  else{
   const form=makeForm();
   const account=select(form,'حساب Meta','accountId',meta.map(a=>[a.id,a.channel+' — '+a.external_id]));
   field(form,'اسم القاعدة','name','text','',true);field(form,'الكلمة المفتاحية','keyword','text','',true);
   field(form,'نص الرسالة الخاصة المقترحة','replyText','textarea','',true);
   const mode=select(form,'طريقة التنفيذ','mode',[['REVIEW','مراجعة موظف قبل الإرسال'],['AUTO','تجهيز تلقائي بعد المطابقة']]);
   const enabled=select(form,'تنشيط مطابقة التعليقات','enabled',[['false','متوقفة'],['true','مفعّلة لاستقبال الأحداث الموثقة']]);
   form.append(button('حفظ قاعدة التعليقات',async()=>{
    if(!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form));
    await api('/comments/rules',{method:'POST',body:{...data,enabled:data.enabled==='true'}});
    form.reset();await commentPage();notify('تم حفظ القاعدة. لا توجد أي رسائل خرجت من المنصة.');
   },'primary'));rulesHost.append(form);
  }
  for(const rule of rules){
   const box=card(rule.name,rule.channel+' • الكلمة: '+rule.keyword+' • '+rule.mode+' • '+(rule.enabled?'مطابقة مفعّلة':'مطابقة متوقفة'));
   box.append(el('p',rule.replyText));
   box.append(button(rule.enabled?'إيقاف المطابقة':'تفعيل المطابقة',async()=>{
    await api('/comments/rules',{method:'POST',body:{id:rule.id,accountId:rule.accountId,name:rule.name,keyword:rule.keyword,replyText:rule.replyText,mode:rule.mode,enabled:!rule.enabled}});
    await commentPage();
   },'secondary'));rulesHost.append(box);
  }
  candidatesHost.append(el('h3','قائمة الرسائل المرشحة'));
  if(!candidates.length)emptyState(candidatesHost,'لا توجد تعليقات للمراجعة','تظهر هنا النتائج عند مطابقة القواعد.');
  for(const candidate of candidates){
   const box=card(candidate.ruleName,candidate.channel+' • '+candidate.status+' • تعليق '+candidate.commentId);
   box.append(el('p',candidate.replyText));
   if(candidate.status==='REVIEW')box.append(button('اعتماد المسودة',async()=>{
    await api('/comments/candidates/'+candidate.id+'/decision',{method:'POST',body:{approve:true}});
    await commentPage();notify('تم اعتماد المسودة داخل الطابور؛ الإرسال الخارجي مقفول افتراضيًا');
   }),button('تخطي',async()=>{
    await api('/comments/candidates/'+candidate.id+'/decision',{method:'POST',body:{approve:false}});
    await commentPage();
   },'secondary'));
   candidatesHost.append(box);
  }
 }
  async function privacyPage(){const host=$('privacy-tools');host.replaceChildren();if(state.role!=='OWNER'){host.append(el('p','إدارة الخصوصية متاحة لمالك الشركة فقط'));return}const p=await api('/privacy/settings'),form=makeForm();const days=field(form,'مدة الاحتفاظ 30–3650 يومًا','days','number',p.retention_days,true);days.min='30';days.max='3650';const enabled=select(form,'إخفاء العملاء القدامى تلقائيًا — المحادثات المغلقة فقط','enabled',[['false','متوقف'],['true','مفعل']]);enabled.value=String(p.cleanup_enabled);form.append(button('حفظ سياسة الاحتفاظ',async()=>{if(!form.reportValidity())return;await api('/privacy/settings',{method:'PUT',body:{retentionDays:Number(days.value),cleanupEnabled:enabled.value==='true'}});await privacyPage()},'primary'));host.append(form);
 host.append(button('معاينة العملاء المستحقين للتنظيف',async()=>{const ids=await api('/privacy/candidates');notify('مرشحون حاليًا (حتى 20): '+(ids.map(x=>x.id).join('، ')||'لا يوجد'))}));
 const contacts=await api('/contacts');const tools=makeForm(),contact=select(tools,'العميل','contactId',contacts.map(c=>[c.id,c.full_name]));tools.append(button('تصدير بيانات العميل',async()=>{if(!contact.value)return;const data=await api('/privacy/contacts/'+contact.value+'/export'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download='contact-'+contact.value+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}),button('إخفاء بيانات العميل نهائيًا',async()=>{if(!contact.value)return;const confirmation=prompt('إجراء دائم: اكتب معرف العميل لتأكيد إخفاء بياناته ومحادثاته: '+contact.value);if(confirmation!==contact.value)return;await api('/privacy/contacts/'+contact.value+'/anonymize',{method:'POST',body:{confirm:confirmation}});await privacyPage();notify('تم إخفاء البيانات وتسجيل الإجراء؛ حذف النسخ لدى الأنظمة الخارجية مسؤوليتها')},'danger'));host.append(tools,el('p','الملفات الجديدة تظل خاصة حتى فحص ClamAV. التنظيف لا يحذف بيانات تاريخية للحجوزات؛ هذه تحتاج سياسة ترحيل مستقلة. النسخ الاحتياطية والأنظمة الخارجية لها دورة حذف منفصلة.'));
 }
 return {load:page=>({connectors:connectorPage,channels:channelPage,privacy:privacyPage,'comment-automation':commentPage}[page])(),reset(){connectors=[];for(const id of ['native-connectors','social-accounts','privacy-tools','comment-rule-editor','comment-candidates'])$(id).replaceChildren();$('social-form').reset()}};
}
