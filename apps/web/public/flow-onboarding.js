/**
 * Guided bot setup for non-technical company owners.
 * Pure flow generation uses only the existing validated flow nodes; no provider calls.
 * Applying a template updates the draft editor only. Saving/publishing is always explicit.
 */
const sectors={
 general:{title:'نشاط عام',first:'الخدمات',second:'العروض',example:'الخدمة المطلوبة'},
 tourism:{title:'سياحة ورحلات',first:'برامج السياحة',second:'برامج العمرة',example:'البرنامج وموعد السفر'},
 shop:{title:'متجر',first:'المنتجات',second:'العروض',example:'المنتج والمقاس'},
 clinic:{title:'عيادة',first:'الخدمات',second:'ساعات العمل',example:'الخدمة والموعد المفضل'},
 restaurant:{title:'مطعم أو كافيه',first:'المنيو',second:'العروض',example:'الطلب أو الاستفسار'},
 realestate:{title:'عقارات',first:'العقارات',second:'مواعيد المعاينة',example:'المنطقة والميزانية'},
 education:{title:'تعليم وكورسات',first:'الكورسات',second:'مواعيد الدراسة',example:'الكورس المناسب'}
};
const goals={
 leads:{title:'تجميع عملاء مهتمين',hint:'اسأل العميل عن احتياجه وبيانات تواصله، ثم سلّم الطلب للموظف.',first:'تسجيل اهتمام'},
 catalog:{title:'عرض المنتجات والخدمات',hint:'اعرض الكتالوج المعتمد ثم اجمع الاستفسار، من غير اختراع أسعار.',first:'عرض الكتالوج'},
 support:{title:'خدمة العملاء',hint:'اعرض الخدمات واجمع السؤال أو حوّل المحادثة إلى موظف.',first:'عندي سؤال'}
};
export const guidedSectors=Object.freeze(sectors);
export const guidedGoals=Object.freeze(goals);


/** Plain-language shortcut, deterministic/offline: suggestions, never an LLM claim. */
export function inferQuickSetup(description=''){
 const text=String(description).trim().toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');
 if(text.length<8)throw new Error('اكتب وصفًا بسيطًا في سطر واحد على الأقل');
 const matches=[
  ['tourism',/سياح|سفر|رحل|عمره|حج|فندق|تأشير/],
  ['clinic',/عياد|دكتور|طب|كشف|مريض/],
  ['restaurant',/مطعم|كافيه|اكل|منيو|وجبات/],
  ['realestate',/عقار|شقق|شقه|ايجار|وحدات/],
  ['education',/كورسات|دروس|تعليم|مدرس|تدريب/],
  ['shop',/متجر|محل|منتج|ملابس|تجاره|سوق/]
 ];
 const industry=matches.find(([_,matcher])=>matcher.test(text))?.[0]||'general';
 const goal=/موظف|دعم|خدمه عملاء|استفسار|سؤال|مشكل/.test(text)?'support':
  /عرض|برامج|منتجات|كتالوج|منيو|عروض|اسعار/.test(text)?'catalog':'leads';
 return {industry,goal,source:'KEYWORD_SUGGESTION'};
}

export function buildGuidedFlow(options={}){
 const industry=Object.hasOwn(sectors,options.industry)?options.industry:'general';
 const goal=Object.hasOwn(goals,options.goal)?options.goal:'leads';
 const sector=sectors[industry];
 const businessName=String(options.businessName||'شركتنا').trim().slice(0,80);
 const title=String(options.botName||'مساعد '+businessName).trim().slice(0,100);
 const category=String(options.category||'').trim().slice(0,80);
 if(businessName.length<2||title.length<2)throw new Error('اكتب اسم الشركة والبوت من حرفين على الأقل');
 const collectPhone=options.collectPhone!==false;
 const menuChoices=goal==='catalog'
  ?[{id:'browse',title:sector.first,next:'catalog'},{id:'interest',title:'اسأل عن التفاصيل',next:'need'},{id:'agent',title:'موظف',next:'handoff'}]
  :goal==='support'
  ?[{id:'ask',title:'عندي سؤال',next:'need'},{id:'browse',title:sector.first,next:'catalog'},{id:'agent',title:'موظف',next:'handoff'}]
  :[{id:'interest',title:'تسجيل اهتمام',next:'need'},{id:'browse',title:sector.first,next:'catalog'},{id:'agent',title:'موظف',next:'handoff'}];
 const nodes=[
  {id:'start',type:'START',next:'welcome'},
  {id:'welcome',type:'TEXT',text:'أهلًا بحضرتك في '+businessName+' 👋\nأنا المساعد الافتراضي. هساعدك بمعلومات الشركة المعتمدة، أو أوصلك بموظف.',next:'menu'},
  {id:'menu',type:'BUTTONS',text:'تحب نساعدك إزاي؟',choices:menuChoices},
  {id:'catalog',type:'CATALOG',category,next:'need'},
  {id:'need',type:'INPUT',field:'customer_need',text:goal==='support'?'اكتب سؤالك بالتفصيل عشان نوصلك بالشخص المناسب.':'إيه اللي محتاج تعرفه؟ مثال: '+sector.example,next:'contactname'},
  {id:'contactname',type:'INPUT',field:'customer_name',text:'تحب نسجل طلبك باسم مين؟',next:collectPhone?'contactphone':'qualify'},
  ...(collectPhone?[{id:'contactphone',type:'INPUT',field:'customer_phone',text:'اكتب رقم تليفون للتواصل (اختياري لو حابب ترد هنا).',next:'qualify'}]:[]),
  {id:'qualify',type:'TAG',tag:'interested',next:'handoff'},
  {id:'handoff',type:'HANDOFF',text:'شكرًا لك. تم تسجيل اهتمامك، وفريق '+businessName+' هيكمل معاك من هنا.'}
 ];
 const layout=Object.fromEntries(nodes.map((n,i)=>[n.id,{x:40+(i%3)*300,y:40+Math.floor(i/3)*240}]));
 return {name:title,startId:'start',nodes,layout};
}

