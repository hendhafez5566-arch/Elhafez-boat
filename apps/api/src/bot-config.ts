import { allow, HttpFailure, type Actor, type SqlClient } from './services.js';

const categories=['UMRAH','HAJJ','DOMESTIC','INTERNATIONAL'] as const;
type Category=typeof categories[number];
export type BotConfig={displayName:string;welcomeText:string;enabledCategories:Category[]};
const defaultWelcome='أهلًا وسهلًا بيك 👋\nنحن في خدمتك لمساعدتك تختار رحلتك المناسبة.\nاختار القسم من القائمة:';
function normalized(value: unknown):BotConfig {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpFailure(400,'Invalid bot settings');
  const d=value as Record<string,unknown>;
  const displayName=typeof d.displayName==='string'?d.displayName.trim():'';
  const welcomeText=typeof d.welcomeText==='string'?d.welcomeText.trim():'';
  const enabledCategories=d.enabledCategories;
  if(displayName.length<2||displayName.length>120)throw new HttpFailure(400,'Company display name must be 2-120 characters');
  if(welcomeText.length<10||welcomeText.length>500)throw new HttpFailure(400,'Welcome text must be 10-500 characters');
  if(!Array.isArray(enabledCategories)||enabledCategories.length<1||enabledCategories.length>4||
    enabledCategories.some(x=>typeof x!=='string'||!categories.includes(x as Category))||
    new Set(enabledCategories).size!==enabledCategories.length)throw new HttpFailure(400,'Invalid menu category selection');
  return {displayName,welcomeText,enabledCategories:enabledCategories as Category[]};
}
const defaultConfig=(company:string):BotConfig=>({displayName:company,welcomeText:defaultWelcome,enabledCategories:[...categories]});
export async function botConfig(db:SqlClient,actor:Actor){
  allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
  const company=await db.query('SELECT name,slug FROM tenants WHERE id=$1',[actor.tenantId]);
  if(company.rowCount!==1)throw new HttpFailure(404,'Company not found');
  const draft=await db.query(`SELECT display_name AS "displayName",welcome_text AS "welcomeText",enabled_categories AS "enabledCategories",draft_revision AS "draftRevision",updated_at AS "updatedAt"
    FROM tenant_bot_drafts WHERE tenant_id=$1`,[actor.tenantId]);
  const latest=await db.query(`SELECT version,config,published_at AS "publishedAt" FROM tenant_bot_versions
    WHERE tenant_id=$1 ORDER BY version DESC LIMIT 1`,[actor.tenantId]);
  return {companyName:company.rows[0].name,tenantSlug:company.rows[0].slug,draft:draft.rows[0]??{...defaultConfig(String(company.rows[0].name)),draftRevision:0},published:latest.rows[0]??null};
}
export async function saveBotDraft(db:SqlClient,actor:Actor,input:unknown){
  allow(actor,['OWNER','MANAGER']);
  const config=normalized(input);
  const r=await db.query(`INSERT INTO tenant_bot_drafts(tenant_id,display_name,welcome_text,enabled_categories,updated_by)
    VALUES($1,$2,$3,$4::jsonb,$5)
    ON CONFLICT(tenant_id) DO UPDATE SET display_name=EXCLUDED.display_name,welcome_text=EXCLUDED.welcome_text,
    enabled_categories=EXCLUDED.enabled_categories,draft_revision=tenant_bot_drafts.draft_revision+1,
    updated_at=now(),updated_by=EXCLUDED.updated_by
    RETURNING draft_revision AS "draftRevision"`,[actor.tenantId,config.displayName,config.welcomeText,JSON.stringify(config.enabledCategories),actor.userId]);
  await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'BOT_DRAFT_SAVED','bot','menu')`,[actor.tenantId,actor.userId]);
  return {saved:true,draftRevision:r.rows[0].draftRevision};
}
export async function publishBotDraft(db:SqlClient,actor:Actor){
  allow(actor,['OWNER','MANAGER']);
  const found=await db.query(`SELECT display_name,welcome_text,enabled_categories,draft_revision FROM tenant_bot_drafts
    WHERE tenant_id=$1 FOR UPDATE`,[actor.tenantId]);
  if(found.rowCount!==1)throw new HttpFailure(409,'Save menu draft before publishing');
  const d=found.rows[0];
  const config=normalized({displayName:d.display_name,welcomeText:d.welcome_text,enabledCategories:d.enabled_categories});
  const version=await db.query(`INSERT INTO tenant_bot_versions(tenant_id,version,config,draft_revision,published_by)
    SELECT $1,COALESCE(MAX(version),0)+1,$2::jsonb,$3,$4 FROM tenant_bot_versions WHERE tenant_id=$1
    RETURNING version,published_at AS "publishedAt"`,[actor.tenantId,JSON.stringify(config),d.draft_revision,actor.userId]);
  await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'BOT_MENU_PUBLISHED','bot',$3)`,[actor.tenantId,actor.userId,String(version.rows[0].version)]);
  return {version:version.rows[0].version,publishedAt:version.rows[0].publishedAt,config};
}
export async function botVersions(db:SqlClient,actor:Actor){
  allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
  return (await db.query(`SELECT version,config,published_at AS "publishedAt",draft_revision AS "draftRevision"
    FROM tenant_bot_versions WHERE tenant_id=$1 ORDER BY version DESC LIMIT 25`,[actor.tenantId])).rows;
}
export async function teamMembers(db:SqlClient,actor:Actor){
  allow(actor,['OWNER','MANAGER']);
  return (await db.query(`SELECT u.id,u.email,m.role,u.created_at AS "createdAt" FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE m.tenant_id=$1 ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END,u.created_at LIMIT 200`,[actor.tenantId])).rows;
}