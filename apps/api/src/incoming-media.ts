/** Verified webhook intake -> bounded source contract -> existing quarantine/scanner. */
import {randomUUID} from 'node:crypto';
import {HttpFailure,isUuid,allow,type SqlClient,type Actor} from './services.js';
import {attachmentReference,type AttachmentReference} from './flow-native-input.js';
import {storeMedia,detectMedia} from './media.js';
import {providerHTTP,providerBytes,ProviderFailure,ProviderTimeout} from './provider-http.js';
import {decryptAccessToken} from './whatsapp.js';
import {openIntegrationSecret} from './integration-secrets.js';
export function attachmentSource(channel:string,reference:string):URL{
 if(channel==='TELEGRAM'){if(!/^[a-zA-Z0-9_/.-]{1,250}$/.test(reference)||reference.split('/').some(x=>x==='.'||x==='..')||reference.startsWith('/'))throw Error('Source rejected');return new URL('https://api.telegram.org/'+reference)}
 const u=new URL(reference);if(u.protocol!=='https:'||u.port&&u.port!=='443'||u.username||u.password||u.hash)throw Error('Source rejected');
 if(channel==='WHATSAPP'?u.hostname!=='lookaside.fbsbx.com':!/(^|\.)(fbcdn\.net|fbsbx\.com)$/.test(u.hostname))throw Error('Source rejected');return u;
}
export async function enqueueAttachment(db:SqlClient,t:string,cid:string,account:string,key:string,input:AttachmentReference){
 if(!attachmentReference(JSON.stringify(input))||input.channel==='WEBSITE')throw new HttpFailure(400,'Invalid source reference');
 await db.query('INSERT INTO chatbot_attachment_intakes(tenant_id,conversation_id,channel,account_id,source_key,kind,reference) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,channel,account_id,source_key) DO NOTHING',[t,cid,input.channel,account,key,input.kind,input.reference]);
}
export type MediaTransport={json:typeof providerHTTP;bytes:typeof providerBytes};
const real:MediaTransport={json:providerHTTP,bytes:providerBytes};
export async function processIncomingMedia(db:SqlClient,t:string,transport?:MediaTransport){
 if(!transport&&process.env.INBOUND_MEDIA_FETCH_ENABLED!=='1')return false;
 const candidate=await db.query("SELECT j.id,c.contact_id FROM chatbot_attachment_intakes j JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id WHERE j.tenant_id=$1 AND j.status='PENDING' ORDER BY j.created_at LIMIT 1",[t]);if(!candidate.rowCount)return false;
 const contact=await db.query('SELECT status FROM contacts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[t,candidate.rows[0].contact_id]);
 const row=await db.query("SELECT * FROM chatbot_attachment_intakes WHERE tenant_id=$1 AND id=$2 AND status='PENDING' FOR UPDATE SKIP LOCKED",[t,candidate.rows[0].id]);if(!row.rowCount)return false;const j=row.rows[0],http=transport||real,deadline=Date.now()+12000;
 if(contact.rows[0]?.status==='ARCHIVED'){await db.query("UPDATE chatbot_attachment_intakes SET status='CANCELLED',reference='',reason='ERASED',completed_at=now() WHERE tenant_id=$1 AND id=$2",[t,j.id]);return true}
 let phase='SOURCE_REJECTED';
 try{
 let url:URL,headers:Record<string,string>={},expected:string|undefined,expectedSize:number|undefined;
 if(j.channel==='WHATSAPP'){
 const account=await db.query("SELECT access_token_encrypted FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2 AND status='CONNECTED'",[t,j.account_id]);if(!account.rowCount)throw Error();const token=decryptAccessToken(String(account.rows[0].access_token_encrypted));
 const graph=process.env.META_GRAPH_VERSION||'';if(!/^v\d{1,2}\.\d{1,2}$/.test(graph))throw Error();const meta=await http.json(new URL('https://graph.facebook.com/'+graph+'/'+encodeURIComponent(String(j.reference))),['graph.facebook.com'],'GET',{authorization:'Bearer '+token},undefined,{deadline});if(String(meta.id)!==j.reference||!Number.isInteger(meta.file_size)||meta.file_size<1||meta.file_size>5242880||typeof meta.mime_type!=='string')throw Error();expectedSize=meta.file_size;expected=meta.mime_type;url=attachmentSource('WHATSAPP',meta.url);headers={authorization:'Bearer '+token};
 }else{
 const account=await db.query('SELECT token_encrypted FROM chatbot_social_accounts WHERE tenant_id=$1 AND id=$2 AND channel=$3 AND enabled=true',[t,j.account_id,j.channel]);if(!account.rowCount)throw Error();
 if(j.channel==='TELEGRAM'){const token=openIntegrationSecret(String(account.rows[0].token_encrypted));const meta=await http.json(new URL('https://api.telegram.org/bot'+token+'/getFile?file_id='+encodeURIComponent(String(j.reference))),['api.telegram.org'],'GET',{},undefined,{deadline});if(!meta.ok||meta.result?.file_id!==j.reference||!Number.isInteger(meta.result?.file_size)||meta.result.file_size<1||meta.result.file_size>5242880)throw Error();expectedSize=meta.result.file_size;const path=attachmentSource('TELEGRAM',meta.result.file_path).pathname;url=new URL('https://api.telegram.org/file/bot'+token+path)}else url=attachmentSource(String(j.channel),String(j.reference));
 }
 phase='DOWNLOAD_FAILED';const bytes=await http.bytes(url,[url.hostname],headers,deadline);if(Date.now()>=deadline)throw new ProviderTimeout();phase='SIZE_OR_TYPE';const mime=detectMedia(bytes),prefix=j.kind==='document'?'application/':j.kind+'/';if(!mime||!mime.startsWith(prefix)||expected&&expected!==mime||bytes.length>5242880||expectedSize!==undefined&&bytes.length!==expectedSize)throw Error();
 const asset=await storeMedia(db,t,'incoming-'+randomUUID(),bytes,String(j.conversation_id));await db.query("UPDATE chatbot_attachment_intakes SET status='STORED',reference='',media_id=$3,completed_at=now() WHERE tenant_id=$1 AND id=$2",[t,j.id,asset.id]);
 }catch(error){const timeout=Date.now()>=deadline||error instanceof ProviderTimeout;if(error instanceof ProviderFailure&&!timeout)phase=error.status===413?'SIZE_OR_TYPE':'DOWNLOAD_FAILED';const reason=timeout?'DEADLINE':phase;await db.query("UPDATE chatbot_attachment_intakes SET status=$3,reason=$4,reference='',completed_at=now() WHERE tenant_id=$1 AND id=$2",[t,j.id,timeout?'TIMEOUT':phase==='SOURCE_REJECTED'||phase==='SIZE_OR_TYPE'?'REJECTED':'FAILED',reason]);}
 return true;
}
export async function conversationMedia(db:SqlClient,a:Actor,cid:string){allow(a,['OWNER','MANAGER','AGENT','VIEWER']);if(!isUuid(cid))throw new HttpFailure(400,'Invalid conversation');const c=await db.query('SELECT 1 FROM conversations WHERE tenant_id=$1 AND id=$2',[a.tenantId,cid]);if(!c.rowCount)throw new HttpFailure(404,'Conversation unavailable');return {assets:(await db.query("SELECT id,name,mime,bytes,scan_status AS \"scanStatus\",scan_result AS \"scanResult\",created_at FROM chatbot_media WHERE tenant_id=$1 AND conversation_id=$2 AND status='ACTIVE' ORDER BY created_at DESC LIMIT 100",[a.tenantId,cid])).rows,intakes:(await db.query('SELECT id,channel,kind,status,reason,media_id AS "mediaId" FROM chatbot_attachment_intakes WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY created_at DESC LIMIT 100',[a.tenantId,cid])).rows}}
