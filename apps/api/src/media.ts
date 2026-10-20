import {randomBytes} from 'node:crypto';
import {tokenDigest} from './auth.js';
import {allow,HttpFailure,isUuid,type Actor,type SqlClient,type SqlPool} from './services.js';
import {publicTenant} from './public-tenant.js';
export function detectMedia(data:Buffer):string|null{
 if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(data[0]===255&&data[1]===216&&data[2]===255)return 'image/jpeg';
 if(['GIF87a','GIF89a'].includes(data.subarray(0,6).toString()))return 'image/gif';
 if(data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP')return 'image/webp';
 if(data.subarray(0,5).toString()==='%PDF-')return 'application/pdf';
 if(data.subarray(0,4).toString()==='OggS'&&data.subarray(0,256).includes(Buffer.from('OpusHead')))return 'audio/ogg';
 if(data.subarray(0,3).toString()==='ID3'||data[0]===255&&(data[1]&224)===224)return 'audio/mpeg';
 if(data.subarray(4,8).toString()==='ftyp')return 'video/mp4';return null;
}
function publicURL(token:string){const base=process.env.MEDIA_PUBLIC_ORIGIN;if(!base)return null;try{const u=new URL(base);if(u.protocol!=='https:'||u.origin!==base)return null;return base+'/api/v1/media/public/'+token}catch{return null}}
export async function listMedia(db:SqlClient,actor:Actor){allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);return (await db.query("SELECT id,name,mime,bytes,public_token,created_at,scan_status,scan_result FROM chatbot_media WHERE tenant_id=$1 AND status='ACTIVE' ORDER BY created_at DESC LIMIT 200",[actor.tenantId])).rows.map(x=>({...x,url:x.scan_status==='CLEAN'?publicURL(String(x.public_token)):null}))}
export async function uploadMedia(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);const d=input as {name?:unknown;base64?:unknown};if(!d||typeof d.name!=='string'||!d.name.trim()||d.name.length>160||typeof d.base64!=='string'||d.base64.length>6990508||!/^[A-Za-z0-9+/]+={0,2}$/.test(d.base64))throw new HttpFailure(400,'Invalid media upload');
 const data=Buffer.from(d.base64,'base64'),mime=detectMedia(data);if(!mime||!data.length||data.length>5242880)throw new HttpFailure(400,'Unsupported or oversized media; max 5 MiB');
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const usage=await db.query(`SELECT (SELECT coalesce(sum(bytes),0)::text FROM chatbot_media WHERE tenant_id=$1 AND status='ACTIVE') AS used,(SELECT media_bytes::text FROM chatbot_usage_limits WHERE tenant_id=$1) AS cap`,[actor.tenantId]);
 if(Number(usage.rows[0].used)+data.length>Number(usage.rows[0].cap||52428800))throw new HttpFailure(409,'Company media storage limit reached');
 const token=randomBytes(32).toString('base64url');const r=await db.query('INSERT INTO chatbot_media(tenant_id,name,mime,bytes,content,public_token) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,mime,bytes',[actor.tenantId,d.name.trim(),mime,data.length,data,token]);
 await db.query('INSERT INTO chatbot_media_routes(token_hash,tenant_id,media_id) VALUES($1,$2,$3)',[tokenDigest(token),actor.tenantId,r.rows[0].id]);return {...r.rows[0],url:null,scanStatus:'PENDING'};
}
export async function deleteMedia(db:SqlClient,actor:Actor,id:string){allow(actor,['OWNER','MANAGER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid media');
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const r=await db.query("SELECT public_token FROM chatbot_media WHERE tenant_id=$1 AND id=$2 AND status='ACTIVE' FOR UPDATE",[actor.tenantId,id]);if(!r.rowCount)throw new HttpFailure(404,'Media not found');
 const used=await db.query(`SELECT 1 FROM (
 SELECT definition::text AS content FROM chatbot_flow_versions WHERE tenant_id=$1
 UNION ALL SELECT definition::text FROM chatbot_bot_versions WHERE tenant_id=$1
 UNION ALL SELECT definition::text FROM chatbot_subflow_versions WHERE tenant_id=$1
 UNION ALL SELECT payload::text FROM whatsapp_outbox WHERE tenant_id=$1 AND status IN ('PENDING','PROCESSING','UNCERTAIN')
 UNION ALL SELECT steps::text FROM chatbot_campaigns WHERE tenant_id=$1 AND status IN ('DRAFT','ACTIVE')
 ) refs WHERE strpos(content,$2)>0 LIMIT 1`,[actor.tenantId,'/api/v1/media/public/'+r.rows[0].public_token]);if(used.rowCount)throw new HttpFailure(409,'Media is referenced by a published flow or pending message; preserve active conversations');
 await db.query("UPDATE chatbot_media SET status='DELETED',content=NULL WHERE tenant_id=$1 AND id=$2",[actor.tenantId,id]);return {deleted:true};
}
export async function publicMedia(pool:SqlClient&SqlPool,token:string){if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new HttpFailure(404,'Media not found');const route=await pool.query('SELECT tenant_id,media_id FROM chatbot_media_routes WHERE token_hash=$1',[tokenDigest(token)]);if(!route.rowCount)throw new HttpFailure(404,'Media not found');const tenantId=String(route.rows[0].tenant_id);return publicTenant(pool,tenantId,async db=>{const r=await db.query("SELECT content,mime FROM chatbot_media WHERE tenant_id=$1 AND id=$2 AND status='ACTIVE' AND scan_status='CLEAN'",[tenantId,route.rows[0].media_id]);if(!r.rowCount)throw new HttpFailure(410,'Media removed');return {data:r.rows[0].content as Buffer,mime:String(r.rows[0].mime)}})}

/** Managed assets must match the selected WhatsApp media kind; remote URLs remain provider-validated. */
export async function validateManagedMedia(db:SqlClient,tenantId:string,url:string,kind:string){
 let u:URL;try{u=new URL(url)}catch{throw new HttpFailure(400,'Invalid media URL')}
 const token=/^\/api\/v1\/media\/public\/([A-Za-z0-9_-]{43})$/.exec(u.pathname)?.[1];if(!token||u.origin!==process.env.MEDIA_PUBLIC_ORIGIN)return;
 const r=await db.query("SELECT mime FROM chatbot_media WHERE tenant_id=$1 AND public_token=$2 AND status='ACTIVE' AND scan_status='CLEAN'",[tenantId,token]);if(!r.rowCount)throw new HttpFailure(400,'Managed media is unavailable in this company');
 const supported:Record<string,string[]>={image:['image/jpeg','image/png'],video:['video/mp4'],audio:['audio/mpeg','audio/ogg'],document:['application/pdf']};
 if(!supported[kind]?.includes(String(r.rows[0].mime)))throw new HttpFailure(400,'Managed media format is not supported for this WhatsApp node/header');
}

/** Authenticated preview/download never depends on public delivery configuration. */
export async function privateMedia(db:SqlClient,actor:Actor,id:string){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid media');
 const asset=await db.query("SELECT content,mime,name FROM chatbot_media WHERE tenant_id=$1 AND id=$2 AND status='ACTIVE' AND scan_status='CLEAN'",[actor.tenantId,id]);
 if(!asset.rowCount)throw new HttpFailure(404,'Clean media not available');return asset.rows[0] as {content:Buffer;mime:string;name:string};
}
