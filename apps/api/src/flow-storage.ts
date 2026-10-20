import type {Actor,SqlClient} from './services.js';
/** Explicit storage boundary; only server-selected table names, all identifiers are parameters. */
export function flowStorage(db:SqlClient,actor:Actor,botId?:string){
 const drafts=botId?'chatbot_bot_drafts':'chatbot_flow_drafts';
 const versions=botId?'chatbot_bot_versions':'chatbot_flow_versions';
 const scope=botId?'tenant_id=$1 AND bot_id=$2':'tenant_id=$1';
 const keys=botId?[actor.tenantId,botId]:[actor.tenantId];
 return {
  async draft(lock=false){return db.query(`SELECT definition,draft_revision AS "draftRevision",updated_at AS "updatedAt" FROM ${drafts} WHERE ${scope}${lock?' FOR UPDATE':''}`,keys)},
  async published(version?:number){return db.query(`SELECT version,coalesce(source_definition,definition) AS definition,published_at AS "publishedAt" FROM ${versions} WHERE ${scope}${version===undefined?' ORDER BY version DESC LIMIT 1':` AND version=$${keys.length+1}`}`,[...keys,...(version===undefined?[]:[version])])},
  async save(definition:unknown){
   return db.query(`INSERT INTO ${drafts}(tenant_id,definition,updated_by${botId?',bot_id':''}) VALUES($1,$2::jsonb,$3${botId?',$4':''})
    ON CONFLICT(tenant_id${botId?',bot_id':''}) DO UPDATE SET definition=EXCLUDED.definition,draft_revision=${drafts}.draft_revision+1,updated_by=EXCLUDED.updated_by,updated_at=now()
    RETURNING draft_revision AS "draftRevision"`,[actor.tenantId,JSON.stringify(definition),actor.userId,...(botId?[botId]:[])]);
  },
  async publish(definition:unknown,revision:unknown,source:unknown){return db.query(`INSERT INTO ${versions}(tenant_id,version,definition,draft_revision,published_by,source_definition${botId?',bot_id':''})
   SELECT $1,COALESCE(MAX(version),0)+1,$2::jsonb,$3,$4,$5::jsonb${botId?',$6':''} FROM ${versions} WHERE tenant_id=$1${botId?' AND bot_id=$6':''}
   RETURNING version,published_at AS "publishedAt"`,[actor.tenantId,JSON.stringify(definition),revision,actor.userId,JSON.stringify(source),...(botId?[botId]:[])])},
  async versions(){return db.query(`SELECT version,published_at AS "publishedAt" FROM ${versions} WHERE ${scope} ORDER BY version DESC LIMIT 30`,keys)}
 };
}
