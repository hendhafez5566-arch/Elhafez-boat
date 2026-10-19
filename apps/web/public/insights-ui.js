/** Clear owner/staff analytics; figures come from real tenant-scoped API only. */
export function initInsights({api,$,el}){
 let periodDays=30,loadRevision=0;
 const clear=()=>{const host=$('bot-insights');if(host)host.replaceChildren()};
 const number=value=>new Intl.NumberFormat('ar-EG').format(Number(value)||0);
 function metric(host,title,value,note,unit=''){
  const card=el('article',undefined,'metric');
  card.append(el('span',title),el('strong',number(value)+unit));
  if(note)card.append(el('small',note,'muted'));
  host.append(card);
 }
 async function load(){
  const host=$('bot-insights'),revision=++loadRevision;
  host.setAttribute('aria-busy','true');
  const loading=el('p','جارٍ تحديث التحليلات…','insights-loading');
  host.querySelector('.insights-loading')?.remove();host.append(loading);
  let data;
  try{data=await api('/analytics/overview?days='+periodDays)}
  catch{if(revision===loadRevision){loading.textContent='تعذر تحديث التحليلات. البيانات الظاهرة من آخر تحديث ناجح. ';const retry=el('button','إعادة المحاولة');retry.type='button';retry.onclick=()=>void load();loading.append(retry);loading.setAttribute('role','alert');host.setAttribute('aria-busy','false')}return}
  if(revision!==loadRevision)return;
  host.replaceChildren();host.setAttribute('aria-busy','false');
  const period=el('select');period.setAttribute('aria-label','فترة التحليلات');
  for(const days of [7,30,90]){const option=el('option','آخر '+days+' يوم');option.value=String(days);period.append(option)}
  period.value=String(periodDays);period.onchange=()=>{periodDays=Number(period.value);void load()};
  host.append(period);
  const note=el('p','المحادثات والعملاء والحملات أُنشئت خلال الفترة المختارة. مهام المتابعة تعرض الوضع الحالي لكل الفترات. تسجيل الاهتمام ليس مبيعات أو حجوزات.','muted');
  host.append(note);
  const metrics=el('div',undefined,'metrics');
  metric(metrics,'المحادثات الواردة',data.conversations);
  metric(metrics,'عملاء سجلوا اهتمامهم',data.leads);
  metric(metrics,'نسبة تحويل المحادثة إلى اهتمام',data.leadCapturePct,undefined,'٪');
  metric(metrics,'جاهزون للموظف',data.ready);
  metric(metrics,'مهام متابعة متأخرة',data.tasks.overdue);
  metric(metrics,'حملات نشطة',data.campaigns.active);
  host.append(metrics);
  const grid=el('div',undefined,'grid');
  const channels=el('section',undefined,'panel');channels.append(el('h3','المحادثات حسب القناة'));
  const full=Math.max(1,...data.channels.map(x=>Number(x.total)));
  if(!data.channels.length)channels.append(el('p','لسه مفيش محادثات خلال الفترة دي.','muted'));
  for(const row of data.channels){
   const line=el('div',undefined,'insight-row');line.append(el('span',({WEBSITE:'شات الموقع',WHATSAPP:'واتساب',MESSENGER:'ماسنجر',INSTAGRAM:'إنستجرام',TELEGRAM:'تيليجرام'}[row.channel]||row.channel)+' — '+number(row.total)));
   const rail=el('div',undefined,'insight-rail'),fill=el('div',undefined,'insight-fill');fill.style.width=Math.round(Number(row.total)*100/full)+'%';rail.append(fill);line.append(rail);channels.append(line);
  }
  const funnel=el('section',undefined,'panel');funnel.append(el('h3','رحلة العميل'));
  for(const [title,count] of [['سجل اهتمامه',data.leads],['جاهز للموظف',data.ready],['تم التواصل',data.contacted],['مغلق',data.closedLeads]]){
   const row=el('div',undefined,'insight-row');row.append(el('span',title+' — '+number(count)));
   const rail=el('div',undefined,'insight-rail'),fill=el('div',undefined,'insight-fill');fill.style.width=(data.leads?Math.round(Number(count)*100/data.leads):0)+'%';rail.append(fill);row.append(rail);funnel.append(row);
  }
  grid.append(channels,funnel);host.append(grid);
  const activity=el('section',undefined,'panel');activity.append(el('h3','المحادثات والعملاء المهتمون يوميًا'));
  const incoming=new Map((data.daily||[]).map(x=>[x.day,Number(x.conversations)]));
  const captured=new Map((data.leadDaily||[]).map(x=>[x.day,Number(x.leads)]));
  const today=new Date();const dates=Array.from({length:periodDays},(_,i)=>{const date=new Date(today);date.setUTCDate(date.getUTCDate()-periodDays+1+i);return date.toISOString().slice(0,10)});
  if(!incoming.size&&!captured.size)activity.append(el('p','لا يوجد نشاط في الفترة المحددة.','muted'));
  const chart=el('div',undefined,'vessel-activity-series'),peak=Math.max(1,...dates.flatMap(day=>[incoming.get(day)||0,captured.get(day)||0]));
  for(const day of dates){
   const row=el('div',undefined,'vessel-activity-day'),bars=el('div',undefined,'vessel-activity-bars');
   row.append(el('span',day,'vessel-activity-date'));
   for(const [kind,value,title] of [['incoming',incoming.get(day)||0,'محادثات'],['captured',captured.get(day)||0,'عملاء مهتمون']]){
    const track=el('div',undefined,'vessel-activity-rail'),fill=el('div',undefined,'vessel-activity-fill vessel-activity-'+kind);
    track.setAttribute('aria-label',day+' — '+title+': '+number(value));fill.style.width=Math.round(value*100/peak)+'%';track.append(fill);bars.append(track);
   }
   row.append(bars,el('small',number(incoming.get(day)||0)+' / '+number(captured.get(day)||0),'vessel-activity-values'));chart.append(row);
  }
  if(dates.length)activity.append(el('p','المحادثات / العملاء المهتمون','vessel-activity-legend'),chart);
  host.append(activity);
  const footer=el('p',undefined,'muted');
  footer.textContent='مهام متابعة مفتوحة: '+number(data.tasks.open)+' • مكتملة: '+number(data.tasks.done)+' • إجمالي الحملات خلال الفترة: '+number(data.campaigns.total);
  host.append(footer);
 }
 return {load,reset:clear};
}
