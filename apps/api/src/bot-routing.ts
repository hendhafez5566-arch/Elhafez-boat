import {allow,HttpFailure,isUuid,type Actor,type SqlClient} from './services.js';
/** Existing sessions remain pinned; route changes affect new conversations only. */
export async function resolveConversationBot(db:SqlClient,tenantId:string,conversationId:string,pinned?:unknown){
 if(pinned){const b=await db.query('SELECT id,legacy_default FROM chatbot_bots WHERE tenant_id=$1 AND id=$2',[tenantId,pinned]);if(!b.rowCount)throw new HttpFailure(409,'Pinned bot unavailable');return b.rows[0]}
 const r=await db.query(`SELECT b.id,b.legacy_default FROM conversations c JOIN chatbot_bot_routes r
 ON r.tenant_id=c.tenant_id AND r.channel=c.channel AND r.account_id IS NOT DISTINCT FROM
 CASE WHEN c.channel='WHATSAPP' THEN c.whatsapp_account_id WHEN c.channel='WEBSITE' THEN NULL ELSE c.social_account_id END
 JOIN chatbot_bots b ON b.tenant_id=r.tenant_id AND b.id=r.bot_id
 WHERE c.tenant_id=$1 AND c.id=$2 AND b.archived_at IS NULL`,[tenantId,conversationId]);
 if(r.rowCount&&r.rowCount>1)throw new HttpFailure(409,'Ambiguous bot routing');
 return r.rows[0]??null; // no route = the documented legacy /flows adapter, never a random bot
}
export async function getBotRoutes(db:SqlClient,actor:Actor,id:string){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);if(!isUuid(id))throw new HttpFailure(400,'Invalid bot');
 const b=await db.query('SELECT id FROM chatbot_bots WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id]);if(!b.rowCount)throw new HttpFailure(404,'Bot not found');
 return (await db.query('SELECT channel,account_id AS "accountId" FROM chatbot_bot_routes WHERE tenant_id=$1 AND bot_id=$2',[actor.tenantId,id])).rows;
}
export async function bindBotRoute(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER']);await getBotRoutes(db,actor,id);
 const d=input as {channel?:unknown;accountId?:unknown};
 if(!d||!['WEBSITE','WHATSAPP','MESSENGER','INSTAGRAM','TELEGRAM'].includes(String(d.channel)))throw new HttpFailure(400,'Unsupported channel');
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 const bot=await db.query('SELECT legacy_default,archived_at FROM chatbot_bots WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[actor.tenantId,id]);
 if(bot.rows[0].archived_at)throw new HttpFailure(409,'Archived bot cannot receive messages');
 const table=bot.rows[0].legacy_default?'chatbot_flow_versions':'chatbot_bot_versions';
 const published=await db.query(`SELECT 1 FROM ${table} WHERE tenant_id=$1${bot.rows[0].legacy_default?'':' AND bot_id=$2'} LIMIT 1`,bot.rows[0].legacy_default?[actor.tenantId]:[actor.tenantId,id]);
 if(!published.rowCount)throw new HttpFailure(409,'Publish a valid bot before routing a channel');
 let account:unknown=null;
 if(d.channel!=='WEBSITE'){
  if(!isUuid(d.accountId))throw new HttpFailure(400,'Select a connected account');account=d.accountId;
  const r=d.channel==='WHATSAPP'?await db.query("SELECT id FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2 AND status='CONNECTED' AND authorization_status='VERIFIED' AND subscription_verified_at IS NOT NULL AND (token_expires_at IS NULL OR token_expires_at>now())",[actor.tenantId,account]):await db.query("SELECT id FROM chatbot_social_accounts WHERE tenant_id=$1 AND id=$2 AND channel=$3 AND enabled=true",[actor.tenantId,account,d.channel]);
  if(!r.rowCount)throw new HttpFailure(409,'Channel account unavailable');
 }else{const r=await db.query('SELECT 1 FROM chatbot_widget_settings WHERE tenant_id=$1 AND enabled=true',[actor.tenantId]);if(!r.rowCount)throw new HttpFailure(409,'Enable website chat before routing');}
 const exists=await db.query('SELECT bot_id FROM chatbot_bot_routes WHERE tenant_id=$1 AND channel=$2 AND account_id IS NOT DISTINCT FROM $3::uuid',[actor.tenantId,d.channel,account]);
 if(exists.rowCount&&exists.rows[0].bot_id!==id)throw new HttpFailure(409,'Channel already routes to another bot');
 await db.query('INSERT INTO chatbot_bot_routes(tenant_id,bot_id,channel,account_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[actor.tenantId,id,d.channel,account]);
 return {routed:true,channel:d.channel};
}

export async function unbindBotRoute(db:SqlClient,actor:Actor,id:string,input:unknown){
 allow(actor,['OWNER','MANAGER']);await getBotRoutes(db,actor,id);
 const d=input as {channel?:unknown;accountId?:unknown};
 if(!d||typeof d.channel!=='string'||(d.accountId!=null&&!isUuid(d.accountId)))throw new HttpFailure(400,'Invalid channel route');
 await db.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[actor.tenantId]);
 await db.query('DELETE FROM chatbot_bot_routes WHERE tenant_id=$1 AND bot_id=$2 AND channel=$3 AND account_id IS NOT DISTINCT FROM $4::uuid',[actor.tenantId,id,d.channel,d.accountId??null]);
 return {removed:true,existingSessions:'pinned'};
}
