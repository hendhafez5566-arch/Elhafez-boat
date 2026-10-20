/** Aggregate-only CSV: fixed headers, UTC dates and numeric counts; no contact data. */
export function activityDays(data){
 const end=typeof data.range?.endDay==='string'?new Date(data.range.endDay+'T00:00:00Z'):new Date();
 const days=[7,30,90].includes(data.periodDays)?data.periodDays:30;
 return Array.from({length:days},(_,i)=>{const day=new Date(end);day.setUTCDate(day.getUTCDate()-days+1+i);return day.toISOString().slice(0,10)});
}
export function activityCsv(data){
 const conversations=new Map((data.daily||[]).map(row=>[row.day,Number(row.conversations)||0]));
 const leads=new Map((data.leadDaily||[]).map(row=>[row.day,Number(row.leads)||0]));
 const rows=[['اليوم UTC','المحادثات','العملاء المهتمون'],...activityDays(data).map(day=>[day,conversations.get(day)||0,leads.get(day)||0])];
 return '\uFEFF'+rows.map(row=>row.join(',')).join('\r\n')+'\r\n';
}
