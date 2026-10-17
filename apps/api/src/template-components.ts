/** Compile only supported, provider-approved template component shapes. */
import {HttpFailure} from './services.js';
type Part={type?:string;text?:string;format?:string;buttons?:{type:string;url?:string;text?:string}[]};
export type TemplateValues={body?:string[];header?:string[];mediaUrl?:string;buttons?:Record<string,string>};
function variables(text=''){const matches=[...text.matchAll(/{{([^}]+)}}/g)].map(m=>m[1]);if(matches.some(x=>!/^\d+$/.test(x)))throw new HttpFailure(400,'Named template parameters are not supported');const unique=[...new Set(matches.map(Number))].sort((a,b)=>a-b);if(unique.some((x,i)=>x!==i+1)||unique.length>10)throw new HttpFailure(400,'Invalid template parameter numbering');return unique.length}
function textParams(values:unknown,count:number){if(values===undefined&&count===0)return [];if(!Array.isArray(values)||values.length!==count||values.some(x=>typeof x!=='string'||!x.trim()||x.length>1000))throw new HttpFailure(400,'Template values must match approved placeholders');return values.map(text=>({type:'text',text}))}
function https(value:unknown):string{if(typeof value!=='string'||value.length>2048)throw new HttpFailure(400,'Media HTTPS URL required');let u:URL;try{u=new URL(value)}catch{throw new HttpFailure(400,'Invalid media URL')}if(u.protocol!=='https:'||u.username||u.password)throw new HttpFailure(400,'Media HTTPS URL required');return value}
export function templateComponents(input:unknown,values:TemplateValues={}){
 if(!Array.isArray(input)||input.length>10||!values||typeof values!=='object'||Array.isArray(values))throw new HttpFailure(400,'Invalid template components');
 const result:Record<string,unknown>[]=[];let sawBody=false,sawHeader=false;const buttonKeys=new Set<string>();
 for(const part of input as Part[]){
  if(!part||!['BODY','HEADER','FOOTER','BUTTONS'].includes(String(part.type)))throw new HttpFailure(400,'Unsupported template component; carousel and authentication are not enabled');
  if(part.type==='BODY'){sawBody=true;const parameters=textParams(values.body,variables(part.text));if(parameters.length)result.push({type:'body',parameters})}
  if(part.type==='HEADER'){
   sawHeader=true;
   if(part.format==='TEXT'){const parameters=textParams(values.header,variables(part.text));if(parameters.length)result.push({type:'header',parameters});if(values.mediaUrl)throw new HttpFailure(400,'Text header cannot contain media')}
   else if(['IMAGE','VIDEO','DOCUMENT'].includes(String(part.format))){if(values.header?.length)throw new HttpFailure(400,'Media header cannot contain text parameters');const kind=String(part.format).toLowerCase();result.push({type:'header',parameters:[{type:kind,[kind]:{link:https(values.mediaUrl)}}]})}
   else throw new HttpFailure(400,'Unsupported template header');
  }
  if(part.type==='FOOTER'&&variables(part.text))throw new HttpFailure(400,'Footer variables unsupported');
  if(part.type==='BUTTONS'){
   if(!Array.isArray(part.buttons)||part.buttons.length>10)throw new HttpFailure(400,'Invalid approved buttons');
   for(const [index,b] of part.buttons.entries()){
    const v=values.buttons?.[String(index)];buttonKeys.add(String(index));
    if(b.type==='URL'){
     const n=variables(b.url);if(n>1)throw new HttpFailure(400,'Only one dynamic URL suffix supported');if(n){if(typeof v!=='string'||!v.trim()||v.length>200)throw new HttpFailure(400,'Dynamic URL button suffix required');result.push({type:'button',sub_type:'url',index:String(index),parameters:[{type:'text',text:v}]})}else if(v!==undefined)throw new HttpFailure(400,'Static URL button does not accept a parameter');
    }else if(b.type==='QUICK_REPLY'){if(v!==undefined){if(typeof v!=='string'||!v||v.length>128)throw new HttpFailure(400,'Invalid quick reply payload');result.push({type:'button',sub_type:'quick_reply',index:String(index),parameters:[{type:'payload',payload:v}]})}}
    else if(b.type!=='PHONE_NUMBER'||v!==undefined)throw new HttpFailure(400,'Unsupported template button');
   }
  }
 }
 if(!sawBody&&values.body?.length||!sawHeader&&(values.header?.length||values.mediaUrl)||Object.keys(values.buttons||{}).some(k=>!buttonKeys.has(k)))throw new HttpFailure(400,'Unexpected template values');
 return result;
}
