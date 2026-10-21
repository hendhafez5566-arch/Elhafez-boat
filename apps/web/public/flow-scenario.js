/** Memory-only simulation tapes: symbolic callbacks rebind to each new challenge/wait. */
export function scenarioInput(input,eventKind,node){
 if(eventKind==='TIMEOUT')return {nodeId:node?.id||null,timeout:true};
 if(node?.type==='CONSENT'&&typeof input==='string'&&/^consent:[^:]+:(accept|decline|withdraw)$/.test(input))return {nodeId:node.id,consent:input.split(':').at(-1)};
 return {nodeId:node?.id||null,input:input??null,eventKind:eventKind??null};
}
export function replayInput(step,state){
 if((state.at||null)!==step.nodeId)throw Error('تغيرت خطوة السيناريو؛ ابدأ تجربة جديدة.');
 if(step.timeout){if(!state.runtime?.wait?.token)throw Error('لا توجد مهلة لإعادة تشغيل هذه الخطوة.');return [state.runtime.wait.token,'TIMEOUT']}
 if(step.consent){if(!state.runtime?.consent?.token)throw Error('لا توجد مطالبة موافقة حالية.');return ['consent:'+state.runtime.consent.token+':'+step.consent,undefined]}
 return [step.input===null?undefined:step.input,step.eventKind||undefined];
}
export function scenarioOutcome(result){
 const messages=(result.messages||[]).map(m=>({type:m.type,text:m.text,mediaKind:m.mediaKind,url:m.url,cards:m.cards,inputRequest:m.inputRequest,choices:m.choices?.map(c=>({title:c.title,description:c.description,url:c.url,action:c.action}))}));
 return JSON.stringify({at:result.state.at,answers:result.state.answers,tags:result.state.tags,attempts:result.state.runtime?.attempts,experiments:result.state.runtime?.experiments,wait:result.waiting?{kind:result.waiting.kind,next:result.waiting.next,expiresAt:result.waiting.expiresAt}:undefined,messages,handoff:result.handoff,finished:result.finished,botAction:result.botAction,deliveryMock:result.deliveryMock,trace:(result.trace||[]).map(t=>({nodeId:t.nodeId,type:t.type,outcome:t.outcome}))});
}
export function personaValues(raw){
 let value;try{value=JSON.parse(raw||'{}')}catch{throw Error('بيانات الشخصية يجب أن تكون JSON صحيحًا.');}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>100||Object.entries(value).some(([k,v])=>!/^[a-z][a-z0-9_]{0,39}$/.test(k)||typeof v!=='string'||v.length>500))throw Error('أدخل حتى 100 حقل نصي، وقيمة حتى 500 حرف، بمعرّفات الحقول الصحيحة.');
 return value;
}
