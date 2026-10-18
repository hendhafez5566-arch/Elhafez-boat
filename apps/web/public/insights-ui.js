/** Clear owner/staff analytics; figures come from real tenant-scoped API only. */
export function initInsights({api,$,el}){
 let periodDays=30;
 const clear=()=>{const host=$('bot-insights');if(host)host.replaceChildren()};
 const number=value=>new Intl.NumberFormat('ar-EG').format(Number(value)||0);
 function metric(host,title,value,note,unit=''){
  const card=el('article',undefined,'metric');
  card.append(el('span',title),el('strong',number(value)+unit));
  if(note)card.append(el('small',note,'muted'));
  host.append(card);
 }
 async function load(){
  const host=$('bot-insights');host.replaceChildren();
  const period=el('select');period.setAttribute('aria-label','فترة التحليلات');
  for(const days of [7,30,90]){const option=el('option','آخر '+days+' يوم');option.value=String(days);period.append(option)}
  period.value=String(periodDays);period.onchange=()=>{periodDays=Number(period.value);void load()};
  host.append(period);
  const data=await api('/analytics/overview?days='+periodDays);
  const note=el('p','كل الأرقام عن الفترة المختارة للشركة. تسجيل الاهتمام ليس مبيعات أو حجوزات.','muted');
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
   const line=el('div',undefined,'insight-row');line.append(el('span',row.channel+' — '+number(row.total)));
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
  const dates=[...new Set([...incoming.keys(),...captured.keys()])].sort();
  if(!dates.length)activity.append(el('p','لا يوجد نشاط في الفترة المحددة.','muted'));
  for(const day of dates)activity.append(el('p',day+' — محادثات: '+number(incoming.get(day)||0)+' • اهتمام: '+number(captured.get(day)||0)));
  host.append(activity);
  const footer=el('p',undefined,'muted');
  footer.textContent='مهام متابعة مفتوحة: '+number(data.tasks.open)+' • مكتملة: '+number(data.tasks.done)+' • إجمالي الحملات خلال الفترة: '+number(data.campaigns.total);
  host.append(footer);
 }
 return {load,reset:clear};
}
