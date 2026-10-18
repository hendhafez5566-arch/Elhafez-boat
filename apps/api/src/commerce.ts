/** Meta Commerce is a provider integration, never a local order/payment system. */
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {providerHTTP} from './provider-http.js';
import {whatsappToken} from './templates.js';
import {templateComponents,type TemplateValues,type CommerceProduct} from './template-components.js';
const metaId=(v:unknown):v is string=>typeof v==='string'&&/^\d{5,30}$/.test(v);
const version=()=>{const v=process.env.META_GRAPH_VERSION||'';if(!/^v\d{1,2}\.\d{1,2}$/.test(v))throw new HttpFailure(503,'META_GRAPH_VERSION required');return v};
async function account(db:SqlClient,t:string,id:string){if(!isUuid(id))throw new HttpFailure(400,'Invalid account');const r=await db.query("SELECT id,waba_id,phone_number_id,access_token_encrypted FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2 AND status='CONNECTED'",[t,id]);if(!r.rowCount)throw new HttpFailure(409,'WhatsApp account disconnected');return r.rows[0]}
async function graph(a:Record<string,unknown>,path:string,params:Record<string,string>={}){const url=new URL('https://graph.facebook.com/'+version()+'/'+path);for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);try{return await providerHTTP(url,['graph.facebook.com'],'GET',{authorization:'Bearer '+whatsappToken(String(a.access_token_encrypted))})}catch{throw new HttpFailure(502,'Meta commerce verification unavailable or permission denied')}}
async function linkedCatalog(a:Record<string,unknown>,catalogId:string,readGraph:typeof graph=graph){if(!metaId(catalogId))throw new HttpFailure(400,'Invalid Meta catalog');const result=await readGraph(a,String(a.waba_id)+'/product_catalogs',{fields:'id',limit:'100'});if(!Array.isArray(result.data)||!result.data.some((c:{id?:unknown})=>c.id===catalogId))throw new HttpFailure(409,'Catalog is not connected to this WhatsApp business account');const phones=await readGraph(a,String(a.waba_id)+'/phone_numbers',{fields:'id',limit:'100'});if(!Array.isArray(phones.data)||!phones.data.some((p:{id?:unknown})=>p.id===a.phone_number_id))throw new HttpFailure(409,'Phone does not belong to the catalog business account')}
export async function commerceResources(db:SqlClient,a:Actor,input:{accountId:string;catalogId?:string;after?:string}){
 allow(a,['OWNER','MANAGER']);const wa=await account(db,a.tenantId,input.accountId);
 if(!input.catalogId){const result=await graph(wa,String(wa.waba_id)+'/product_catalogs',{fields:'id,name',limit:'100'});return {data:result.data||[]};}
 await linkedCatalog(wa,input.catalogId);if(input.after&&(typeof input.after!=='string'||input.after.length>2048))throw new HttpFailure(400,'Invalid cursor');
 const result=await graph(wa,input.catalogId+'/products',{fields:'id,name,retailer_id',return_only_approved_products:'true',limit:'100',...(input.after?{after:input.after}:{})});
 // Provider paging URLs may contain credentials. Only opaque cursors cross this boundary.
 return {data:result.data||[],after:result.paging?.next?result.paging?.cursors?.after||null:null};
}
export async function listCommerceLinks(db:SqlClient,a:Actor){allow(a,['OWNER','MANAGER']);return (await db.query(`SELECT l.item_id AS "itemId",l.account_id AS "accountId",l.catalog_id AS "catalogId",l.product_id AS "productId",l.retailer_id AS "retailerId",l.enabled,l.verified_at AS "verifiedAt",i.title FROM chatbot_commerce_links l JOIN chatbot_catalog_items i ON i.tenant_id=l.tenant_id AND i.id=l.item_id WHERE l.tenant_id=$1 ORDER BY l.verified_at DESC LIMIT 500`,[a.tenantId])).rows}
export async function saveCommerceLink(db:SqlClient,a:Actor,input:unknown){
 allow(a,['OWNER']);const d=input as {itemId:string;accountId:string;catalogId:string;productId:string;enabled?:boolean};if(!d||!isUuid(d.itemId)||!isUuid(d.accountId)||!metaId(d.catalogId)||!metaId(d.productId)||d.enabled!==undefined&&typeof d.enabled!=='boolean')throw new HttpFailure(400,'Invalid commerce mapping');
 const item=await db.query("SELECT id FROM chatbot_catalog_items WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED'",[a.tenantId,d.itemId]);if(!item.rowCount)throw new HttpFailure(409,'Publish the approved local item first');
 const wa=await account(db,a.tenantId,d.accountId);await linkedCatalog(wa,d.catalogId);const product=await verifiedProduct(wa,d.catalogId,d.productId);
 await db.query(`INSERT INTO chatbot_commerce_links(tenant_id,item_id,account_id,catalog_id,product_id,retailer_id,enabled,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant_id,item_id,account_id) DO UPDATE SET catalog_id=$4,product_id=$5,retailer_id=$6,enabled=$7,verified_at=now(),created_by=$8`,[a.tenantId,d.itemId,d.accountId,d.catalogId,d.productId,product.retailerId,d.enabled??true,a.userId]);
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'COMMERCE_MAPPING_SAVED','catalog',$3)`,[a.tenantId,a.userId,d.itemId]);return {saved:true};
}
export async function disableCommerceLink(db:SqlClient,a:Actor,itemId:string,accountId:string){allow(a,['OWNER']);if(!isUuid(itemId)||!isUuid(accountId))throw new HttpFailure(400,'Invalid mapping');await db.query('UPDATE chatbot_commerce_links SET enabled=false WHERE tenant_id=$1 AND item_id=$2 AND account_id=$3',[a.tenantId,itemId,accountId]);await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'COMMERCE_MAPPING_DISABLED','catalog',$3)`,[a.tenantId,a.userId,itemId]);return {disabled:true}}
async function verifiedProduct(wa:Record<string,unknown>,catalogId:string,productId:string,readGraph:typeof graph=graph):Promise<CommerceProduct>{
 const p=await readGraph(wa,productId,{fields:'id,retailer_id,product_catalog{id},review_status'});if(p.id!==productId||p.product_catalog?.id!==catalogId||String(p.review_status).toUpperCase()!=='APPROVED'||typeof p.retailer_id!=='string'||!p.retailer_id||p.retailer_id.length>100)throw new HttpFailure(409,'Product is not approved in the connected catalog');return {catalogId,retailerId:p.retailer_id};
}
export type CommerceRef={itemId:string;catalogId:string;productId:string;retailerId:string};
export async function verifyCommerceRefs(db:SqlClient,t:string,accountId:string,refs:CommerceRef[],readGraph:typeof graph=graph){
 if(!Array.isArray(refs)||refs.length>31)throw new HttpFailure(400,'Invalid commerce references');if(!refs.length)return;
 const wa=await account(db,t,accountId),catalogs=new Set<string>(),checks:CommerceRef[]=[];for(const ref of refs){if(!ref||!isUuid(ref.itemId)||!metaId(ref.catalogId)||!metaId(ref.productId))throw new HttpFailure(400,'Invalid commerce reference');
 const r=await db.query(`SELECT l.retailer_id FROM chatbot_commerce_links l JOIN chatbot_catalog_items i ON i.tenant_id=l.tenant_id AND i.id=l.item_id WHERE l.tenant_id=$1 AND l.account_id=$2 AND l.item_id=$3 AND l.catalog_id=$4 AND l.product_id=$5 AND l.enabled=true AND i.status='PUBLISHED'`,[t,accountId,ref.itemId,ref.catalogId,ref.productId]);if(!r.rowCount||r.rows[0].retailer_id!==ref.retailerId)throw new HttpFailure(409,'Commerce mapping revoked or item is no longer published');
 catalogs.add(ref.catalogId);checks.push(ref);}
 if(catalogs.size!==1)throw new HttpFailure(400,'All products must belong to the same connected catalog');
 await linkedCatalog(wa,[...catalogs][0],readGraph);
 await Promise.all(checks.map(async ref=>{const p=await verifiedProduct(wa,ref.catalogId,ref.productId,readGraph);if(p.retailerId!==ref.retailerId)throw new HttpFailure(409,'Meta product identity changed')}));
 const settings=await readGraph(wa,String(wa.phone_number_id)+'/whatsapp_commerce_settings');if(!Array.isArray(settings.data)||settings.data[0]?.is_catalog_visible!==true)throw new HttpFailure(409,'Meta catalog visibility is not enabled for this phone');
}
/** Public clients send local catalog UUIDs only; provider product parameters are server-owned. */
export async function prepareCommerceTemplate(db:SqlClient,t:string,accountId:string,parts:unknown,raw:TemplateValues={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.product||raw.commerce||raw.cards!==undefined&&(!Array.isArray(raw.cards)||raw.cards.some(c=>!c||typeof c!=='object'||c.product)))throw new HttpFailure(400,'Only local catalog item references are accepted');
 const values:TemplateValues=JSON.parse(JSON.stringify(raw)),refs:CommerceRef[]=[];
 async function resolve(id:unknown){if(!isUuid(id))throw new HttpFailure(400,'Select a published mapped catalog item');const r=await db.query(`SELECT l.catalog_id,l.product_id,l.retailer_id FROM chatbot_commerce_links l JOIN chatbot_catalog_items i ON i.tenant_id=l.tenant_id AND i.id=l.item_id WHERE l.tenant_id=$1 AND l.account_id=$2 AND l.item_id=$3 AND l.enabled=true AND i.status='PUBLISHED'`,[t,accountId,id]);if(!r.rowCount)throw new HttpFailure(409,'Product mapping unavailable in this company/account');const row=r.rows[0],ref={itemId:id,catalogId:String(row.catalog_id),productId:String(row.product_id),retailerId:String(row.retailer_id)};if(!refs.some(r=>r.itemId===id))refs.push(ref);return {catalogId:ref.catalogId,retailerId:ref.retailerId};}
 if(values.itemId)values.product=await resolve(values.itemId);
 if(values.cards){if(!Array.isArray(values.cards)||values.cards.length>10)throw new HttpFailure(400,'Invalid carousel cards');for(const c of values.cards)if(c.itemId)c.product=await resolve(c.itemId);}
 if(values.catalog){const c=values.catalog;if(!c||typeof c!=='object'||Array.isArray(c))throw new HttpFailure(400,'Invalid catalog selection');const thumbnail=await resolve(c.thumbnailItemId);const sections=[];if(c.sections){if(!Array.isArray(c.sections)||c.sections.length>10||c.sections.reduce((n,s)=>n+(Array.isArray(s?.itemIds)?s.itemIds.length:0),0)>30)throw new HttpFailure(400,'Invalid product sections');for(const section of c.sections){if(!section||!Array.isArray(section.itemIds)||section.itemIds.length>30)throw new HttpFailure(400,'Invalid product section');const products=[];for(const id of section.itemIds)products.push(await resolve(id));sections.push({title:section.title,products});}}values.commerce={thumbnail,sections};}
 const components=templateComponents(parts,values);await verifyCommerceRefs(db,t,accountId,refs);return {components,refs};
}