const make=(tag,cls='',text='')=>{
 const element=document.createElement(tag);
 if(cls)element.className=cls;
 if(text)element.textContent=text;
 return element;
};
const field=(label,control)=>{
 const wrap=make('label','guide-field');
 wrap.append(make('span','',label),control);
 return wrap;
};
const optionsToSelect=(items,value)=>{
 const select=make('select');for(const [key,item] of Object.entries(items)){
  const o=make('option','',item.title);o.value=key;select.append(o);
 }
 select.value=value;return select;
};
const action=(text,handler,cls='secondary')=>{
 const b=make('button',cls,text);b.type='button';b.onclick=handler;return b;
};

/**
 * Accessible 3-step assistant: goal -> business data -> inspect before applying.
 * Existing drafts/published flows cannot be overwritten without explicit confirmation.
 */
export function mountGuidedWizard({host,onGenerate,onNotice,isEditingSubflow}){
 const state={step:0,industry:'general',goal:'leads',businessName:'',botName:'',category:'',collectPhone:true,description:''};
 const root=make('section','boat-guide');
 root.setAttribute('aria-label','معالج إنشاء البوت');
 const hero=make('div','boat-guide-hero');
 const heading=make('div');heading.append(make('h3','','ابدأ بوت احترافي في 3 خطوات'),make('p','','مش محتاج تتعلم البلوكات. اختار هدفك، اكتب بيانات شركتك، وبعدها جرّب المحادثة قبل النشر.'));
 const toggle=action('ابدأ المعالج ←',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)render();},'primary');
 toggle.setAttribute('aria-expanded','false');hero.append(heading,toggle);root.append(hero);
 const panel=make('div','boat-guide-panel');panel.hidden=true;
 const progress=make('ol','boat-guide-progress');progress.setAttribute('aria-label','خطوات إنشاء البوت');
 const body=make('div','boat-guide-body');body.setAttribute('aria-live','polite');
 const controls=make('div','boat-guide-actions');
 panel.append(progress,body,controls);root.append(panel);host.append(root);
 const setStep=n=>{state.step=Math.max(0,Math.min(2,n));render()};
 function render(){
  progress.replaceChildren();body.replaceChildren();controls.replaceChildren();
  for(const [index,label] of ['اختار هدف البوت','بيانات النشاط','راجع وأنشئ المسودة'].entries()){
   const item=make('li',index===state.step?'active':index<state.step?'done':'',label);
   if(index<state.step)item.append(action('تعديل',()=>setStep(index),'boat-guide-step-link'));
   progress.append(item);
  }
  if(state.step===0){
   body.append(make('h4','','إيه المهمة الأساسية اللي تحب البوت يعملها؟'));
   const quick=make('div','boat-guide-quick');
   quick.append(make('strong','','مش عارف تبدأ منين؟ احكي عن البوت اللي محتاجه'));
   const description=make('textarea');description.rows=2;description.maxLength=600;
   description.placeholder='مثال: أنا شركة سياحة وعايز بوت يعرض برامج العمرة ويجمع بيانات العملاء ويحوّلهم لموظف';
   description.value=state.description;description.oninput=()=>{state.description=description.value};
   quick.append(description,action('اقترح نشاط وهدف البوت من الوصف',()=>{
    try{
     const suggestion=inferQuickSetup(state.description);
     state.industry=suggestion.industry;state.goal=suggestion.goal;
     onNotice('اقترحنا إعدادًا اعتمادًا على كلمات وصفك. راجعه وعدله قبل المتابعة.');
     render();
    }catch(error){onNotice(error.message,'error')}
   },'secondary'));
   quick.append(make('p','boat-guide-hint','الاقتراح محلي وبسيط؛ مش محتاج ربط ذكاء اصطناعي ومش بيكتب معلومات من عنده.'));
   body.append(quick);
   const options=make('div','boat-guide-goals');
   for(const [key,info] of Object.entries(goals)){
    const control=make('button','boat-guide-goal'+(state.goal===key?' selected':''));
    control.type='button';control.setAttribute('aria-pressed',String(state.goal===key));
    control.append(make('strong','',info.title),make('span','',info.hint));
    control.onclick=()=>{state.goal=key;render()};
    options.append(control);
   }
   body.append(options);
   const hint=make('p','boat-guide-hint','كل الأهداف فيها خيار «التحدث مع موظف»؛ ومفيش أي إرسال للخارج أثناء الإعداد.');
   body.append(hint);
  }else if(state.step===1){
   body.append(make('h4','','احكي لنا عن الشركة'));
   const industry=optionsToSelect(sectors,state.industry);industry.onchange=()=>{state.industry=industry.value;state.category='';};
   const name=make('input');name.type='text';name.maxLength=80;name.required=true;name.placeholder='مثال: شركة النور للسياحة';name.value=state.businessName;name.oninput=()=>{state.businessName=name.value};
   const botName=make('input');botName.type='text';botName.maxLength=100;botName.placeholder='مثال: مساعد خدمة العملاء';botName.value=state.botName;botName.oninput=()=>{state.botName=botName.value};
   const category=make('input');category.maxLength=80;category.placeholder='اختياري — اتركه فارغًا لعرض كل العناصر المنشورة';category.value=state.category;category.oninput=()=>{state.category=category.value};
   const phone=make('input');phone.type='checkbox';phone.checked=state.collectPhone;phone.onchange=()=>{state.collectPhone=phone.checked};
   const phoneLabel=make('label','boat-guide-check');phoneLabel.append(phone,make('span','','اسأل العميل عن رقم تواصل (من غير تحقق آلي من الرقم)'));
   body.append(field('نوع النشاط',industry),field('اسم الشركة اللي هيشوفه العميل',name),field('اسم البوت داخل لوحة التحكم',botName),field('تصنيف الكتالوج — اختياري',category),phoneLabel);
   body.append(make('p','boat-guide-hint','المنتجات والأسعار لازم تدخلها في الكتالوج وتنشرها بنفسك؛ المعالج مش هيخترع بيانات.'));
  }else{
   let draft;
   try{draft=buildGuidedFlow(state)}catch(error){body.append(make('p','boat-guide-error',error.message));}
   if(draft){
    const sector=sectors[state.industry],goal=goals[state.goal];
    body.append(make('h4','','دي رحلة العميل اللي هتتجهز'));
    const steps=make('ol','boat-guide-map');
    for(const message of ['ترحيب باسم '+state.businessName,'قائمة: '+draft.nodes.find(n=>n.id==='menu').choices.map(c=>c.title).join(' / '),'كتالوج '+(state.category||'كل العناصر المنشورة'),'سؤال عن الاحتياج والاسم'+(state.collectPhone?' ورقم التواصل':''),'تصنيف «مهتم» ثم تحويل إلى موظف']){
     steps.append(make('li','',message));
    }
    body.append(steps,make('p','boat-guide-hint','الخطوة التالية بتجهز مسودة داخل المصمم فقط. مفيش حفظ أو نشر أو ربط منصات تلقائيًا.'));
   }
  }
  if(state.step>0)controls.append(action('السابق',()=>setStep(state.step-1)));
  if(state.step<2)controls.append(action('التالي ←',()=>{
    if(state.step===1&&state.businessName.trim().length<2){onNotice('اكتب اسم الشركة أولًا','error');return}
    setStep(state.step+1);
   },'primary'));
  else controls.append(action('إنشاء مسودة البوت',()=>{
   if(isEditingSubflow()){onNotice('ارجع للمسار الرئيسي قبل استخدام المعالج','error');return}
   let draft;try{draft=buildGuidedFlow(state)}catch(error){onNotice(error.message,'error');return}
   if(onGenerate(draft)!==false){panel.hidden=true;toggle.setAttribute('aria-expanded','false');onNotice('البوت جاهز في المصمم. جرب المعاينة، ثم احفظ المسودة وانشرها باختيارك.');}
  },'primary'));
 }
 return {open(){panel.hidden=false;toggle.setAttribute('aria-expanded','true');render()},reset(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');state.step=0;}};
}
