/** Same-origin dashboard sessions; credentials never need to enter web storage. */
import { HttpFailure } from './services.js';
const VALID=/^[A-Za-z0-9_-]{43}$/;
export function sessionCookie(token:string,{secure=true,clear=false}:{secure?:boolean;clear?:boolean}={}):string{
 if(!clear&&!VALID.test(token))throw new HttpFailure(500,'Invalid session token');
 return ['eb_session='+(clear?'':token),'Path=/api/v1','HttpOnly','SameSite=Strict',secure?'Secure':'',clear?'Max-Age=0':'Max-Age=43200'].filter(Boolean).join('; ');
}
export function sessionBearer(authorization:unknown,header:unknown):string|undefined{
 if(typeof authorization==='string'&&authorization)return authorization;
 if(typeof header!=='string')return undefined;
 const found=/(?:^|;\s*)eb_session=([A-Za-z0-9_-]{43})(?=;|$)/.exec(header);
 return found?'Bearer '+found[1]:undefined;
}
export function requireCookieCsrf(method:string,header:unknown,hasCookieAuth:boolean):void{
 if(!hasCookieAuth||['GET','HEAD','OPTIONS'].includes(method.toUpperCase()))return;
 if(header!=='1')throw new HttpFailure(403,'Session request verification required');
}
