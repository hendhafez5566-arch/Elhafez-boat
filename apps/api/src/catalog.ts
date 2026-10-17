/** Approved informational catalog. No ordering, stock or payment operations. */
import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
import {normalizeQuestion} from './knowledge.js';
export function catalogInput(input:unknown){
 const d=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const value=(key:string,max:number,required=false)=>{const v=d[key]??'';if(typeof v!=='string'||v.length>max||(required&&v.trim().length<2))throw new HttpFailure(400,'Invalid '+key);return v.trim()};
 const kind=value('kind',20);if(!['PRODUCT','SERVICE','OFFER','OTHER'].includes(kind))throw new HttpFailure(400,'Invalid catalog kind');
 const result={kind,title:value('title',160,true),categoryLabel:value('categoryLabel',80),description:value('description',1500),priceText:value('priceText',100),imageUrl:value('imageUrl',2048),externalUrl:value('externalUrl',2048)};
 for(const u of [result.imageUrl,result.externalUrl])if(u){let url:URL;try{url=new URL(u)}catch{throw new HttpFailure(400,'Invalid URL')}if(url.protocol!=='https:'||url.username||url.password)throw new HttpFailure(400,'HTTPS URL required')}
 return result;
}
const columns=`id,kind,title,category_label AS "categoryLabel",description,price_text AS "priceText",image_url AS "imageUrl",external_url AS "externalUrl",status,updated_at AS "updatedAt"`;
export async function listCatalog(db:SqlClient,actor:Actor){allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);return (await db.query(`SELECT ${columns} FROM chatbot_catalog_items WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 500`,[actor.tenantId])).rows}
export async function createCatalog(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER','MANAGER']);const d=catalogInput(input);
 return (await db.query(`INSERT INTO chatbot_catalog_items(tenant_id,kind,title,category_label,description,price_text,image_url,external_url,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${columns}`,[actor.tenantId,d.kind,d.title,d.categoryLabel,d.description,d.priceText,d.imageUrl,d.externalUrl,actor.userId])).rows[0];
}
export async function updateCatalog(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid item');const d=catalogInput(input);
 const r=await db.query(`UPDATE chatbot_catalog_items SET kind=$3,title=$4,category_label=$5,description=$6,price_text=$7,image_url=$8,external_url=$9,status='DRAFT',updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING ${columns}`,[actor.tenantId,id,d.kind,d.title,d.categoryLabel,d.description,d.priceText,d.imageUrl,d.externalUrl]);if(!r.rowCount)throw new HttpFailure(404,'Item not found');return r.rows[0];
}
export async function changeCatalogStatus(db:SqlClient,actor:Actor,id:string,status:'PUBLISHED'|'ARCHIVED'){
 allow(actor,['OWNER','MANAGER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid item');
 const r=await db.query(`UPDATE chatbot_catalog_items SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING ${columns}`,[actor.tenantId,id,status]);if(!r.rowCount)throw new HttpFailure(404,'Item not found');
 await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,$3,'catalog',$4)`,[actor.tenantId,actor.userId,'CATALOG_'+status,id]);return r.rows[0];
}
export async function findPublishedCatalogAnswer(db:SqlClient,tenantId:string,incoming:string){
 const r=await db.query(`SELECT id,title,description,price_text,external_url FROM chatbot_catalog_items WHERE tenant_id=$1 AND status='PUBLISHED' ORDER BY updated_at DESC LIMIT 500`,[tenantId]);
 const q=normalizeQuestion(incoming);const item=r.rows.find(i=>normalizeQuestion(String(i.title))===q);
 return item?{id:String(item.id),text:[item.title,item.description,item.price_text,item.external_url].filter(Boolean).join('\n')}:null;
}
