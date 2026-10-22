/** Pure timezone-aware scheduling. No timers or provider calls inside a request. */
export type BusinessSchedule={timezone:string;timezoneField?:string;weekdays:number[];open:string;close:string;holidays?:string[]};
export type DelaySchedule=({mode:'BUSINESS_HOURS'}&BusinessSchedule)|{mode:'AT';timezone:string;at?:string;field?:string};
const clocks=new Map<string,Intl.DateTimeFormat>();
function clock(timezone:string){let f=clocks.get(timezone);if(!f){f=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});if(clocks.size>100)clocks.clear();clocks.set(timezone,f)}return f}
const time=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
export function validateBusinessSchedule(raw:unknown):asserts raw is BusinessSchedule{
 const s=raw as BusinessSchedule;if(!s||typeof s!=='object'||typeof s.timezone!=='string'||s.timezone.length>80)throw Error('Choose a valid IANA timezone');
 try{clock(s.timezone).format(0)}catch{throw Error('Choose a valid IANA timezone')}
 if(s.timezoneField!==undefined&&(typeof s.timezoneField!=='string'||!/^[a-z][a-z0-9_]{0,39}$/.test(s.timezoneField)||['constructor','prototype','__proto__'].includes(s.timezoneField)))throw Error('Choose a safe customer timezone field');
 if(!Array.isArray(s.weekdays)||!s.weekdays.length||s.weekdays.length>7||new Set(s.weekdays).size!==s.weekdays.length||s.weekdays.some(d=>!Number.isInteger(d)||d<1||d>7))throw Error('Choose weekdays from 1 (Monday) to 7 (Sunday)');
 for(const v of [s.open,s.close])if(typeof v!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Error('Opening times must use HH:mm');
 if(s.open===s.close)throw Error('Opening and closing times must differ');
 if(s.holidays!==undefined&&(!Array.isArray(s.holidays)||s.holidays.length>60||s.holidays.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)))throw Error('Invalid holiday dates');
}
export function validateDelaySchedule(raw:unknown):asserts raw is DelaySchedule{
 const s=raw as DelaySchedule;if(s?.mode==='BUSINESS_HOURS'){validateBusinessSchedule(s);return}
 if(s?.mode!=='AT'||typeof s.timezone!=='string')throw Error('Invalid delay schedule');
 try{clock(s.timezone).format(0)}catch{throw Error('Choose a valid IANA timezone')}
 if(Boolean(s.at)===Boolean(s.field))throw Error('Choose exactly one scheduled timestamp or field');
 if(s.at&&!validInstant(s.at))throw Error('Scheduled date requires an explicit timezone offset');
 if(s.field&&!/^[a-z][a-z0-9_]{0,39}$/.test(s.field))throw Error('Invalid scheduled date field');
}
export function validInstant(s:string){return typeof s==='string'&&Number.isFinite(Date.parse(s.slice(0,10)))&&new Date(s.slice(0,10)).toISOString().slice(0,10)===s.slice(0,10)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s))}
export function customerSchedule(s:BusinessSchedule,answers:Record<string,string>={}):BusinessSchedule{
 const value=s.timezoneField?answers[s.timezoneField]:undefined;if(!value)return {...s,timezoneField:undefined};
 if(value.length>80)throw Error('Customer timezone is invalid');try{clock(value).format(0)}catch{throw Error('Customer timezone is invalid')}
 return {...s,timezone:value,timezoneField:undefined};
}
export function businessIsOpen(schedule:BusinessSchedule,now:number,answers:Record<string,string>={}){
 const s=customerSchedule(schedule,answers);
 const p=Object.fromEntries(clock(s.timezone).formatToParts(now).map(p=>[p.type,p.value]));const day={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[p.weekday as 'Mon']||0;
 const date=p.year+'-'+p.month+'-'+p.day;if(s.holidays?.includes(date))return false;
 const current=Number(p.hour)*60+Number(p.minute),start=time(s.open),end=time(s.close);
 if(start<end)return s.weekdays.includes(day)&&current>=start&&current<end;
 // Overnight windows belong to the weekday on which they open.
 return current>=start?s.weekdays.includes(day):current<end&&s.weekdays.includes(day===1?7:day-1);
}
export function scheduledDelay(s:DelaySchedule,now:number,answers:Record<string,string>):number{
 if(s.mode==='AT'){const value=s.at||(s.field?answers[s.field]:'');if(!validInstant(value))throw Error('Scheduled field has no zoned timestamp');const seconds=Math.max(0,Math.ceil((Date.parse(value)-now)/1000));if(seconds>31622400)throw Error('Scheduled date exceeds one year');return seconds}
 const resolved=customerSchedule(s,answers);if(businessIsOpen(resolved,now))return 0;
 const parts=(at:number)=>Object.fromEntries(clock(resolved.timezone).formatToParts(at).map(p=>[p.type,p.value]));
 const current=parts(now),firstDate=Date.UTC(Number(current.year),Number(current.month)-1,Number(current.day));
 const start=time(resolved.open),end=time(resolved.close),horizon=now+31622400000;
 // Enumerate eligible local calendar days, then valid wall-clock minutes. Sampling offsets
 // around each date represents both sides of DST; exact roundtrip removes gaps and keeps folds.
 // Holidays/closed weekdays cost one date test instead of thousands of Intl calls.
 for(let day=0;day<=366;day++){
  const date=firstDate+day*86400000,iso=new Date(date).toISOString().slice(0,10),weekday=new Date(date).getUTCDay()||7;
  if(resolved.holidays?.includes(iso))continue;
  const windows:number[][]=start<end?(resolved.weekdays.includes(weekday)?[[start,end]]:[]):[...(resolved.weekdays.includes(weekday)?[[start,1440]]:[]),...(resolved.weekdays.includes(weekday===1?7:weekday-1)?[[0,end]]:[])];
  if(!windows.length)continue;
  const offsets=new Set<number>();for(let hours=-36;hours<=36;hours+=6){const utc=date+hours*3600000,p=parts(utc);offsets.add(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute))-utc)}
  let best=Infinity;
  for(const [from,to]of windows)for(let minute=from;minute<to;minute++)for(const offset of offsets){
   const candidate=date+minute*60000-offset;if(candidate<=now||candidate>=best||candidate>horizon)continue;
   const p=parts(candidate);if(p.year+'-'+p.month+'-'+p.day===iso&&Number(p.hour)*60+Number(p.minute)===minute)best=candidate;
  }
  if(Number.isFinite(best))return Math.ceil((best-now)/1000);
 }
 throw Error('No opening within the next year');
}
