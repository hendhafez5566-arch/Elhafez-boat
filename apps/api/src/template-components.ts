/** Compile only supported, provider-approved template component shapes. */
import {HttpFailure} from './services.js';
type Part={type?:string;text?:string;format?:string;buttons?:{type:string;url?:string;text?:string}[];cards?:{components?:Part[]}[]};
export type CarouselCardValues={mediaUrl:string;body?:string[];buttons?:Record<string,string>};
export type TemplateValues={body?:string[];header?:string[];mediaUrl?:string;buttons?:Record<string,string>;cards?:CarouselCardValues[]};
function variables(text=''){const matches=[...text.matchAll(/{{([^}]+)}}/g)].map(m=>m[1]);if(matches.some(x=>!/^\d+$/.test(x)))throw new HttpFailure(400,'Named template parameters are not supported');const unique=[...new Set(matches.map(Number))].sort((a,b)=>a-b);if(unique.some((x,i)=>x!==i+1)||unique.length>10)throw new HttpFailure(400,'Invalid template parameter numbering');return unique.length}
function textParams(values:unknown,count:number){if(values===undefined&&count===0)return [];if(!Array.isArray(values)||values.length!==count||values.some(x=>typeof x!=='string'||!x.trim()||x.length>1000))throw new HttpFailure(400,'Template values must match approved placeholders');return values.map(text=>({type:'text',text}))}
function https(value:unknown):string{if(typeof value!=='string'||value.length>2048)throw new HttpFailure(400,'Media HTTPS URL required');let u:URL;try{u=new URL(value)}catch{throw new HttpFailure(400,'Invalid media URL')}if(u.protocol!=='https:'||u.username||u.password)throw new HttpFailure(400,'Media HTTPS URL required');return value}
export function templateComponents(input:unknown,values:TemplateValues={}){
 if(!Array.isArray(input)||input.length>10||!values||typeof values!=='object'||Array.isArray(values))throw new HttpFailure(400,'Invalid template components');
 const result:Record<string,unknown>[]=[];let sawBody=false,sawHeader=false,sawCarousel=false;const buttonKeys=new Set<string>();
 for(const part of input as Part[]){
  if(!part||!['BODY','HEADER','FOOTER','BUTTONS','CAROUSEL'].includes(String(part.type)))throw new HttpFailure(400,'Unsupported template component: authentication and catalog templates are not enabled');
  if(part.type==='BODY'){sawBody=true;const parameters=textParams(values.body,variables(part.text));if(parameters.length)result.push({type:'body',parameters})}
  if(part.type==='HEADER'){
   sawHeader=true;
   if(part.format==='TEXT'){const parameters=textParams(values.header,variables(part.text));if(parameters.length)result.push({type:'header',parameters});if(values.mediaUrl)throw new HttpFailure(400,'Text header cannot contain media')}
   else if(['IMAGE','VIDEO','DOCUMENT'].includes(String(part.format))){if(values.header?.length)throw new HttpFailure(400,'Media header cannot contain text parameters');const kind=String(part.format).toLowerCase();result.push({type:'header',parameters:[{type:kind,[kind]:{link:https(values.mediaUrl)}}]})}
   else throw new HttpFailure(400,'Unsupported template header');
  }
  if(part.type==='FOOTER'&&variables(part.text))throw new HttpFailure(400,'Footer variables unsupported');
  if(part.type==='CAROUSEL'){
    if(sawCarousel)throw new HttpFailure(400,'Only one approved carousel is supported');
    sawCarousel=true;
    if(!Array.isArray(part.cards)||part.cards.length<2||part.cards.length>10)
      throw new HttpFailure(400,'Approved carousel must define 2–10 cards');
    if(!Array.isArray(values.cards)||values.cards.length!==part.cards.length)
      throw new HttpFailure(400,'Supply approved card values for every carousel card');
    const cards=part.cards.map((templateCard,index)=>{
      if(!templateCard||!Array.isArray(templateCard.components)||templateCard.components.length<2||templateCard.components.length>4)
        throw new HttpFailure(400,'Invalid approved carousel card');
      const value=values.cards![index];
      if(!value||typeof value!=='object'||Array.isArray(value))
        throw new HttpFailure(400,'Invalid card values');
      const built:Record<string,unknown>[]=[];let header=false,body=false,buttons=false;
      const used=new Set<string>();
      for(const cmp of templateCard.components){
        if(cmp.type==='HEADER'){
          if(header||!['IMAGE','VIDEO'].includes(String(cmp.format)))throw new HttpFailure(400,'Unsupported carousel media header');
          header=true;const kind=String(cmp.format).toLowerCase();
          built.push({type:'header',parameters:[{type:kind,[kind]:{link:https(value.mediaUrl)}}]});
        }else if(cmp.type==='BODY'){
          if(body)throw new HttpFailure(400,'Duplicate carousel card body');
          body=true;
          const parameters=textParams(value.body,variables(cmp.text));
          if(parameters.length)built.push({type:'body',parameters});
        }else if(cmp.type==='BUTTONS'){
          if(buttons||!Array.isArray(cmp.buttons)||cmp.buttons.length>2||cmp.buttons.length<1)
            throw new HttpFailure(400,'Carousel supports only up to two approved card buttons');
          buttons=true;
          for(const [buttonIndex,btn] of cmp.buttons.entries()){
            const v=value.buttons?.[String(buttonIndex)];used.add(String(buttonIndex));
            if(btn.type==='QUICK_REPLY'){
              if(v!==undefined){
                if(typeof v!=='string'||v.length<1||v.length>128)throw new HttpFailure(400,'Invalid carousel quick-reply payload');
                built.push({type:'button',sub_type:'quick_reply',index:String(buttonIndex),parameters:[{type:'payload',payload:v}]});
              }
            }else if(btn.type==='URL'){
              const count=variables(btn.url);
              if(count>1)throw new HttpFailure(400,'Only one dynamic carousel URL suffix supported');
              if(count){
                if(typeof v!=='string'||!v.trim()||v.length>200)throw new HttpFailure(400,'Carousel URL parameter required');
                built.push({type:'button',sub_type:'url',index:String(buttonIndex),parameters:[{type:'text',text:v}]});
              }else if(v!==undefined)throw new HttpFailure(400,'Unexpected static carousel URL parameter');
            }else if(btn.type!=='PHONE_NUMBER'||v!==undefined){
              throw new HttpFailure(400,'Unsupported carousel button type');
            }
          }
        }else throw new HttpFailure(400,'Unsupported approved carousel card component');
      }
      if(!header||!body||!buttons)throw new HttpFailure(400,'Carousel card requires header, body and buttons');
      if(Object.keys(value.buttons||{}).some(k=>!used.has(k)))
        throw new HttpFailure(400,'Unexpected carousel card button values');
      return {card_index:index,components:built};
    });
    result.push({type:'carousel',cards});
  }

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
 if(!sawCarousel&&values.cards!==undefined||!sawBody&&values.body?.length||!sawHeader&&(values.header?.length||values.mediaUrl)||Object.keys(values.buttons||{}).some(k=>!buttonKeys.has(k)))throw new HttpFailure(400,'Unexpected template values');
 return result;
}
