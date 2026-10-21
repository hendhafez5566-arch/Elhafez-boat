import {respondToFlow} from './flow-service.js';
import {deliverConversation} from './channels.js';
import {recordFlowFailure} from './flow-observation.js';
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
 const inserted=await db.query('INSERT INTO chatbot_attachment_intakes(tenant_id,conversation_id,channel,account_id,source_key,kind,reference) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,channel,account_id,source_key) DO UPDATE SET source_key=EXCLUDED.source_key RETURNING id',[t,cid,input.channel,account,key,input.kind,input.reference]);return String(inserted.rows[0].id);
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
export async function conversationMedia(db:SqlClient,a:Actor,cid:string){allow(a,['OWNER','MANAGER','AGENT','VIEWER']);if(!isUuid(cid))throw new HttpFailure(400,'Invalid conversation');const c=await db.query('SELECT 1 FROM conversations WHERE tenant_id=$1 AND id=$2',[a.tenantId,cid]);if(!c.rowCount)throw new HttpFailure(404,'Conversation unavailable');return {assets:(await db.query("SELECT id,name,mime,bytes,scan_status AS \"scanStatus\",scan_result AS \"scanResult\",created_at FROM chatbot_media WHERE tenant_id=$1 AND conversation_id=$2 AND status='ACTIVE' ORDER BY created_at DESC LIMIT 100",[a.tenantId,cid])).rows,intakes:(await db.query('SELECT id,channel,kind,status,reason,media_id AS "mediaId",continuation_status AS "continuationStatus" FROM chatbot_attachment_intakes WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY created_at DESC LIMIT 100',[a.tenantId,cid])).rows}}

/** Completion uses the original engine, exact persisted waiting generation and existing input failure policy. */
export async function processIncomingMediaCompletion(db:SqlClient,t:string){
 const pending=await db.query(`SELECT j.id,j.conversation_id,c.contact_id FROM chatbot_attachment_intakes j JOIN conversations c ON c.tenant_id=j.tenant_id AND c.id=j.conversation_id LEFT JOIN chatbot_media m ON m.tenant_id=j.tenant_id AND m.id=j.media_id WHERE j.tenant_id=$1 AND j.completion_pending AND (j.status IN ('REJECTED','FAILED','TIMEOUT','CANCELLED') OR j.status='STORED' AND (m.scan_status<>'PENDING' OR m.status='DELETED' OR m.id IS NULL)) ORDER BY j.created_at LIMIT 1`,[t]);if(!pending.rowCount)return false;const p=pending.rows[0];
 const k=await db.query('SELECT status,do_not_contact FROM contacts WHERE tenant_id=$1 AND id=$2 FOR UPDATE SKIP LOCKED',[t,p.contact_id]);if(!k.rowCount)return false;
 const c=await db.query('SELECT status,channel,bot_control FROM conversations WHERE tenant_id=$1 AND id=$2 FOR UPDATE SKIP LOCKED',[t,p.conversation_id]);if(!c.rowCount)return false;
 const row=await db.query(`SELECT j.*,m.scan_status,m.status AS media_status,EXISTS(SELECT 1 FROM chatbot_flow_sessions s WHERE s.tenant_id=j.tenant_id AND s.conversation_id=j.conversation_id AND s.version=j.flow_version AND s.node_id=j.flow_node_id AND s.observation_token=j.flow_session_token) AS current_wait FROM chatbot_attachment_intakes j LEFT JOIN chatbot_media m ON m.tenant_id=j.tenant_id AND m.id=j.media_id WHERE j.tenant_id=$1 AND j.id=$2 AND j.completion_pending FOR UPDATE OF j`,[t,p.id]);if(!row.rowCount)return false;const j=row.rows[0];
 if(!j.current_wait||k.rows[0].status==='ARCHIVED'||k.rows[0].do_not_contact||c.rows[0].status!=='OPEN'||['PAUSED','STOPPED','HANDOFF'].includes(String((c.rows[0].bot_control as any)?.mode||''))){await db.query("UPDATE chatbot_attachment_intakes SET completion_pending=false,continuation_status='SKIPPED' WHERE tenant_id=$1 AND id=$2",[t,j.id]);return true}
 await db.query('SAVEPOINT attachment_completion');try{
 const clean=j.status==='STORED'&&j.scan_status==='CLEAN'&&j.media_status==='ACTIVE';
 const input={kind:'ATTACHMENT' as const,value:clean?JSON.stringify({channel:j.channel,kind:j.kind,reference:j.media_id}):''};
 const result=await respondToFlow(db,{tenantId:t,conversationId:String(j.conversation_id),contactId:String(p.contact_id),actionId:'',body:'',fromWhatsApp:c.rows[0].channel==='WHATSAPP',nativeInput:input,attachmentResumeId:String(j.id)});
 await deliverConversation(db,t,String(j.conversation_id),result.payloads,{staff:result.handedOff});await db.query("UPDATE chatbot_attachment_intakes SET completion_pending=false,continuation_status='DONE' WHERE tenant_id=$1 AND id=$2",[t,j.id]);await db.query('RELEASE SAVEPOINT attachment_completion');
 }catch(error){await db.query('ROLLBACK TO SAVEPOINT attachment_completion');await recordFlowFailure(db,error);await db.query("UPDATE chatbot_attachment_intakes SET completion_pending=false,continuation_status='FAILED' WHERE tenant_id=$1 AND id=$2",[t,j.id]);}
 return true;
}
