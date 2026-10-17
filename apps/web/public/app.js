const $=id=>document.getElementById(id);
let token='',role='',programs=[],bookings=[];
const categories={UMRAH:'عمرة',HAJJ:'حج',DOMESTIC:'سياحة داخلية',INTERNATIONAL:'سياحة خارجية'};
const statuses={DRAFT:'مسودة',PUBLISHED:'منشور',ARCHIVED:'مؤرشف',PENDING_REVIEW:'بانتظار المراجعة',CONFIRMED:'مؤكد',REJECTED:'مرفوض',CANCELLED:'ملغي'};
const element=(tag,text,className)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);if(className)x.className=className;return x};
const show=(id,value)=>{$(id).hidden=!value};
const notify=(msg,type='')=>{const n=$('notice');n.textContent=msg;n.className='notice '+type};
async function api(path,{method='GET',body}={}){
 const response=await fetch('/api/v1'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await response.json().catch(()=>({error:'تعذر قراءة استجابة الخادم'}));
 if(!response.ok)throw new Error(data.error||'فشل تنفيذ الطلب');
 return data;
}
function badge(status){return element('span',statuses[status]||status,'pill '+(status==='PUBLISHED'||status==='CONFIRMED'?'ok':status==='DRAFT'||status==='PENDING_REVIEW'?'wait':'bad'))}
function td(row,value){const cell=element('td');if(value instanceof Node)cell.append(value);else cell.textContent=value===undefined?'—':String(value);row.append(cell);return cell}
function money(minor,currency){return (Number(minor)/100).toLocaleString('ar-EG',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+currency}
function canEdit(){return role==='OWNER'||role==='MANAGER'}
function choose(page){
 document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==page);
 document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 const names={overview:'نظرة عامة',programs:'البرامج السياحية',bookings:'طلبات الحجز',simulator:'معاينة قوائم واتساب'};
 $('page-title').textContent=names[page];$('crumb').textContent='لوحة الإدارة / '+names[page];
}
function render(){
 $('metric-active').textContent=programs.filter(p=>p.status==='PUBLISHED').length;
 $('metric-pending').textContent=bookings.filter(b=>b.status==='PENDING_REVIEW').length;
 $('metric-confirmed').textContent=bookings.filter(b=>b.status==='CONFIRMED').length;
 $('toggle-program-form').disabled=!canEdit();
 $('programs-body').replaceChildren();
 if(!programs.length){const tr=element('tr');const cell=td(tr,'لم تُضف برامج حتى الآن');cell.colSpan=6;cell.className='empty';$('programs-body').append(tr)}
 programs.forEach(p=>{const tr=element('tr');td(tr,p.title);td(tr,categories[p.category]||p.category);td(tr,money(p.priceMinor,p.currency));td(tr,Number(p.available_seats)-Number(p.booked_seats||0));td(tr,badge(p.status));const action=td(tr,element('span','—'));if(p.status==='DRAFT'&&canEdit()){const btn=element('button','نشر البرنامج','small-btn');btn.onclick=()=>execute(async()=>{await api('/programs/'+p.id+'/publish',{method:'PATCH'});await refresh();notify('تم نشر البرنامج بنجاح')});action.replaceChildren(btn)}$('programs-body').append(tr)});
 $('bookings-body').replaceChildren();
 if(!bookings.length){const tr=element('tr');const cell=td(tr,'لا توجد طلبات حجز');cell.colSpan=6;cell.className='empty';$('bookings-body').append(tr)}
 bookings.forEach(b=>{const tr=element('tr');td(tr,b.customer_name);td(tr,programs.find(p=>p.id===b.program_id)?.title||'برنامج');td(tr,b.party_size);td(tr,money(b.priceMinorSnapshot,b.currency_snapshot));td(tr,badge(b.status));const cell=td(tr,'—');if(b.status==='PENDING_REVIEW'&&canEdit()){const btn=element('button','تأكيد الحجز','small-btn');btn.onclick=()=>execute(async()=>{if(!confirm('تأكيد هذا الحجز بعد مراجعة التوافر؟'))return;await api('/bookings/'+b.id+'/confirm',{method:'PATCH'});await refresh();notify('تم تأكيد الحجز وحجز المقاعد')});cell.replaceChildren(btn)}$('bookings-body').append(tr)});
 const selector=$('booking-programs');selector.replaceChildren();const available=programs.filter(p=>p.status==='PUBLISHED'&&Number(p.available_seats)>Number(p.booked_seats||0));available.forEach(p=>{const opt=element('option',p.title);opt.value=p.id;selector.append(opt)});$('booking-form').querySelector('button[type=submit]').disabled=!available.length;
}
async function refresh(){[programs,bookings]=await Promise.all([api('/programs'),api('/bookings')]);render()}
async function execute(fn){try{await fn()}catch(error){notify(error.message,'error')}}
$('login-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;const submit=f.querySelector('button[type=submit]');submit.disabled=true;show('login-error',false);try{const payload=Object.fromEntries(new FormData(f));const session=await api('/auth/login',{method:'POST',body:payload});token=session.token;role=session.role;await refresh();$('user-role').textContent=role;show('login',false);show('app',true);notify('لوحة الإدارة متصلة بقاعدة البيانات. ربط واتساب غير مفعل حتى الآن.');f.reset();}catch(error){token='';$('login-error').textContent=error.message;show('login-error',true)}finally{submit.disabled=false}});
$('logout').addEventListener('click',async()=>{await execute(()=>api('/auth/logout',{method:'POST'}));token='';programs=[];bookings=[];show('app',false);show('login',true)});
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>choose(b.dataset.page));
document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>choose(b.dataset.goto));
$('toggle-program-form').onclick=()=>show('program-form',$('program-form').hidden);
$('cancel-program').onclick=()=>show('program-form',false);
$('toggle-booking-form').onclick=()=>show('booking-form',$('booking-form').hidden);
$('cancel-booking').onclick=()=>show('booking-form',false);
$('program-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;const d=Object.fromEntries(new FormData(f));execute(async()=>{await api('/programs',{method:'POST',body:{title:d.title,category:d.category,currency:d.currency,priceMinor:Math.round(Number(d.price)*100),availableSeats:Number(d.availableSeats)}});f.reset();show('program-form',false);await refresh();notify('تم حفظ البرنامج كمسودة')})};
$('booking-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;const d=Object.fromEntries(new FormData(f));execute(async()=>{await api('/bookings',{method:'POST',body:{programId:d.programId,customerName:d.customerName,customerPhone:d.customerPhone,partySize:Number(d.partySize)}});f.reset();show('booking-form',false);await refresh();notify('تم إنشاء طلب حجز مبدئي')})};
document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{const cat=b.dataset.category;const box=$('sim-messages');box.replaceChildren(element('div','البرامج المتاحة — '+categories[cat],'bubble'));const matching=programs.filter(p=>p.category===cat&&p.status==='PUBLISHED'&&Number(p.available_seats)>Number(p.booked_seats||0));box.append(element('div',matching.length?matching.slice(0,8).map(p=>p.title+' — '+money(p.priceMinor,p.currency)).join('\n'):'لا توجد برامج منشورة متاحة حاليًا','bubble'));box.lastChild.style.whiteSpace='pre-line';if(matching.length>8)box.append(element('div','توجد برامج إضافية تظهر في الصفحات التالية عند التكامل الرسمي.','bubble'))}));