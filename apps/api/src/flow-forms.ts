/** Internal form drafts only; these are not Meta Flow JSON or approved provider assets. */
export type FlowFormDraft={id:string;title:string;screens:{id:string;title:string;fields:{key:string;label:string;type:'text'|'email'|'number';required:boolean}[];next?:string}[]};
const key=/^[a-z][a-z0-9_]{0,31}$/;
export function validateFormDrafts(raw:unknown):asserts raw is FlowFormDraft[]{
 if(!Array.isArray(raw)||raw.length>10)throw Error('Maximum 10 internal form drafts');const ids=new Set();
 for(const f of raw){if(!f||typeof f!=='object'||typeof f.id!=='string'||!key.test(f.id)||ids.has(f.id)||typeof f.title!=='string'||!f.title.trim()||f.title.length>80||!Array.isArray(f.screens)||!f.screens.length||f.screens.length>10)throw Error('Invalid internal form');ids.add(f.id);const screens=new Set(),fields=new Set();
  for(const s of f.screens){if(!s||typeof s.id!=='string'||!key.test(s.id)||screens.has(s.id)||typeof s.title!=='string'||!s.title.trim()||s.title.length>80||!Array.isArray(s.fields)||s.fields.length>10)throw Error('Invalid form screen');screens.add(s.id);
   for(const field of s.fields){if(!field||typeof field.key!=='string'||!key.test(field.key)||fields.has(field.key)||typeof field.label!=='string'||!field.label.trim()||field.label.length>80||!['text','email','number'].includes(field.type)||typeof field.required!=='boolean')throw Error('Invalid form field');fields.add(field.key)}
  }
  // Linear, fully reachable screens. Provider data exchange/actions deliberately absent.
  for(const [i,s]of f.screens.entries())if(s.next!==(f.screens[i+1]?.id))throw Error('Form screens must follow their declared order');
 }
}

/** Pinned official-component JSON subset; only Meta can validate/approve an actual asset. No data exchange endpoint. */
export function compileWhatsAppForm(input:unknown){validateFormDrafts([input]);const form=input as FlowFormDraft,fields:{key:string;label:string;type:string;required:boolean}[]=[],routing:Record<string,string[]>={},screens=[];
 for(const [i,s]of form.screens.entries()){const id=s.id.toUpperCase(),terminal=i===form.screens.length-1,prior=[...fields];routing[id]=terminal?[]:[form.screens[i+1].id.toUpperCase()];const payload=Object.fromEntries([...prior.map(f=>[f.key,'${data.'+f.key+'}']),...s.fields.map(f=>[f.key,'${form.'+f.key+'}'])]);screens.push({id,title:s.title,...(terminal?{terminal:true,success:true}:{}),data:Object.fromEntries(prior.map(f=>[f.key,{type:'string',__example__:'SYNTHETIC'}])),layout:{type:'SingleColumnLayout',children:[{type:'Form',name:'form',children:[...s.fields.map(f=>({type:'TextInput',name:f.key,label:f.label,'input-type':f.type==='text'?'text':f.type,required:f.required})),{type:'Footer',label:terminal?'إرسال':'التالي','on-click-action':terminal?{name:'complete',payload}:{name:'navigate',next:{type:'screen',name:form.screens[i+1].id.toUpperCase()},payload}}]}]}});fields.push(...s.fields)}
 return {json:{version:'7.3',routing_model:routing,screens},qualification:'LOCAL_PINNED_COMPONENT_SUBSET',requiresMetaValidation:true,approved:false,providerAssetId:null,dataExchange:false};
}
