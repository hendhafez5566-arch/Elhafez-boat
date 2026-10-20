import type {FlowDefinition,FlowChannel} from './flow-engine.js';
export type FlowIssue={severity:'error'|'warning';nodeId?:string;code:string;message:string};
export const channelCapabilities={WHATSAPP:{buttons:3,listRows:10,urlButtons:1,mixedUrl:false},WEBSITE:{buttons:3,listRows:10,urlButtons:3,mixedUrl:true},TELEGRAM:{buttons:3,listRows:10,urlButtons:3,mixedUrl:true},MESSENGER:{buttons:3,listRows:10,urlButtons:3,mixedUrl:true},INSTAGRAM:{buttons:3,listRows:10,urlButtons:0,mixedUrl:false}} as const;
export function flowChannelIssues(flow:FlowDefinition,channel:FlowChannel=flow.channel||'WHATSAPP'):FlowIssue[]{
 const issues:FlowIssue[]=[],cap=channelCapabilities[channel];
 if(flow.forms?.length)issues.push({severity:'warning',code:'FORM_DRAFT_ONLY',message:'النماذج مسودات داخلية فقط؛ لا توجد مراجع Meta معتمدة أو إرسال حي.'});
 for(const node of flow.nodes){
  if(node.type==='BUTTONS'||node.type==='LIST'){
   const urls=node.choices.filter(c=>c.action==='URL'),replies=node.choices.length-urls.length;
   if(channel==='MESSENGER'&&urls.length&&node.text.length>640)issues.push({severity:'error',nodeId:node.id,code:'CHANNEL_BUTTON_TEXT',message:'نص رسالة أزرار الروابط في Messenger لا يتجاوز 640 حرفًا.'});
   if(urls.length&&(node.type==='LIST'||urls.length>cap.urlButtons||!cap.mixedUrl&&replies>0))issues.push({severity:'error',nodeId:node.id,code:'CHANNEL_URL_BUTTONS',message:channel+' لا يدعم هذا المزيج من أزرار الروابط والردود.'});
  }
  if(node.type==='INPUT'&&node.validation?.type==='location')issues.push({severity:'warning',nodeId:node.id,code:'LOCATION_TEXT_FALLBACK',message:'الموقع يُجمع كإحداثيات نصية؛ لا يوجد طلب موقع أصلي لهذه الخطوة.'});
  if(node.type==='AI')issues.push({severity:'warning',nodeId:node.id,code:'AI_PROVIDER_READINESS',message:'المحاكاة تستخدم Mock؛ جاهزية مزود AI تحتاج فحصًا منفصلًا.'});
 }
 return issues;
}
