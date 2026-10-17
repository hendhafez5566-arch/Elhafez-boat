import {initFlowBuilder} from '/flow-builder.js';
import { initOperations } from '/operations.js';
/** Elhafez Boat dashboard. Demo mode is browser-only and never calls the backend. */
const $ = id => document.getElementById(id);
const el = (tag, text, className) => {const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(className)node.className=className;return node};
const attach=(parent,...children)=>{children.forEach(c=>parent.append(c));return parent};
const cell=(tr,content)=>{const td=el('td');td.append(content instanceof Node?content:document.createTextNode(content===undefined?'—':String(content)));tr.append(td);return td};
const empty=(tbody,cols,message)=>{const tr=el('tr');const td=cell(tr,message);td.colSpan=cols;td.className='empty';tbody.append(tr)};
const categories={UMRAH:'عمرة',HAJJ:'حج',DOMESTIC:'سياحة داخلية',INTERNATIONAL:'سياحة خارجية'};
const statusLabels={DRAFT:'مسودة',PUBLISHED:'منشور',ARCHIVED:'مؤرشف',PENDING_REVIEW:'قيد المراجعة',CONFIRMED:'مؤكد',REJECTED:'مرفوض',CANCELLED:'ملغي',NEW:'جديد',QUALIFIED:'مهتم',CUSTOMER:'عميل',OPEN:'مفتوح',HUMAN:'موظف',DONE:'مكتمل'};
const state={token:'',role:'',demo:false,tenant:'',programs:[],bookings:[],leads:[],catalog:[],contacts:[],offers:[],followups:[],conversations:[],summary:{},notes:{},messages:{},page:'overview',filter:'ALL',bookingFilter:'ALL',selectedCustomer:null,selectedThread:null,botConfig:null,team:[],sim:{screen:'home',category:null,page:0,program:null}};
function safeId(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-')}
function show(id,visible){$(id).hidden=!visible}
function notify(message,type='success'){const box=$('notice');box.textContent=message;box.className='notice '+type;box.hidden=!message;if(message)box.scrollIntoView({block:'nearest',behavior:'smooth'})}
function money(value,currency='EGP'){const num=Number(value);return Number.isFinite(num)?(num/100).toLocaleString('ar-EG',{minimumFractionDigits:0,maximumFractionDigits:2})+' '+currency:'—'}
const roleLabels={OWNER:'مالك الشركة',MANAGER:'مدير',AGENT:'موظف مبيعات',VIEWER:'مشاهد'};
const canEdit=()=>state.role==='OWNER'||state.role==='MANAGER';
const canWrite=()=>canEdit()||state.role==='AGENT';
const pillar=(status)=>el('span',statusLabels[status]||status,'pill '+(status==='PUBLISHED'||status==='CONFIRMED'||status==='DONE'||status==='CUSTOMER'?'ok':status==='DRAFT'||status==='PENDING_REVIEW'||status==='QUALIFIED'||status==='OPEN'?'wait':status==='REJECTED'||status==='CANCELLED'?'bad':'neutral'));
const initials=name=>String(name||'EH').split(' ').filter(Boolean).slice(0,2).map(w=>w.charAt(0)).join('');
const humanDate=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ar-EG',{day:'numeric',month:'short',year:'numeric'})};
const humanTime=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleTimeString('ar-EG',{hour:'numeric',minute:'2-digit'})};
async function api(path,{method='GET',body}={}){
 if(state.demo)return demoApi(path,method,body);
 const response=await fetch('/api/v1'+path,{method,headers:{...(state.token?{Authorization:'Bearer '+state.token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await response.json().catch(()=>({error:'تعذر الاتصال بالخادم'}));
 if(!response.ok)throw new Error(data.error||'تعذر إتمام العملية');
 return data;
}
const sumFromData=()=>({published_programs:state.programs.filter(x=>x.status==='PUBLISHED').length,draft_programs:state.programs.filter(x=>x.status==='DRAFT').length,pending_bookings:state.bookings.filter(x=>x.status==='PENDING_REVIEW').length,confirmed_bookings:state.bookings.filter(x=>x.status==='CONFIRMED').length,contacts:state.contacts.length,open_tasks:state.followups.filter(x=>x.status==='OPEN').length,active_offers:state.offers.filter(x=>x.status==='PUBLISHED').length,open_conversations:state.conversations.filter(x=>x.status!=='CLOSED').length});
function seedDemo(){
 const programs=[['عمرة رمضان المميزة','UMRAH',6800000,'EGP',60,12,'PUBLISHED'],['عمرة نوفمبر الاقتصادية','UMRAH',4500000,'EGP',90,26,'PUBLISHED'],['برنامج حج 1448','HAJJ',39500000,'EGP',40,7,'PUBLISHED'],['شرم الشيخ 5 ليالي','DOMESTIC',1200000,'EGP',45,13,'PUBLISHED'],['رحلة إسطنبول 7 أيام','INTERNATIONAL',2850000,'EGP',32,8,'PUBLISHED'],['عمرة شعبان','UMRAH',5200000,'EGP',70,0,'DRAFT'],['الغردقة نهاية الأسبوع','DOMESTIC',850000,'EGP',28,0,'DRAFT']];
 state.programs=programs.map((p,i)=>({id:safeId(),title:p[0],category:p[1],priceMinor:String(p[2]),currency:p[3],available_seats:p[4],booked_seats:p[5],status:p[6],duration_days:i===0?10:i===1?8:7,hotel_name:i===0?'فندق 5 نجوم قريب من الحرم':i===1?'فندق 4 نجوم':null,summary:i===0?'الإقامة والنقل الداخلي والإشراف طوال رحلة العمرة.':'',departure_at:new Date(Date.now()+(i+40)*86400000).toISOString(),created_at:new Date(Date.now()-i*86400000).toISOString()}));
 state.catalog=[
   {id:safeId(),kind:'PRODUCT',title:'منتج تجريبي',categoryLabel:'محل',description:'وصف المنتج الذي أضافه صاحب المحل.',priceText:'ابتداءً من 250 جنيه',status:'PUBLISHED'},
   {id:safeId(),kind:'SERVICE',title:'استشارة تجريبية',categoryLabel:'خدمات',description:'بيانات خدمة مناسبة لأي نشاط.',priceText:'حسب التفاصيل',status:'PUBLISHED'},
   {id:safeId(),kind:'OFFER',title:'عرض تجريبي',categoryLabel:'عروض',description:'مثال لمحتوى يُعتمد قبل النشر.',priceText:'',status:'DRAFT'}
 ];
 const names=[['أحمد محمد','201001234567','QUALIFIED'],['منى علي','201112233445','NEW'],['خالد إبراهيم','201055566677','CUSTOMER'],['سارة محمود','201223344556','QUALIFIED'],['محمد السيد','201098765432','NEW'],['فاطمة علي','201154443322','CUSTOMER']];
 state.contacts=names.map((c,i)=>({id:safeId(),full_name:c[0],phone:c[1],email:'',source:i%3?'MANUAL':'BOOKING',status:c[2],created_at:new Date(Date.now()-i*86400000).toISOString()}));
 state.bookings=[]; // User-approved: bot collects interest, never creates reservations.
 state.leads=[
   {id:safeId(),customer_name:'أحمد محمد',phone:'201000000001',program_title:state.programs[0].title,
    party_size:2,travel_preference:'رمضان',stage:'READY_FOR_AGENT',updated_at:new Date().toISOString()},
   {id:safeId(),customer_name:'منى علي',phone:'201000000002',program_title:state.programs[1].title,
    party_size:null,travel_preference:null,stage:'INTERESTED',updated_at:new Date().toISOString()},
   {id:safeId(),customer_name:'سارة محمود',phone:'201000000003',program_title:state.programs[3].title,
    party_size:4,travel_preference:'الأسبوع القادم',stage:'CONTACTED',updated_at:new Date().toISOString()}
 ];
 state.offers=[{id:safeId(),title:'عرض العمرة الشتوي',program_id:state.programs[0].id,program_title:state.programs[0].title,details:'خدمة استقبال ومتابعة طوال الرحلة',starts_at:new Date(Date.now()-86400000).toISOString(),ends_at:new Date(Date.now()+15*86400000).toISOString(),status:'PUBLISHED'},{id:safeId(),title:'مميزات حجز مبكر',program_id:state.programs[4].id,program_title:state.programs[4].title,details:'عرض تجريبي لفترة محدودة',starts_at:new Date(Date.now()).toISOString(),ends_at:new Date(Date.now()+30*86400000).toISOString(),status:'DRAFT'}];
 state.followups=state.contacts.slice(0,4).map((c,i)=>({id:safeId(),contact_id:c.id,customer_name:c.full_name,title:['الاتصال لتأكيد اهتمام العميل','إرسال تفاصيل البرنامج','مراجعة عدد المسافرين','تأكيد موعد الزيارة'][i],due_at:new Date(Date.now()+(i-1)*86400000).toISOString(),status:i===3?'DONE':'OPEN'}));
 state.conversations=state.contacts.slice(0,4).map((c,i)=>({id:safeId(),contact_id:c.id,full_name:c.full_name,phone:c.phone,status:'HUMAN',channel:'INTERNAL',last_message_at:new Date(Date.now()-i*3600000).toISOString()}));
 for(const c of state.contacts)state.notes[c.id]=[];
 for(const c of state.conversations)state.messages[c.id]=[{id:safeId(),body:'تم التواصل مع العميل بشأن البرامج المتاحة. (نص تجريبي)',kind:'INTERNAL_NOTE',author:'موظف تجريبي',created_at:new Date().toISOString()}];
 state.summary=sumFromData();
 state.botConfig={companyName:'شركة الرحلات السياحية',draft:{displayName:'شركة الرحلات السياحية',welcomeText:'أهلًا وسهلًا بيك 👋\nإحنا في خدمتك لمساعدتك تختار رحلتك المناسبة.\nاختار القسم من القائمة:',enabledCategories:['UMRAH','HAJJ','DOMESTIC','INTERNATIONAL'],draftRevision:1},published:null,versions:[]};
 state.team=[{id:safeId(),email:'owner@demo.example',role:'OWNER',createdAt:new Date().toISOString()},{id:safeId(),email:'sales@demo.example',role:'AGENT',createdAt:new Date().toISOString()}];
}
function demoApi(path,method,body){
 const list={'/programs':state.programs,'/bookings':state.bookings,'/contacts':state.contacts,'/offers':state.offers,'/followups':state.followups,'/conversations':state.conversations};
 if(method==='GET'&&path==='/bot/config')return Promise.resolve(state.botConfig);
 if(method==='GET'&&path==='/bot/versions')return Promise.resolve([...(state.botConfig?.versions||[])]);
 if(method==='GET'&&path==='/team')return Promise.resolve([...state.team]);
 if(method==='PUT'&&path==='/bot/draft'){const d=body;if(!d||!d.displayName||!d.welcomeText||!Array.isArray(d.enabledCategories)||!d.enabledCategories.length)throw Error('أكمل بيانات إعدادات البوت');state.botConfig.draft={...d,draftRevision:(state.botConfig.draft.draftRevision||0)+1};return Promise.resolve({saved:true,draftRevision:state.botConfig.draft.draftRevision})}
 if(method==='POST'&&path==='/bot/publish'){const next=(state.botConfig.published?.version||0)+1;const published={version:next,publishedAt:new Date().toISOString(),config:{displayName:state.botConfig.draft.displayName,welcomeText:state.botConfig.draft.welcomeText,enabledCategories:[...state.botConfig.draft.enabledCategories]}};state.botConfig.published=published;state.botConfig.versions.unshift(published);return Promise.resolve(published)}
 if(method==='GET'&&path==='/catalog')return Promise.resolve([...state.catalog]);
 if(method==='POST'&&path==='/catalog'){
   const item={id:safeId(),...body,status:'DRAFT',updatedAt:new Date().toISOString()};
   state.catalog.unshift(item);return Promise.resolve(item);
 }
 let catMatch=/^\/catalog\/([^/]+)\/(publish|archive)$/.exec(path);
 if(method==='POST'&&catMatch){
   const item=state.catalog.find(x=>x.id===catMatch[1]);if(!item)throw new Error('العنصر مش موجود');
   item.status=catMatch[2]==='publish'?'PUBLISHED':'ARCHIVED';return Promise.resolve(item);
 }
 if(method==='GET'&&path==='/leads')return Promise.resolve([...state.leads]);
 if(method==='GET'&&path==='/leads/summary')return Promise.resolve({
   total:state.leads.length,interested:state.leads.filter(x=>x.stage==='INTERESTED').length,
   ready:state.leads.filter(x=>x.stage==='READY_FOR_AGENT').length,
   contacted:state.leads.filter(x=>x.stage==='CONTACTED').length,
   closed:state.leads.filter(x=>x.stage==='CLOSED').length
 });
 const leadChange=/^\/leads\/([^/]+)\/stage$/.exec(path);
 if(method==='PATCH'&&leadChange){
   const lead=state.leads.find(x=>x.id===leadChange[1]);
   if(!lead)throw new Error('العميل المهتم غير موجود');
   if(!['CONTACTED','CLOSED','READY_FOR_AGENT'].includes(body.stage))throw new Error('المرحلة غير صحيحة');
   lead.stage=body.stage;lead.updated_at=new Date().toISOString();return Promise.resolve(lead);
 }
 if(method==='GET'&&path==='/summary')return Promise.resolve(sumFromData());
 if(method==='GET'&&path in list)return Promise.resolve([...list[path]]);
 let r;
 if(method==='POST'&&path==='/programs'){r={id:safeId(),...body,priceMinor:String(body.priceMinor),status:'DRAFT',booked_seats:0,available_seats:body.availableSeats,created_at:new Date().toISOString()};state.programs.unshift(r)}
 else if(method==='PATCH'&&(r=/^\/programs\/([^/]+)\/publish$/.exec(path))){const p=state.programs.find(x=>x.id===r[1]);if(!p)throw Error('البرنامج غير موجود');if(Number(p.available_seats)<=Number(p.booked_seats))throw Error('المقاعد غير كافية');p.status='PUBLISHED'}
 else if(method==='POST'&&path==='/bookings'){const p=state.programs.find(x=>x.id===body.programId);if(!p||p.status!=='PUBLISHED')throw Error('البرنامج غير متاح');if(body.partySize>p.available_seats-p.booked_seats)throw Error('المقاعد غير كافية');r={id:safeId(),program_id:p.id,customer_name:body.customerName,customer_phone:body.customerPhone,party_size:body.partySize,priceMinorSnapshot:p.priceMinor,currency_snapshot:p.currency,status:'PENDING_REVIEW',created_at:new Date().toISOString()};state.bookings.unshift(r)}
 else if(method==='PATCH'&&(r=/^\/bookings\/([^/]+)\/confirm$/.exec(path))){const b=state.bookings.find(x=>x.id===r[1]);if(!b)throw Error('الطلب غير موجود');if(b.status==='CONFIRMED')return Promise.resolve(b);const p=state.programs.find(x=>x.id===b.program_id);if(!p||p.available_seats-p.booked_seats<b.party_size)throw Error('المقاعد غير كافية');p.booked_seats+=b.party_size;b.status='CONFIRMED'}
 else if(method==='PATCH'&&(r=/^\/bookings\/([^/]+)\/cancel$/.exec(path))){const b=state.bookings.find(x=>x.id===r[1]);if(!b)throw Error('الحجز غير موجود');if(b.status==='CONFIRMED'){const p=state.programs.find(x=>x.id===b.program_id);if(p)p.booked_seats=Math.max(0,p.booked_seats-b.party_size)}b.status='CANCELLED'}
 else if(method==='POST'&&path==='/contacts'){if(state.contacts.some(c=>c.phone===body.phone))throw Error('رقم الهاتف مسجل بالفعل');r={id:safeId(),full_name:body.fullName,phone:body.phone,email:body.email||null,source:'MANUAL',status:'NEW',created_at:new Date().toISOString()};state.contacts.unshift(r)}
 else if(method==='PATCH'&&(r=/^\/contacts\/([^/]+)\/status$/.exec(path))){const c=state.contacts.find(x=>x.id===r[1]);if(!c)throw Error('العميل غير موجود');c.status=body.status}
 else if(method==='GET'&&(r=/^\/contacts\/([^/]+)\/notes$/.exec(path)))return Promise.resolve([...(state.notes[r[1]]||[])]);
 else if(method==='POST'&&(r=/^\/contacts\/([^/]+)\/notes$/.exec(path))){const note={id:safeId(),body:body.body,author:'حساب تجريبي',created_at:new Date().toISOString()};(state.notes[r[1]]??=[]).unshift(note)}
 else if(method==='POST'&&path==='/offers'){const p=state.programs.find(x=>x.id===body.programId);if(!p)throw Error('البرنامج غير موجود');r={id:safeId(),program_id:p.id,program_title:p.title,title:body.title,details:body.details,starts_at:body.startsAt,ends_at:body.endsAt,status:'DRAFT'};state.offers.unshift(r)}
 else if(method==='PATCH'&&(r=/^\/offers\/([^/]+)\/publish$/.exec(path))){const o=state.offers.find(x=>x.id===r[1]);const p=state.programs.find(x=>x.id===o?.program_id);if(!o||!p||p.status!=='PUBLISHED')throw Error('يجب نشر البرنامج أولًا');o.status='PUBLISHED'}
 else if(method==='POST'&&path==='/followups'){const c=state.contacts.find(x=>x.id===body.contactId);if(!c)throw Error('العميل غير موجود');state.followups.unshift({id:safeId(),contact_id:c.id,customer_name:c.full_name,title:body.title,due_at:body.dueAt,status:'OPEN'})}
 else if(method==='PATCH'&&(r=/^\/followups\/([^/]+)\/complete$/.exec(path))){const t=state.followups.find(x=>x.id===r[1]);if(!t)throw Error('المهمة غير موجودة');t.status='DONE'}
 else if(method==='POST'&&path==='/conversations'){const c=state.contacts.find(x=>x.id===body.contactId);if(!c)throw Error('العميل غير موجود');r={id:safeId(),contact_id:c.id,full_name:c.full_name,phone:c.phone,status:'HUMAN',channel:'INTERNAL',last_message_at:new Date().toISOString()};state.conversations.unshift(r);state.messages[r.id]=[]}
 else if(method==='GET'&&(r=/^\/conversations\/([^/]+)\/messages$/.exec(path)))return Promise.resolve([...(state.messages[r[1]]||[])]);
 else if(method==='POST'&&(r=/^\/conversations\/([^/]+)\/messages$/.exec(path))){const note={id:safeId(),kind:'INTERNAL_NOTE',body:body.body,author:'حساب تجريبي',created_at:new Date().toISOString()};(state.messages[r[1]]??=[]).push(note)}
 else throw Error('الإجراء غير متاح في وضع المعاينة');
 return Promise.resolve(r||{ok:true});
}
function getSummary(){return state.demo?sumFromData():state.summary}
function countText(id,value){$(id).textContent=String(value??0)}
function tinyBar(title,value,max){const root=el('div',undefined,'bar-line');const track=el('div',undefined,'bar-track');const fill=el('div',undefined,'bar-fill');fill.style.width=(max>0?Math.max(0,Math.min(100,value/max*100)):0)+'%';track.append(fill);return attach(root,el('span',title),track,el('b',value))}
function renderOverview(){const s=getSummary();countText('metric-active',s.published_programs);countText('metric-pending',s.pending_bookings);countText('metric-confirmed',s.confirmed_bookings);countText('metric-customers',s.contacts);countText('action-bookings',s.pending_bookings);countText('action-tasks',s.open_tasks);countText('action-drafts',s.draft_programs);countText('nav-pending',s.pending_bookings);$('nav-pending').hidden=!s.pending_bookings;
 const grouped=Object.entries(categories).map(([key,title])=>[title,state.programs.filter(p=>p.category===key&&p.status==='PUBLISHED').length]);const max=Math.max(...grouped.map(x=>x[1]),1);$('category-bars').replaceChildren(...grouped.map(([label,n])=>tinyBar(label,n,max)));
 const tbody=$('recent-bookings-body');tbody.replaceChildren();if(!state.bookings.length)empty(tbody,4,'لا توجد طلبات حجز حتى الآن');state.bookings.slice(0,5).forEach(b=>{const row=el('tr');cell(row,b.customer_name);cell(row,state.programs.find(p=>p.id===b.program_id)?.title||'برنامج غير موجود');cell(row,b.party_size);cell(row,pillar(b.status));tbody.append(row)});
}
function renderPrograms(){const tbody=$('programs-body'), term=$('program-search').value.trim().toLocaleLowerCase('ar');tbody.replaceChildren();const rows=state.programs.filter(p=>(state.filter==='ALL'||p.category===state.filter)&&(!term||p.title.toLocaleLowerCase('ar').includes(term)));countText('program-count',rows.length+' برنامج');if(!rows.length)empty(tbody,6,'لا توجد برامج مطابقة');for(const p of rows){const row=el('tr');const name=attach(el('div',undefined,'name-cell'),el('span',initials(p.title),'name-avatar'),attach(el('div'),el('strong',p.title),el('small',p.id.slice(0,8).toUpperCase())));cell(row,name);cell(row,categories[p.category]);cell(row,money(p.priceMinor,p.currency));const remaining=Number(p.available_seats)-Number(p.booked_seats||0);cell(row,p.summary?.slice(0,70)||p.hotel_name||'برنامج للتعريف بالخدمة');cell(row,pillar(p.status));const action=cell(row,'');if(p.status==='DRAFT'&&canEdit()){const b=el('button','نشر البرنامج','small-btn');b.onclick=()=>execute(async()=>{await api('/programs/'+p.id+'/publish',{method:'PATCH'});await refresh();notify('تم نشر البرنامج');});action.append(b)}else action.textContent='—';tbody.append(row)}
 const select=$('booking-programs');select.replaceChildren();const offerSelect=$('offer-programs');offerSelect.replaceChildren();const available=state.programs.filter(p=>p.status==='PUBLISHED');for(const p of available){const option=el('option',p.title);option.value=p.id;select.append(option)}for(const p of state.programs.filter(p=>p.status!=='ARCHIVED')){const option=el('option',p.title);option.value=p.id;offerSelect.append(option)}$('booking-form').querySelector('[type=submit]').disabled=!available.length;$('offer-form').querySelector('[type=submit]').disabled=!offerSelect.options.length;$('toggle-program-form').disabled=!canEdit();$('toggle-booking-form').disabled=!canWrite();$('toggle-offer-form').disabled=!canEdit();
}
function renderBookings(){const tbody=$('bookings-body');tbody.replaceChildren();const list=state.bookings.filter(b=>state.bookingFilter==='ALL'||b.status===state.bookingFilter);if(!list.length)empty(tbody,7,'لا توجد طلبات في هذا التصنيف');for(const b of list){const tr=el('tr');const name=attach(el('div',undefined,'name-cell'),el('span',initials(b.customer_name),'name-avatar'),attach(el('div'),el('strong',b.customer_name),el('small',b.customer_phone||'')));cell(tr,name);cell(tr,state.programs.find(p=>p.id===b.program_id)?.title||'—');
const itinerary=attach(el('div',undefined,'name-cell'),attach(el('div'),
  el('strong',b.depart_at?new Date(b.depart_at).toLocaleDateString('ar-EG'):'موعد غير محدد'),
  el('small',b.hotel_name?(b.hotel_name+' • '+(b.room_type||'')+' • '+(b.room_units||1)+' غرفة'):'بدون اختيار غرفة')));
cell(tr,itinerary);
cell(tr,b.party_size);cell(tr,money(b.priceMinorSnapshot,b.currency_snapshot));cell(tr,pillar(b.status));const action=cell(tr,'—');if(b.status==='PENDING_REVIEW'&&canEdit()){const button=el('button','تأكيد الحجز','small-btn');button.onclick=()=>execute(async()=>{if(!confirm('هل تمت مراجعة التوافر وتريد تأكيد الحجز؟'))return;await api('/bookings/'+b.id+'/confirm',{method:'PATCH'});await refresh();notify('تم تأكيد الحجز بعد خصم المقاعد المتاحة')});action.replaceChildren(button)}
if(canEdit()&&['CONFIRMED','PENDING_REVIEW'].includes(b.status)){
 const cancel=el('button','إلغاء الحجز','small-btn');
 cancel.style.marginInlineStart='8px';
 cancel.onclick=()=>execute(async()=>{
   if(!confirm('إلغاء الحجز؟ لو كان مؤكد سيتم إرجاع السعة المحجوزة للبرنامج والموعد والغرف.'))return;
   await api('/bookings/'+b.id+'/cancel',{method:'PATCH'});
   await refresh();notify('تم إلغاء الحجز وإرجاع السعة عند اللزوم');
 });
 if(action.textContent==='—')action.replaceChildren();action.append(cancel);
}
$('bookings-body').append(tr)}}
function renderOffers(){const box=$('offers-grid');box.replaceChildren();if(!state.offers.length)box.append(el('div','لم تضف عروض حتى الآن','panel empty-state'));for(const o of state.offers){const card=el('div',undefined,'offer-card');const top=attach(el('div',undefined,'offer-card-top'),el('span','◇','metric-icon blue'),pillar(o.status));card.append(top,el('h3',o.title),el('p',o.details||'لا يوجد وصف مضاف'));const meta=el('div',undefined,'offer-card-meta');meta.append(attach(el('div'),el('strong','البرنامج: '),el('span',o.program_title||state.programs.find(p=>p.id===o.program_id)?.title||'—')),attach(el('div'),el('strong','الفترة: '),el('span',humanDate(o.starts_at)+' — '+humanDate(o.ends_at))));card.append(meta);if(o.status==='DRAFT'&&canEdit()){const btn=el('button','نشر العرض','small-btn');btn.onclick=()=>execute(async()=>{await api('/offers/'+o.id+'/publish',{method:'PATCH'});await refresh();notify('تم نشر العرض')});card.append(btn)}box.append(card)}}
function renderCustomers(){const tbody=$('customers-body'),term=$('customer-search').value.trim().toLowerCase();tbody.replaceChildren();const rows=state.contacts.filter(c=>(c.full_name+' '+c.phone).toLowerCase().includes(term));countText('customers-count',rows.length+' عميل');if(!rows.length)empty(tbody,5,'لا يوجد عملاء مطابقون');for(const c of rows){const tr=el('tr');cell(tr,attach(el('div',undefined,'name-cell'),el('span',initials(c.full_name),'name-avatar'),attach(el('div'),el('strong',c.full_name),el('small',c.email||''))));cell(tr,c.phone);cell(tr,c.source==='BOOKING'?'حجز':'إضافة يدوية');cell(tr,pillar(c.status));const action=cell(tr,'');const btn=el('button','الملف','small-btn');btn.onclick=()=>execute(()=>openCustomer(c.id));action.append(btn);tbody.append(tr)}$('toggle-customer-form').disabled=!canWrite();}
async function openCustomer(id){state.selectedCustomer=id;const c=state.contacts.find(c=>c.id===id);$('selected-customer-name').textContent=c?.full_name||'عميل';$('customer-status-select').value=c?.status||'NEW';$('customer-status-select').disabled=!canWrite();const notes=await api('/contacts/'+id+'/notes');const box=$('customer-notes');box.replaceChildren();if(!notes.length)box.append(el('div','لا توجد ملاحظات مسجلة','empty-state'));for(const note of notes){box.append(attach(el('div',undefined,'note-item'),el('div',note.body),el('small',(note.author||'موظف')+' • '+humanDate(note.created_at))))}show('customer-detail',true);$('customer-detail').scrollIntoView({block:'nearest',behavior:'smooth'});$('customer-note-form').hidden=!canWrite();}
function updateCustomerSelects(){for(const id of ['task-customers','thread-customers']){const select=$(id);select.replaceChildren();for(const c of state.contacts){const option=el('option',c.full_name+' — '+c.phone);option.value=c.id;select.append(option)}}$('toggle-task-form').disabled=!canWrite()||!state.contacts.length;$('toggle-thread-form').disabled=!canWrite()||!state.contacts.length}
function renderFollowups(){const box=$('tasks-list');box.replaceChildren();if(!state.followups.length)box.append(el('div','لا توجد مهام متابعة مسجلة','panel empty-state'));for(const t of state.followups){const item=el('div',undefined,'task-card');const info=attach(el('div',undefined,'task-info'),el('strong',t.title),el('small',t.customer_name||state.contacts.find(c=>c.id===t.contact_id)?.full_name||'عميل'));const meta=attach(el('div',undefined,'task-meta'),pillar(t.status),el('small',humanDate(t.due_at)));item.append(el('span','◷','task-icon'),info,meta);if(t.status==='OPEN'&&canWrite()){const done=el('button','إكمال','small-btn');done.onclick=()=>execute(async()=>{await api('/followups/'+t.id+'/complete',{method:'PATCH'});await refresh();notify('تم إكمال المتابعة')});item.append(done)}box.append(item)}}
function renderInbox(){const list=$('threads-list');list.replaceChildren();countText('thread-count',state.conversations.length+' محادثة داخلية');if(!state.conversations.length)list.append(el('div','لا توجد محادثات بعد','empty-state'));for(const c of state.conversations){const item=el('button',undefined,'thread-item'+(state.selectedThread===c.id?' active':''));item.append(el('span',initials(c.full_name),'avatar'),attach(el('div'),el('strong',c.full_name),el('small','سجل متابعة داخلي • '+humanDate(c.last_message_at))));item.onclick=()=>execute(()=>openThread(c.id));list.append(item)}}
async function openThread(id){state.selectedThread=id;renderInbox();const c=state.conversations.find(c=>c.id===id);$('thread-title').replaceChildren(el('span',initials(c?.full_name),'avatar'),attach(el('div'),el('strong',c?.full_name||'عميل'),el('small','ملاحظات داخلية — ليست رسائل للعميل')));const list=await api('/conversations/'+id+'/messages');const box=$('thread-messages');box.replaceChildren();if(!list.length)box.append(el('div','لا توجد ملاحظات بعد','empty-state'));for(const msg of list){box.append(attach(el('div',undefined,'message-note'),el('div',msg.body),el('small',(msg.author||'موظف')+' • '+humanTime(msg.created_at))))}box.scrollTop=box.scrollHeight;show('thread-message-form',canWrite());}
function renderReports(){const s=getSummary(),items=[['البرامج المنشورة',s.published_programs,'blue'],['العروض النشطة',s.active_offers,'purple'],['مهام مفتوحة',s.open_tasks,'amber'],['محادثات داخلية',s.open_conversations,'green']];const root=$('report-metrics');root.replaceChildren();for(const [label,count,color] of items){root.append(attach(el('div',undefined,'metric'),attach(el('div',undefined,'metric-top'),el('span','▥','metric-icon '+color)),el('small',label),el('strong',count)))}const grouped=[['قيد المراجعة',state.bookings.filter(x=>x.status==='PENDING_REVIEW').length],['مؤكدة',state.bookings.filter(x=>x.status==='CONFIRMED').length],['أخرى',state.bookings.filter(x=>!['PENDING_REVIEW','CONFIRMED'].includes(x.status)).length]];const max=Math.max(...grouped.map(x=>x[1]),1);$('booking-breakdown').replaceChildren(...grouped.map(([name,count])=>tinyBar(name,count,max)));$('report-highlights').replaceChildren(...[['البرامج في المسودة',s.draft_programs],['عدد العملاء',s.contacts],['الطلبات المؤكدة',s.confirmed_bookings],['المحادثات المفتوحة',s.open_conversations]].map(([name,value])=>attach(el('div',undefined,'report-row'),el('span',name),el('b',value))))}
function currentBotConfig(){return state.botConfig?.published?.config||{displayName:state.botConfig?.companyName||'شركة السياحة',welcomeText:'أهلًا وسهلًا بيك 👋\nاختار القسم من القائمة:',enabledCategories:['UMRAH','HAJJ','DOMESTIC','INTERNATIONAL']}}
function renderSim(){const chat=$('sim-messages'),options=$('sim-options');chat.replaceChildren();options.replaceChildren();const bubble=(text,cls)=>chat.append(el('div',text,'bubble'+(cls?' '+cls:'')));const opt=(label,action)=>{const btn=el('button',label);btn.onclick=action;options.append(btn)};const sim=state.sim;const config=currentBotConfig();$('sim-company-name').textContent=config.displayName;
 if(sim.screen==='home'){bubble(config.welcomeText);for(const [key,title] of Object.entries(categories).filter(([key])=>config.enabledCategories.includes(key)))opt(title,()=>{sim.screen='category';sim.category=key;sim.page=0;renderSim()});opt('التحدث مع موظف',()=>{sim.screen='handoff';renderSim()});}
 else if(sim.screen==='category'){const matches=state.programs.filter(p=>p.category===sim.category&&p.status==='PUBLISHED'&&Number(p.available_seats)>Number(p.booked_seats||0));bubble('اختار البرنامج المناسب من '+categories[sim.category]+':');if(!matches.length)bubble('لا توجد برامج منشورة متاحة حاليًا.');matches.slice(sim.page*8,sim.page*8+8).forEach(p=>opt(p.title+' — '+money(p.priceMinor,p.currency),()=>{sim.program=p.id;sim.screen='program';renderSim()}));if(sim.page>0)opt('← الصفحة السابقة',()=>{sim.page--;renderSim()});if((sim.page+1)*8<matches.length)opt('الصفحة التالية ←',()=>{sim.page++;renderSim()});opt('العودة للرئيسية',()=>{sim.screen='home';renderSim()});}
 else if(sim.screen==='program'){const p=state.programs.find(p=>p.id===sim.program);if(!p||p.status!=='PUBLISHED'){sim.screen='home';return renderSim()}bubble('✦ '+p.title+'\nنوع الرحلة: '+categories[p.category]+'\nالسعر للفرد: '+money(p.priceMinor,p.currency)+'\nالتوافر والتفاصيل النهائية يراجعهم الموظف'+'\nموعد السفر: '+humanDate(p.departure_at)+'\nمدة الرحلة: '+(p.duration_days||'غير محددة')+' أيام'+'\nالفندق: '+(p.hotel_name||'يحدد لاحقًا')+(p.summary?'\n'+p.summary:'')+'\n\nدي معلومات استرشادية للعميل، والموظف هو المسؤول عن التنفيذ.');opt('أنا مهتم — تواصل مع موظف',()=>{sim.screen='qualify-party';renderSim()});opt('برامج أخرى',()=>{sim.screen='category';renderSim()});opt('الرئيسية',()=>{sim.screen='home';renderSim()});}
 else if(sim.screen==='qualify-party'){
   bubble('علشان الموظف يساعدك أسرع: كم فرد تقريبًا مهتمين بالرحلة؟');
   for(const [label,num] of [['فرد واحد',1],['فردين',2],['3 أفراد أو أكثر',3],['لسه مش محدد',null]]){
     opt(label,()=>{sim.partySize=num;sim.screen='qualify-travel';renderSim()});
   }
 }
 else if(sim.screen==='qualify-travel'){
   bubble('إمتى حابب تسافر تقريبًا؟ ولو مش محدد، عادي.');
   for(const timing of ['خلال شهر','بعد شهرين','لسه مش محدد']){
     opt(timing,()=>{
       const p=state.programs.find(x=>x.id===sim.program);
       state.leads.unshift({
         id:safeId(),customer_name:'عميل من معاينة البوت',phone:'201000000000',
         program_title:p?.title||'استفسار عام',party_size:sim.partySize,
         travel_preference:timing==='لسه مش محدد'?null:timing,
         stage:'READY_FOR_AGENT',updated_at:new Date().toISOString()
       });
       sim.screen='submitted';renderSim();
     });
   }
 }
 else if(sim.screen==='submitted'){
   bubble('✓ تم تسجيل اهتمام العميل في المعاينة فقط.\nموظف الشركة هيشوف البرنامج وعدد الأفراد وموعد السفر المناسب، وهو اللي يتواصل ويعمل الحجز خارج البوت.');
   opt('عرض العملاء المهتمين',()=>{document.querySelector('[data-page="leads"]')?.click()});
   opt('العودة للرئيسية',()=>{sim.screen='home';renderSim()});
 }
 else{bubble('تم طلب التواصل مع موظف الشركة. في التشغيل الحقيقي بيستلم الموظف المحادثة ويكمل الحجز بنفسه. دي معاينة فقط.');opt('العودة للقائمة الرئيسية',()=>{sim.screen='home';renderSim()})}
}
function renderTeam(){const tbody=$('team-body');tbody.replaceChildren();if(!state.team.length)empty(tbody,3,canEdit()?'لا يوجد أعضاء ظاهرون':'هذه القائمة متاحة للمدير والمالك فقط');for(const member of state.team){const tr=el('tr');cell(tr,attach(el('div',undefined,'name-cell'),el('span',initials(member.email),'name-avatar'),el('strong',member.email.split('@')[0])));cell(tr,member.email);cell(tr,pillar(member.role));tbody.append(tr)}}
function renderBotSettings(){const cfg=state.botConfig;if(!cfg)return;const draft=cfg.draft||{},pub=cfg.published;const form=$('bot-config-form');form.elements.displayName.value=draft.displayName||cfg.companyName||'';form.elements.welcomeText.value=draft.welcomeText||'';form.querySelectorAll('[name=enabledCategories]').forEach(x=>x.checked=(draft.enabledCategories||[]).includes(x.value));$('bot-published-status').textContent=pub?'منشور — نسخة '+pub.version:'لم يتم النشر';$('bot-current-version').replaceChildren(attach(el('div'),el('strong',pub?'الإصدار '+pub.version:'لا توجد نسخة منشورة'),el('small',pub?'تاريخ النشر: '+humanDate(pub.publishedAt):'احفظ مسودة الإعدادات ثم انشرها للمعاينة')));const list=$('bot-version-list');list.replaceChildren();for(const v of (cfg.versions||[]).slice(0,5)){list.append(attach(el('div',undefined,'version-entry'),el('span','الإصدار '+v.version),el('small',humanDate(v.publishedAt))))}if(!list.children.length)list.append(el('div','لا توجد إصدارات سابقة','empty-state'));form.querySelectorAll('input,textarea,button').forEach(input=>input.disabled=!canEdit());$('bot-publish').disabled=!canEdit()}
function renderAll(){renderOverview();renderPrograms();renderBookings();renderOffers();renderCustomers();renderFollowups();renderInbox();renderReports();renderTeam();renderBotSettings();updateCustomerSelects();renderSim()}
async function refresh(){const paths=['programs','contacts','offers','followups','conversations'];state.bookings=[];const all=await Promise.all([...paths.map(p=>api('/'+p)),api('/summary'),api('/bot/config'),...(canEdit()?[api('/team')]:[])]);paths.forEach((p,i)=>state[p]=all[i]);state.summary=all[paths.length];state.botConfig=all[paths.length+1];if(state.botConfig)state.botConfig.versions=await api('/bot/versions');state.team=canEdit()?all[paths.length+2]:[];renderAll()}
function choose(page){state.page=page;document.querySelectorAll('.page').forEach(node=>node.hidden=node.id!==page);document.querySelectorAll('[data-page]').forEach(node=>node.classList.toggle('active',node.dataset.page===page));const names={overview:'لوحة البوت',leads:'العملاء المهتمون',catalog:'المنتجات والخدمات',programs:'البرامج السياحية',inventory:'المواعيد والغرف',offers:'العروض',bookings:'الحجوزات',inbox:'المحادثات',customers:'العملاء',followups:'المتابعات',reports:'التقارير','flow-builder':'مصمم الشات بوت',simulator:'معاينة البوت',team:'الموظفون',settings:'الإعدادات','wa-inbox':'صندوق واتساب','wa-connect':'ربط واتساب',templates:'قوالب واتساب',subscription:'الاشتراك'};$('page-title').textContent=names[page]||'مساحة العمل';$('crumb').textContent='مساحة العمل / '+(names[page]||'');window.scrollTo({top:0,behavior:'instant'});if(['overview','leads','catalog','wa-inbox','wa-connect','team','subscription','settings'].includes(page))void operations.onPage(page);if(page==='flow-builder')void execute(()=>flowBuilder.load());}
function startSession(demo,session){state.demo=demo;state.token=session.token||'';state.role=session.role||'OWNER';state.tenant=session.tenantSlug||'الشركة';$('side-company').textContent=demo?'شركة تجريبية':state.tenant;$('user-role').textContent=roleLabels[state.role]||'موظف';$('sidebar-role').textContent=roleLabels[state.role]||'موظف';$('sidebar-mode').textContent=demo?'بيانات تجريبية':'البيانات الحقيقية';show('demo-badge',demo);show('login',false);show('app',true);choose('overview');}
async function execute(fn){try{await fn()}catch(error){notify(error.message||'حدث خطأ غير متوقع','error')}}
function registerToggle(toggle,panel){$(toggle).onclick=()=>show(panel,$(panel).hidden)}
function formData(form){return Object.fromEntries(new FormData(form))}
function bindForm(id,fn,doneText,panel){$(id).addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;const button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;execute(async()=>{try{await fn(formData(form));form.reset();if(panel)show(panel,false);await refresh();notify(doneText)}finally{button.disabled=false}})})}
$('today-date').textContent=new Date().toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'});
$('demo-login').onclick=async()=>{seedDemo();startSession(true,{role:'OWNER',tenantSlug:'demo-agency'});await refresh();notify('وضع تجريبي: جميع البيانات والإجراءات داخل ذاكرة المتصفح فقط، ولا يتم حفظ شيء بالخادم.','success')};
$('login-form').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;const submit=form.querySelector('[type=submit]');submit.disabled=true;show('login-error',false);execute(async()=>{try{const session=await api('/auth/login',{method:'POST',body:formData(form)});startSession(false,{...session,tenantSlug:form.elements.tenantSlug.value});await refresh();notify('تم تسجيل الدخول. تكامل واتساب غير متصل بعد.');form.reset()}catch(err){state.token='';show('app',false);show('login',true);$('login-error').textContent=err.message;show('login-error',true)}finally{submit.disabled=false}})});
$('logout').onclick=()=>execute(async()=>{if(!state.demo&&state.token)await api('/auth/logout',{method:'POST'}).catch(()=>{});state.token='';state.demo=false;state.programs=[];state.bookings=[];state.contacts=[];state.offers=[];state.followups=[];state.conversations=[];state.notes={};state.messages={};state.selectedThread=null;state.botConfig=null;state.team=[];show('app',false);show('login',true);notify('')});
document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>choose(button.dataset.page));
document.querySelectorAll('[data-goto]').forEach(button=>button.onclick=()=>choose(button.dataset.goto));
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>show(button.dataset.close,false));
registerToggle('toggle-program-form','program-form-panel');registerToggle('toggle-booking-form','booking-form-panel');registerToggle('toggle-offer-form','offer-form-panel');registerToggle('toggle-customer-form','customer-form-panel');registerToggle('toggle-task-form','task-form-panel');registerToggle('toggle-thread-form','thread-form-panel');
$('cancel-program').onclick=()=>show('program-form-panel',false);
$('program-search').oninput=renderPrograms;$('customer-search').oninput=renderCustomers;
for(const [id,field] of [['program-filters','filter'],['booking-filters','bookingFilter']])$(id).querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{state[field]=button.dataset.filter;$(id).querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===button));field==='filter'?renderPrograms():renderBookings()});
bindForm('program-form',d=>api('/programs',{method:'POST',body:{title:d.title,category:d.category,currency:d.currency,priceMinor:Math.round(Number(d.price)*100),availableSeats:Number(d.availableSeats),summary:d.summary,hotelName:d.hotelName,durationDays:d.durationDays?Number(d.durationDays):null,departureAt:d.departureAt?new Date(d.departureAt).toISOString():null}}),'تم حفظ البرنامج كمسودة','program-form-panel');
bindForm('booking-form',d=>api('/bookings',{method:'POST',body:{programId:d.programId,customerName:d.customerName,customerPhone:d.customerPhone,partySize:Number(d.partySize),departureId:d.departureId||null,roomPackageId:d.roomPackageId||null}}),'تم تسجيل طلب مبدئي، في انتظار التأكيد','booking-form-panel');
bindForm('offer-form',d=>{const startsAt=new Date(d.startsAt).toISOString(),endsAt=new Date(d.endsAt).toISOString();return api('/offers',{method:'POST',body:{programId:d.programId,title:d.title,details:d.details,startsAt,endsAt}})},'تم إنشاء العرض كمسودة','offer-form-panel');
bindForm('customer-form',d=>api('/contacts',{method:'POST',body:{fullName:d.fullName,phone:d.phone,email:d.email}}),'تم إضافة العميل','customer-form-panel');
bindForm('task-form',d=>api('/followups',{method:'POST',body:{contactId:d.contactId,title:d.title,dueAt:new Date(d.dueAt).toISOString()}}),'تم تسجيل المتابعة','task-form-panel');
bindForm('thread-form',d=>api('/conversations',{method:'POST',body:{contactId:d.contactId}}),'تم إنشاء محادثة داخلية','thread-form-panel');
bindForm('customer-note-form',d=>api('/contacts/'+state.selectedCustomer+'/notes',{method:'POST',body:{body:d.body}}).then(()=>openCustomer(state.selectedCustomer)),'تمت إضافة الملاحظة');
bindForm('thread-message-form',d=>api('/conversations/'+state.selectedThread+'/messages',{method:'POST',body:{body:d.body}}).then(()=>openThread(state.selectedThread)),'تم حفظ الملاحظة الداخلية');
$('customer-status-select').onchange=()=>execute(async()=>{await api('/contacts/'+state.selectedCustomer+'/status',{method:'PATCH',body:{status:$('customer-status-select').value}});await refresh();await openCustomer(state.selectedCustomer);notify('تم تحديث حالة العميل')});
$('bot-config-form').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;const input={displayName:form.elements.displayName.value,welcomeText:form.elements.welcomeText.value,enabledCategories:[...form.querySelectorAll('[name=enabledCategories]:checked')].map(x=>x.value)};if(!input.enabledCategories.length){notify('اختر قسمًا واحدًا على الأقل','error');return}execute(async()=>{await api('/bot/draft',{method:'PUT',body:input});await refresh();notify('تم حفظ مسودة البوت — انشرها لتفعيل النسخة الجديدة في المعاينة')})};
$('bot-publish').onclick=()=>execute(async()=>{if(!confirm('نشر إعدادات البوت الحالية كإصدار جديد؟'))return;await api('/bot/publish',{method:'POST'});await refresh();notify('تم نشر إصدار قوائم جديد داخل المنصة. ربط واتساب لم يتم بعد.')});
$('sim-restart').onclick=()=>{state.sim={screen:'home',category:null,page:0,program:null};renderSim()};
const operations=initOperations({state,api,notify,execute,canEdit});
const flowBuilder=initFlowBuilder({state,api,notify,execute});
