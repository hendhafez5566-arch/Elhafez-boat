import {HttpFailure} from './services.js';
import {validateFlow} from './flow-engine.js';
import type {FlowDefinition} from './flow-engine.js';
export const botTemplates=[
 {id:'blank',name:'ابدأ من الصفر',description:'خطوة بداية واحدة؛ أضف ما يحتاجه نشاطك.'},
 {id:'service',name:'خدمة العملاء',description:'ترحيب وثلاثة اختيارات ومحادثة مع موظف.'},
 {id:'lead',name:'جمع بيانات التواصل',description:'اسأل عن الاسم والهاتف ثم سلّم الطلب للموظف.'}
];
export function botTemplate(id:string,name:string):FlowDefinition{
 const start={id:'start',type:'START' as const,next:id==='blank'?'unconnected':'welcome'};
 if(id==='blank')return {name,startId:'start',nodes:[start]};
 if(id==='lead')return {name,startId:'start',nodes:[start,
 {id:'welcome',type:'TEXT',text:'أهلًا بك. اترك بيانات التواصل وسيتابع معك فريقنا.',next:'name'},
 {id:'name',type:'INPUT',field:'customer_name',text:'ما اسمك؟',next:'phone'},
 {id:'phone',type:'INPUT',field:'customer_phone',text:'ما رقم الهاتف الذي نتواصل معك عليه؟',next:'handoff'},
 {id:'handoff',type:'HANDOFF',text:'تم تسجيل طلب التواصل وتحويله إلى الموظف.'}]};
 return {name,startId:'start',nodes:[start,
 {id:'welcome',type:'TEXT',text:'أهلًا وسهلًا! كيف نقدر نساعدك؟',next:'menu'},
 {id:'menu',type:'BUTTONS',text:'اختر ما يناسبك:',choices:[{id:'info',title:'معلومات النشاط',next:'information'},{id:'contact',title:'اترك بياناتك',next:'name'},{id:'agent',title:'تحدث مع موظف',next:'handoff'}]},
 {id:'information',type:'TEXT',text:'أضف هنا معلومات نشاطك المعتمدة قبل ربط البوت بالقنوات.',next:'menu'},
 {id:'name',type:'INPUT',field:'customer_name',text:'ما اسمك؟',next:'phone'},
 {id:'phone',type:'INPUT',field:'customer_phone',text:'ما رقم الهاتف الذي نتواصل معك عليه؟',next:'handoff'},
 {id:'handoff',type:'HANDOFF',text:'وصل طلبك إلى فريق العمل للمتابعة.'}]};
}

/** Preview and creation share the same deterministic, validated configuration. */
export function prepareBotTemplate(input:unknown){
 const d=input as {name?:unknown;templateId?:unknown;setup?:unknown};
 if(!d||typeof d.name!=='string'||!d.name.trim()||d.name.trim().length>100)throw new HttpFailure(400,'Bot name must contain 1–100 characters');
 const templateId=d.templateId??'blank';if(!botTemplates.some(t=>t.id===templateId))throw new HttpFailure(400,'Unknown bot template');
 const raw=d.setup===undefined?{}:d.setup;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new HttpFailure(400,'Invalid bot setup');
 const setup=raw as {businessName?:unknown;greeting?:unknown;collectPhone?:unknown};
 if(setup.businessName!==undefined&&(typeof setup.businessName!=='string'||!setup.businessName.trim()||setup.businessName.length>80))throw new HttpFailure(400,'Business name must contain 1–80 characters');
 if(setup.greeting!==undefined&&(typeof setup.greeting!=='string'||!setup.greeting.trim()||setup.greeting.length>4096))throw new HttpFailure(400,'Greeting must contain 1–4096 characters');
 if(setup.collectPhone!==undefined&&typeof setup.collectPhone!=='boolean')throw new HttpFailure(400,'Invalid phone collection choice');
 const name=d.name.trim(),definition=botTemplate(String(templateId),name.length<2?'بوت '+name:name);
 const welcome=definition.nodes.find(n=>n.id==='welcome');
 if(welcome&&welcome.type==='TEXT')welcome.text=typeof setup.greeting==='string'?setup.greeting.trim():typeof setup.businessName==='string'?'أهلًا بك في '+setup.businessName.trim()+'! كيف نقدر نساعدك؟':welcome.text;
 if(setup.collectPhone===false){definition.nodes=definition.nodes.filter(n=>n.id!=='phone');for(const n of definition.nodes)if('next'in n&&n.next==='phone')n.next='handoff';}
 try{return {name,definition:validateFlow(definition,{draft:templateId==='blank'})}}catch(e){throw new HttpFailure(400,e instanceof Error?e.message:'Invalid bot setup')}
}
