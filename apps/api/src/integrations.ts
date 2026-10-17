import {sealIntegrationSecret,openIntegrationSecret} from './integration-secrets.js';
import {createHmac} from 'node:crypto';
/** HTTPS webhooks only, configured server allowlist, DNS pinned public IPv4, no redirects. */
import {request} from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP,BlockList} from 'node:net';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
const denied=new BlockList();
const global6=new BlockList();global6.addSubnet('2000::',3,'ipv6');
const reserved6=new BlockList();reserved6.addSubnet('2001::',23,'ipv6');reserved6.addSubnet('2001:db8::',32,'ipv6');reserved6.addSubnet('2002::',16,'ipv6');
export function publicIP(ip:string){return isIP(ip)===4?publicIPv4(ip):isIP(ip)===6&&global6.check(ip,'ipv6')&&!reserved6.check(ip,'ipv6')}

for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)denied.addSubnet(address,prefix,'ipv4');
export function publicIPv4(ip:string){return isIP(ip)===4&&!denied.check(ip,'ipv4')}
export function webhookURL(raw:string){
 let url:URL;try{url=new URL(raw)}catch{throw new HttpFailure(400,'Invalid webhook URL')}
 const hosts=(process.env.OUTBOUND_WEBHOOK_HOSTS||'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean);
 if(url.protocol!=='https:'||url.port&&url.port!=='443'||url.username||url.password||url.hash||isIP(url.hostname)||!hosts.includes(url.hostname.toLowerCase()))throw new HttpFailure(400,'Webhook requires HTTPS and a host approved in OUTBOUND_WEBHOOK_HOSTS');
 // URL queries often contain credentials. Keep secrets outside the database and logs.
 if(url.search)throw new HttpFailure(400,'Use a webhook URL without query credentials');return url;
}
export async function listIntegrations(db:SqlClient,actor:Actor){allow(actor,['OWNER','MANAGER']);return (await db.query('SELECT id,name,url,enabled,auth_mode AS "authMode" FROM chatbot_integrations WHERE tenant_id=$1 ORDER BY name LIMIT 100',[actor.tenantId])).rows}
export async function createIntegration(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);const d=input as {name?:unknown;url?:unknown;authMode?:unknown;secret?:unknown};if(!d||typeof d.name!=='string'||d.name.trim().length<2||d.name.length>100||typeof d.url!=='string'||d.url.length>2048)throw new HttpFailure(400,'Invalid integration');const url=webhookURL(d.url);const authMode=d.authMode||'NONE';if(!['NONE','BEARER','HMAC'].includes(String(authMode)))throw new HttpFailure(400,'Invalid integration auth mode');const encrypted=authMode==='NONE'?null:typeof d.secret==='string'?sealIntegrationSecret(d.secret):null;if(authMode!=='NONE'&&!encrypted)throw new HttpFailure(400,'Integration secret required');
 const r=await db.query('INSERT INTO chatbot_integrations(tenant_id,name,url,auth_mode,secret_encrypted) VALUES($1,$2,$3,$4,$5) RETURNING id,name,url,enabled',[actor.tenantId,d.name.trim(),url.href,authMode,encrypted]);await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'INTEGRATION_CREATED','integration',$3)`,[actor.tenantId,actor.userId,r.rows[0].id]);return r.rows[0];
}
export async function enqueueIntegration(db:SqlClient,tenantId:string,id:string,payload:unknown){
 if(!isUuid(id))throw new HttpFailure(400,'Invalid integration');await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[tenantId]);const backlog=await db.query("SELECT count(*)::int AS n FROM chatbot_integration_jobs WHERE tenant_id=$1 AND status='PENDING'",[tenantId]);if(Number(backlog.rows[0]?.n)>=1000)throw new HttpFailure(429,'Integration queue limit reached');const integration=await db.query('SELECT url FROM chatbot_integrations WHERE tenant_id=$1 AND id=$2 AND enabled=true',[tenantId,id]);if(!integration.rowCount)throw new HttpFailure(409,'Integration not enabled');webhookURL(String(integration.rows[0].url));
 await db.query('INSERT INTO chatbot_integration_jobs(tenant_id,integration_id,payload) VALUES($1,$2,$3::jsonb)',[tenantId,id,JSON.stringify(payload)]);
}
export async function sendWebhook(raw:string,payload:unknown,id:string,auth?:{mode:string;encrypted:string|null}){
 const url=webhookURL(raw),addresses=await lookup(url.hostname,{all:true});
 const pinned=addresses.find(a=>a.family===4);
 if(!pinned||addresses.some(a=>!publicIP(a.address)))throw new Error('Destination needs public DNS records and an IPv4 endpoint');
 const secret=auth?.encrypted?openIntegrationSecret(auth.encrypted):null;
 const body=JSON.stringify(payload);if(Buffer.byteLength(body)>65536)throw new Error('Webhook payload too large');
 await new Promise<void>((resolve,reject)=>{
  const req=request(url,{method:'POST',family:4,lookup:(_hostname,_options,cb)=>cb(null,pinned.address,4),headers:{'content-type':'application/json','content-length':Buffer.byteLength(body),'idempotency-key':id,...(auth?.mode==='BEARER'&&secret?{authorization:'Bearer '+secret}:{}),...(auth?.mode==='HMAC'&&secret?{'x-elhafez-signature':'sha256='+createHmac('sha256',secret).update(body).digest('hex')}:process.env.OUTBOUND_WEBHOOK_SIGNING_SECRET?{'x-elhafez-signature':'sha256='+createHmac('sha256',process.env.OUTBOUND_WEBHOOK_SIGNING_SECRET).update(body).digest('hex')}:{})},timeout:10000},res=>{
   // Drain without buffering arbitrary response content.
   let bytes=0;res.on('data',chunk=>{bytes+=chunk.length;if(bytes>65536)res.destroy(new Error('Webhook response too large'))});res.on('error',reject);res.on('end',()=>res.statusCode&&res.statusCode>=200&&res.statusCode<300?resolve():reject(new Error('Webhook HTTP '+res.statusCode)));
  });req.on('timeout',()=>req.destroy(new Error('Webhook timeout')));req.on('error',reject);req.end(body);
 });
}
export async function processIntegrationJob(db:SqlClient,tenantId:string){
 const r=await db.query(`SELECT j.*,i.url,i.auth_mode,i.secret_encrypted FROM chatbot_integration_jobs j JOIN chatbot_integrations i ON i.tenant_id=j.tenant_id AND i.id=j.integration_id WHERE j.tenant_id=$1 AND j.status='PENDING' AND j.next_attempt_at<=now() AND i.enabled=true AND EXISTS(SELECT 1 FROM tenant_subscriptions s WHERE s.tenant_id=j.tenant_id AND s.status IN ('ACTIVE','TRIAL') AND s.current_period_ends_at>now()) ORDER BY j.created_at LIMIT 1 FOR UPDATE OF j SKIP LOCKED`,[tenantId]);
 if(!r.rowCount)return;const job=r.rows[0];let status='SENT',error='';const attempts=Number(job.attempts)+1;
 try{await sendWebhook(String(job.url),job.payload,String(job.id),{mode:String(job.auth_mode),encrypted:job.secret_encrypted?String(job.secret_encrypted):null})}catch{status=attempts>=5?'FAILED':'PENDING';error='Webhook failed; inspect destination using job id'}
 await db.query(`UPDATE chatbot_integration_jobs SET status=$3,attempts=$4,last_error=$5,next_attempt_at=now()+($6::int*interval '1 second') WHERE tenant_id=$1 AND id=$2`,[tenantId,job.id,status,attempts,error,Math.min(3600,30*2**attempts)]);
 await db.query(`INSERT INTO audit_events(tenant_id,action,entity_type,entity_id) VALUES($1,$2,'integration_job',$3)`,[tenantId,'WEBHOOK_'+status,job.id]);
}

export async function updateIntegration(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER']);const d=input as {enabled?:unknown;secret?:unknown};if(!isUuid(id)||!d||typeof d.enabled!=='boolean')throw new HttpFailure(400,'Invalid integration update');
 const encrypted=d.secret===undefined?null:typeof d.secret==='string'?sealIntegrationSecret(d.secret):null;if(d.secret!==undefined&&!encrypted)throw new HttpFailure(400,'Invalid secret');
 const r=await db.query('UPDATE chatbot_integrations SET enabled=$3,secret_encrypted=coalesce($4,secret_encrypted) WHERE tenant_id=$1 AND id=$2 RETURNING id,name,enabled',[actor.tenantId,id,d.enabled,encrypted]);if(!r.rowCount)throw new HttpFailure(404,'Integration not found');
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'INTEGRATION_UPDATED','integration',$3)`,[actor.tenantId,actor.userId,id]);return r.rows[0];
}
