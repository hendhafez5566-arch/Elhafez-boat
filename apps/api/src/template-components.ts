/** Compile only supported, provider-approved template component shapes. */
import {HttpFailure} from './services.js';
type Part={type?:string;text?:string;format?:string;buttons?:{type:string;url?:string;text?:string}[];cards?:{components?:Part[]}[]};
export type CommerceProduct={catalogId:string;retailerId:string};
export type CarouselCardValues={mediaUrl?:string;itemId?:string;product?:CommerceProduct;body?:string[];buttons?:Record<string,string>};
export type TemplateValues={body?:string[];header?:string[];mediaUrl?:string;buttons?:Record<string,string>;cards?:CarouselCardValues[];itemId?:string;product?:CommerceProduct;catalog?:{thumbnailItemId:string;sections?:{title:string;itemIds:string[]}[]};commerce?:{thumbnail:CommerceProduct;sections:{title:string;products:CommerceProduct[]}[]};bodyNamed?:Record<string,string>;headerNamed?:Record<string,string>};
function variables(text=''){const matches=[...text.matchAll(/{{([^}]+)}}/g)].map(m=>m[1]);if(matches.some(x=>!/^\d+$/.test(x)))throw new HttpFailure(400,'Named template parameters are not supported');const unique=[...new Set(matches.map(Number))].sort((a,b)=>a-b);if(unique.some((x,i)=>x!==i+1)||unique.length>10)throw new HttpFailure(400,'Invalid template parameter numbering');return unique.length}
function textParams(values:unknown,count:number){if(values===undefined&&count===0)return [];if(!Array.isArray(values)||values.length!==count||values.some(x=>typeof x!=='string'||!x.trim()||x.length>1000))throw new HttpFailure(400,'Template values must match approved placeholders');return values.map(text=>({type:'text',text}))}
function https(value:unknown):string{if(typeof value!=='string'||value.length>2048)throw new HttpFailure(400,'Media HTTPS URL required');let u:URL;try{u=new URL(value)}catch{throw new HttpFailure(400,'Invalid media URL')}if(u.protocol!=='https:'||u.username||u.password)throw new HttpFailure(400,'Media HTTPS URL required');return value}

function productParam(p:CommerceProduct|undefined){if(!p||!/^\d{5,30}$/.test(p.catalogId)||typeof p.retailerId!=='string'||!p.retailerId||p.retailerId.length>100)throw new HttpFailure(400,'Verified product required');return {type:'product',product:{catalog_id:p.catalogId,product_retailer_id:p.retailerId}}}
function approvedParameters(text:string|undefined,positional:unknown,named?:Record<string,string>,limit=1024){
 const checked=(params:{type:string;text:string;parameter_name?:string}[])=>{const rendered=(text||'').replace(/{{([^}]+)}}/g,(_,key)=>params.find((p,i)=>p.parameter_name===key||!p.parameter_name&&String(i+1)===key)?.text||'');if(rendered.length>limit)throw new HttpFailure(400,'Rendered template text exceeds channel limit');return params};
 const names=[...new Set([...(text||'').matchAll(/{{([^}]+)}}/g)].map(m=>m[1]))];
 if(names.some(n=>!/^\d+$/.test(n))){if(names.some(n=>!/^[a-z][a-z0-9_]{0,31}$/.test(n))||names.length>10||!named||typeof named!=='object'||Array.isArray(named)||positional!==undefined&&(!Array.isArray(positional)||positional.length)||Object.keys(named).length!==names.length||names.some(n=>!Object.hasOwn(named,n)||typeof named[n]!=='string'||!named[n].trim()||named[n].length>1000))throw new HttpFailure(400,'Named parameters must match approved placeholders');return checked(names.map(n=>({type:'text',parameter_name:n,text:named[n]})));}
 if(named&&Object.keys(named).length)throw new HttpFailure(400,'Unexpected named parameter values');return checked(textParams(positional,variables(text)));
}