export function commerceInterestReferences(message:unknown):{catalogId:string;retailerIds:string[]}|null{
 const m=message as {type?:unknown;order?:{catalog_id?:unknown;product_items?:{product_retailer_id?:unknown}[]};context?:{referred_product?:{catalog_id?:unknown;product_retailer_id?:unknown}}};
 if(!m||typeof m!=='object')return null;const o=m.type==='order'?m.order:undefined,p=m.context?.referred_product,catalogId=o?.catalog_id||p?.catalog_id;
 const ids=o?(Array.isArray(o.product_items)?o.product_items.map(x=>x?.product_retailer_id):[]):(p?[p.product_retailer_id]:[]);
 if(!metaId(catalogId)||!Array.isArray(ids)||!ids.length||ids.length>30||ids.some(id=>typeof id!=='string'||!id||id.length>100))return null;
 return {catalogId,retailerIds:[...new Set(ids as string[])]};
}
export async function recordCommerceInterest(db:SqlClient,t:string,accountId:string,conversationId:string,contactId:string,message:unknown){
 const refs=commerceInterestReferences(message);if(!refs)return false;
 const items=await db.query(`SELECT i.id,i.title FROM chatbot_commerce_links l JOIN chatbot_catalog_items i ON i.tenant_id=l.tenant_id AND i.id=l.item_id WHERE l.tenant_id=$1 AND l.account_id=$2 AND l.catalog_id=$3 AND l.retailer_id=ANY($4::text[]) AND l.enabled=true AND i.status='PUBLISHED'`,[t,accountId,refs.catalogId,refs.retailerIds]);
 const {registerInterest,readyForAgent}=await import('./chatbot-leads.js');const lead=await registerInterest(db,t,conversationId,contactId,null);
 await db.query(`UPDATE chatbot_leads SET catalog_item_id=coalesce($3::uuid,catalog_item_id),custom_fields=custom_fields||$4::jsonb,updated_at=now() WHERE tenant_id=$1 AND id=$2`,[t,lead,items.rows[0]?.id||null,JSON.stringify({meta_catalog_interest:items.rows.map(i=>i.title).join('، ').slice(0,500)||'استفسار عن منتجات غير مرتبطة محليًا',meta_interest_review:'اهتمام عميل فقط؛ الأسعار والتنفيذ يراجعهما الموظف'})]);
 await readyForAgent(db,t,lead,conversationId,null);await db.query("UPDATE chatbot_delay_jobs SET status='CANCELLED' WHERE tenant_id=$1 AND conversation_id=$2 AND status='PENDING'",[t,conversationId]);
 await db.query(`INSERT INTO audit_events(tenant_id,action,entity_type,entity_id) VALUES($1,'META_CATALOG_INTEREST_HANDOFF','chatbot_lead',$2)`,[t,lead]);return true;
}
