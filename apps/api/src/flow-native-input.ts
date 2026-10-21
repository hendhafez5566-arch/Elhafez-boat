/** Provider references are data only: never fetched, scanned, served or marked safe as assets here. */
import type {FlowChannel,FlowInput} from './flow-engine.js';
export type Acquisition={kind:'LOCATION'|'ATTACHMENT'|'PHONE'|'EMAIL';unsupportedNext:string};
export type AttachmentReference={channel:FlowChannel;kind:'image'|'video'|'audio'|'document';reference:string};
export const nativeInputCapabilities={WHATSAPP:{nativeLocation:true,nativeAttachments:true,nativeProfileReplies:false},TELEGRAM:{nativeLocation:true,nativeAttachments:true,nativeProfileReplies:false},WEBSITE:{nativeLocation:false,nativeAttachments:true,nativeProfileReplies:false},MESSENGER:{nativeLocation:false,nativeAttachments:true,nativeProfileReplies:true},INSTAGRAM:{nativeLocation:false,nativeAttachments:true,nativeProfileReplies:false}} as const;
export function supportsAcquisition(channel:FlowChannel,kind:Acquisition['kind']):boolean{
 const cap=nativeInputCapabilities[channel];return kind==='LOCATION'?cap.nativeLocation:kind==='ATTACHMENT'?cap.nativeAttachments:cap.nativeProfileReplies;
}
export function attachmentReference(value:string):AttachmentReference|undefined{
 try{const r=JSON.parse(value);if(!r||Object.keys(r).some(k=>!['channel','kind','reference'].includes(k))||!['WHATSAPP','TELEGRAM','MESSENGER','INSTAGRAM','WEBSITE'].includes(r.channel)||!['image','video','audio','document'].includes(r.kind)||typeof r.reference!=='string'||r.reference.length<1||r.reference.length>350||/[\u0000-\u001f]/.test(r.reference))return;
 if(r.channel==='WEBSITE'){if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(r.reference))return;}else if(['WHATSAPP','TELEGRAM'].includes(r.channel)){if(!/^[a-zA-Z0-9_-]+$/.test(r.reference))return;}else{const u=new URL(r.reference);if(u.protocol!=='https:'||u.username||u.password)return;}
 return r;}catch{return;}
}
export function nativeLocation(latitude:unknown,longitude:unknown):FlowInput|undefined{
 if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return;
 return {kind:'LOCATION',value:latitude+', '+longitude};
}
export function nativeAttachment(channel:AttachmentReference['channel'],kind:string,reference:unknown):FlowInput|undefined{
 if(typeof reference!=='string')return;const value=JSON.stringify({channel,kind,reference});return value.length<=500&&attachmentReference(value)?{kind:'ATTACHMENT',value}:undefined;
}
