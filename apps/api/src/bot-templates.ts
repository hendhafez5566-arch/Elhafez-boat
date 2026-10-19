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
