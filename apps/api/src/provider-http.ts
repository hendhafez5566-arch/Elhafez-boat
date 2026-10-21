/** Provider HTTP: exact server-selected hosts, public DNS pinning, no redirects/credential URLs. */
import {request} from 'node:https';
import {lookup} from 'node:dns/promises';
import {publicIP} from './integrations.js';
export class ProviderFailure extends Error{constructor(public status:number,public ambiguous=false){super('Provider HTTP '+status)}}
export async function providerHTTP(url:URL,allowed:string[],method='GET',headers:Record<string,string>={},body?:unknown,options:{deadline?:number}={}):Promise<any>{
 const deadline=options.deadline??Date.now()+12000;if(deadline<=Date.now())throw new ProviderFailure(0);
 if(url.protocol!=='https:'||url.port&&url.port!=='443'||url.username||url.password||!allowed.includes(url.hostname))throw new Error('Provider destination rejected');
 const addresses=await lookup(url.hostname,{all:true}),pin=addresses.find(a=>a.family===4);if(!pin||addresses.some(a=>!publicIP(a.address)))throw new Error('Provider DNS rejected');
 if(deadline<=Date.now())throw new ProviderFailure(0);
 const content=body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body);
 return new Promise((resolve,reject)=>{let settled=false;let timer:ReturnType<typeof setTimeout>;const done=(error:unknown,value?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve(value)};const req=request(url,{method,family:4,lookup:(_h,_o,cb)=>cb(null,pin.address,4),headers:{...headers,...(content?{'content-length':String(Buffer.byteLength(content))}:{})},timeout:Math.max(1,Math.min(12000,deadline-Date.now()))},res=>{
  const chunks:Buffer[]=[];let size=0;res.on('data',c=>{size+=c.length;if(size>2097152)res.destroy(new Error('Provider response too large'));else chunks.push(c)});res.on('error',()=>done(new ProviderFailure(0,true)));res.on('end',()=>{if(!res.statusCode||res.statusCode<200||res.statusCode>=300)return done(new ProviderFailure(res.statusCode||0,method!=='GET'&&(res.statusCode||0)>=500));try{const text=Buffer.concat(chunks).toString();done(null,text?JSON.parse(text):{})}catch{done(new ProviderFailure(0,method!=='GET'))}});
 });timer=setTimeout(()=>{req.destroy();done(new ProviderFailure(0,method!=='GET'))},Math.max(1,deadline-Date.now()));req.on('timeout',()=>req.destroy());req.on('error',()=>done(new ProviderFailure(0,method!=='GET')));req.end(content)});
}
