import {validateFlow,type FlowDefinition} from './flow-engine.js';
import {HttpFailure} from './services.js';
/** Explicit offline contract. Never imports a provider, reads credentials or publishes. */
export function mockFlowAssistance(input:unknown){
 const d=input as {mode?:unknown;task?:unknown;text?:unknown;tone?:unknown};
 if(!d||d.mode!=='MOCK'||!['DRAFT','REWRITE'].includes(String(d.task))||typeof d.text!=='string'||!d.text.trim()||d.text.length>4096)throw new HttpFailure(400,'Use explicit MOCK mode and a bounded draft or rewrite request');
 const text=d.text.trim();
 if(d.task==='DRAFT'){
  const definition:FlowDefinition=validateFlow({name:text.slice(0,80),startId:'start',nodes:[{id:'start',type:'START',next:'welcome'},{id:'welcome',type:'TEXT',text:'أهلًا بك. فريقنا يساعدك بخصوص: '+text.slice(0,500),next:'need'},{id:'need',type:'INPUT',text:'كيف يمكن لفريقنا مساعدتك؟',field:'customer_need',next:'handoff'},{id:'handoff',type:'HANDOFF',text:'شكرًا لك. سيستكمل الفريق التفاصيل معك.'}]});
  return {mode:'MOCK',providerCalled:false,requiresReview:true,definition,summary:'مسودة ثابتة محلية للاختبار؛ لا تتضمن حقائق أو أسعارًا عن الشركة.'};
 }
 if(!['CLEAR','FRIENDLY'].includes(String(d.tone)))throw new HttpFailure(400,'Choose CLEAR or FRIENDLY tone');
 const normalized=text.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n');
 const greeting='مرحبًا بك 👋\n',friendly=d.tone==='FRIENDLY'&&normalized.length+greeting.length<=4096;
 return {mode:'MOCK',providerCalled:false,requiresReview:true,text:(friendly?greeting:'')+normalized,summary:'اقتراح محلي: ترتيب المسافات'+(friendly?' وإضافة تحية.':'.')+' لا يوجد نموذج AI متصل.'};
}
