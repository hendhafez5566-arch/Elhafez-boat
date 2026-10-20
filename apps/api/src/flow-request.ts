/** Bounded request contract. Credentials stay in the existing integration secret store. */
export type FlowRequest={method:'GET'|'POST';timeoutSeconds:number;maxAttempts:number;body:Record<string,string>;mapping:{path:string;field:string}[];errorNext:string;timeoutNext:string};
export type RequestMock={outcome:'SUCCESS'|'HTTP_ERROR'|'TIMEOUT';body?:unknown;status?:number};
const field=/^[a-z][a-z0-9_]{0,39}$/,bad=new Set(['__proto__','prototype','constructor']);
export function responsePath(path:string){const parts=path.split('.');if(!path||path.length>180||parts.length>6||parts.some(p=>!/^([a-zA-Z_][a-zA-Z0-9_]*|\d{1,3})$/.test(p)||bad.has(p)))throw Error('Response path must use 1–6 safe dot-separated keys');return parts}
export function validateFlowRequest(raw:unknown):asserts raw is FlowRequest{
 const r=raw as FlowRequest;if(!r||typeof r!=='object'||!['GET','POST'].includes(r.method)||!Number.isInteger(r.timeoutSeconds)||r.timeoutSeconds<1||r.timeoutSeconds>30||!Number.isInteger(r.maxAttempts)||r.maxAttempts<1||r.maxAttempts>3||r.method==='POST'&&r.maxAttempts!==1)throw Error('Request needs GET/POST, 1–30 seconds and 1–3 attempts; POST cannot retry automatically');
 if(!r.body||typeof r.body!=='object'||Array.isArray(r.body)||Object.keys(r.body).length>25||Object.entries(r.body).some(([k,v])=>!field.test(k)||bad.has(k)||typeof v!=='string'||v.length>500))throw Error('Request body supports up to 25 bounded field templates');
 if(!Array.isArray(r.mapping)||r.mapping.length>25)throw Error('Response mapping supports up to 25 fields');const fields=new Set();for(const m of r.mapping){if(!m||typeof m.path!=='string'||typeof m.field!=='string'||!field.test(m.field)||bad.has(m.field)||fields.has(m.field))throw Error('Response mapping needs unique safe fields');responsePath(m.path);fields.add(m.field)}
 for(const key of ['errorNext','timeoutNext'] as const)if(typeof r[key]!=='string'||r[key].length>180)throw Error('Request needs error and timeout routes');
}
export function mapRequestResponse(request:FlowRequest,body:unknown):Record<string,string>{
 if(Buffer.byteLength(JSON.stringify(body)??'')>65536)throw Error('Response exceeds 64 KiB');const result:Record<string,string>=Object.create(null);
 for(const m of request.mapping){let value:any=body;for(const part of responsePath(m.path)){if(!value||typeof value!=='object'||!Object.hasOwn(value,part))throw Error('Mapped response field unavailable');value=value[part]}
  if(!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value)||String(value).length>500)throw Error('Mapped response value must be a bounded scalar');result[m.field]=String(value);
 }return result;
}
export function validateRequestMocks(raw:unknown):asserts raw is Record<string,RequestMock>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>100||Buffer.byteLength(JSON.stringify(raw))>65536)throw Error('Invalid bounded request mocks');
 for(const [id,m]of Object.entries(raw as Record<string,RequestMock>)){if(!/^[a-z][a-z0-9_-]{0,31}$/.test(id)||!m||!['SUCCESS','HTTP_ERROR','TIMEOUT'].includes(m.outcome)||m.status!==undefined&&(!Number.isInteger(m.status)||m.status<100||m.status>599))throw Error('Invalid request mock')}
}