export function templateComponents(input:unknown,values:TemplateValues={}){
 if(!Array.isArray(input)||input.length>10||!values||typeof values!=='object'||Array.isArray(values))throw new HttpFailure(400,'Invalid template components');
 const componentTypes=(input as Part[]).map(p=>p?.type);if(new Set(componentTypes).size!==componentTypes.length)throw new HttpFailure(400,'Only one approved carousel/component of each type is supported');
 const rootProduct=(input as Part[]).some(p=>p?.type==='HEADER'&&p.format==='PRODUCT');
 if(rootProduct){const buttons=(input as Part[]).filter(p=>p?.type==='BUTTONS');if(buttons.length!==1||buttons[0].buttons?.length!==1||buttons[0].buttons[0].type!=='SPM'||(input as Part[]).some(p=>p?.type==='CAROUSEL'))throw new HttpFailure(400,'SPM requires one product header and View button');}
 if((input as Part[]).some(p=>p?.type==='CAROUSEL')&&(values.product||values.itemId||values.mediaUrl||values.header?.length))throw new HttpFailure(400,'Unexpected top-level carousel header values');
 const result:Record<string,unknown>[]=[];let sawBody=false,sawHeader=false,sawCarousel=false,sawProduct=false,sawCommerce=false;const buttonKeys=new Set<string>();
 for(const part of input as Part[]){
  if(!part||!['BODY','HEADER','FOOTER','BUTTONS','CAROUSEL'].includes(String(part.type)))throw new HttpFailure(400,'Unsupported template component: authentication/provider format is not enabled');
  if(part.type==='BODY'){sawBody=true;const parameters=approvedParameters(part.text,values.body,values.bodyNamed,rootProduct?160:1024);if(parameters.length)result.push({type:'body',parameters})}
  if(part.type==='HEADER'){
   sawHeader=true;
   if(part.format==='TEXT'){const parameters=approvedParameters(part.text,values.header,values.headerNamed,60);if(parameters.length)result.push({type:'header',parameters});if(values.mediaUrl)throw new HttpFailure(400,'Text header cannot contain media')}
   else if(part.format==='PRODUCT'){sawProduct=true;if(values.mediaUrl||values.header?.length)throw new HttpFailure(400,'Product headers cannot override media/text');result.push({type:'header',parameters:[productParam(values.product)]})}
   else if(['IMAGE','VIDEO','DOCUMENT'].includes(String(part.format))){if(values.header?.length)throw new HttpFailure(400,'Media header cannot contain text parameters');const kind=String(part.format).toLowerCase();result.push({type:'header',parameters:[{type:kind,[kind]:{link:https(values.mediaUrl)}}]})}
   else throw new HttpFailure(400,'Unsupported template header');
  }
  if(part.type==='FOOTER'&&variables(part.text))throw new HttpFailure(400,'Footer variables unsupported');
  if(part.type==='CAROUSEL'){
    if(sawCarousel)throw new HttpFailure(400,'Only one approved carousel is supported');
    sawCarousel=true;
    if(!Array.isArray(part.cards)||part.cards.length<2||part.cards.length>10)
      throw new HttpFailure(400,'Approved carousel must define 2–10 cards');
    const productCards=part.cards.some(c=>c.components?.some(p=>p.type==='HEADER'&&p.format==='PRODUCT'));
    if(productCards){
     if(!Array.isArray(values.cards)||values.cards.length<2||values.cards.length>10)throw new HttpFailure(400,'Product carousel requires 2–10 selected products');
     const structures=part.cards.map(c=>{const parts=c.components||[],header=parts.filter(p=>p.type==='HEADER'),buttons=parts.filter(p=>p.type==='BUTTONS');if(parts.length!==2||header.length!==1||header[0].format!=='PRODUCT'||buttons.length!==1||buttons[0].buttons?.length!==1||!['SPM','URL'].includes(buttons[0].buttons[0].type))throw new HttpFailure(400,'Unsupported product carousel card structure');return buttons[0].buttons[0];});
     if(structures.some(b=>JSON.stringify(b)!==JSON.stringify(structures[0])))throw new HttpFailure(400,'Product carousel cards must have the same buttons');
     const seen=new Set<string>(),catalogs=new Set<string>();
     const cards=values.cards.map((v,i)=>{if(v.mediaUrl||v.body?.length)throw new HttpFailure(400,'Product cards use catalog media; body overrides unsupported');const parameter=productParam(v.product),p=v.product!;if(seen.has(p.retailerId))throw new HttpFailure(400,'Duplicate product carousel card');seen.add(p.retailerId);catalogs.add(p.catalogId);const components:Record<string,unknown>[]=[{type:'header',parameters:[parameter]}],b=structures[0],value=v.buttons?.['0'];
      if(Object.keys(v.buttons||{}).some(k=>k!=='0'))throw new HttpFailure(400,'Unexpected product card button');
      if(b.type==='URL'&&variables(b.url)){if(variables(b.url)!==1||typeof value!=='string'||!value.trim()||value.length>200)throw new HttpFailure(400,'Dynamic product URL suffix required');components.push({type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:value}]})}else if(value!==undefined)throw new HttpFailure(400,'Unexpected product button value');
      return {card_index:i,components};});
     if(catalogs.size!==1)throw new HttpFailure(400,'Products must use the same catalog');sawProduct=true;result.push({type:'carousel',cards});continue;
    }
    if(!Array.isArray(values.cards)||values.cards.length!==part.cards.length)
      throw new HttpFailure(400,'Supply approved card values for every carousel card');
    const cards=part.cards.map((templateCard,index)=>{
      if(!templateCard||!Array.isArray(templateCard.components)||templateCard.components.length<2||templateCard.components.length>4)
        throw new HttpFailure(400,'Invalid approved carousel card');
      const value=values.cards![index];
      if(!value||typeof value!=='object'||Array.isArray(value))
        throw new HttpFailure(400,'Invalid card values');
      if(value.product||value.itemId)throw new HttpFailure(400,'Media carousel cannot contain product parameters');
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
          const parameters=approvedParameters(cmp.text,value.body,undefined,160);
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
    if(b.type==='CATALOG'||b.type==='MPM'){
     if(sawCommerce||index!==0||part.buttons.length!==1||v!==undefined||!values.commerce)throw new HttpFailure(400,'Select products for the approved catalog/MPM button');sawCommerce=true;
     const c=values.commerce;productParam(c.thumbnail);const action:Record<string,unknown>={thumbnail_product_retailer_id:c.thumbnail.retailerId};
     if(b.type==='MPM'){if(!Array.isArray(c.sections)||!c.sections.length||c.sections.length>10)throw new HttpFailure(400,'MPM needs 1–10 sections');let count=0;const seen=new Set<string>();action.sections=c.sections.map(section=>{if(typeof section.title!=='string'||!section.title.trim()||section.title.length>24||!Array.isArray(section.products)||!section.products.length)throw new HttpFailure(400,'Invalid MPM section');return {title:section.title,product_items:section.products.map(p=>{productParam(p);if(p.catalogId!==c.thumbnail.catalogId||seen.has(p.retailerId))throw new HttpFailure(400,'Mixed catalogs or duplicate MPM product');seen.add(p.retailerId);count++;return {product_retailer_id:p.retailerId}})}});if(count>30||!seen.has(c.thumbnail.retailerId))throw new HttpFailure(400,'MPM allows at most 30 products; thumbnail must be selected');}else if(c.sections?.length)throw new HttpFailure(400,'Catalog button does not accept product sections');
     result.push({type:'button',sub_type:b.type.toLowerCase(),index:0,parameters:[{type:'action',action}]});
    }else if(b.type==='SPM'){if(index!==0||part.buttons.length!==1||!sawProduct||v!==undefined)throw new HttpFailure(400,'SPM button requires a product header');}
    else if(b.type==='URL'){
     const n=variables(b.url);if(n>1)throw new HttpFailure(400,'Only one dynamic URL suffix supported');if(n){if(typeof v!=='string'||!v.trim()||v.length>200)throw new HttpFailure(400,'Dynamic URL button suffix required');result.push({type:'button',sub_type:'url',index:String(index),parameters:[{type:'text',text:v}]})}else if(v!==undefined)throw new HttpFailure(400,'Static URL button does not accept a parameter');
    }else if(b.type==='QUICK_REPLY'){if(v!==undefined){if(typeof v!=='string'||!v||v.length>128)throw new HttpFailure(400,'Invalid quick reply payload');result.push({type:'button',sub_type:'quick_reply',index:String(index),parameters:[{type:'payload',payload:v}]})}}
    else if(b.type!=='PHONE_NUMBER'||v!==undefined)throw new HttpFailure(400,'Unsupported template button');
   }
  }
 }
 if(!sawProduct&&(values.product||values.itemId)||!sawCommerce&&(values.commerce||values.catalog)||!sawBody&&values.bodyNamed&&Object.keys(values.bodyNamed).length||!sawHeader&&values.headerNamed&&Object.keys(values.headerNamed).length)throw new HttpFailure(400,'Unexpected product or named values');
 if(!sawCarousel&&values.cards!==undefined||!sawBody&&values.body?.length||!sawHeader&&(values.header?.length||values.mediaUrl)||Object.keys(values.buttons||{}).some(k=>!buttonKeys.has(k)))throw new HttpFailure(400,'Unexpected template values');
 return result;
}
