import type {SqlClient} from './services.js';
export const contextKeys=['channel','consent_service','consent_marketing','consent_service_policy','consent_marketing_policy'] as const;
export type VariableContext=Partial<Record<typeof contextKeys[number],string>>;
/** No names, addresses, notice text, hashes or actor identifiers leave the evidence store. */
export async function consentVariableContext(db:SqlClient,t:string,contact:string,channel:string):Promise<VariableContext>{
 const person=await db.query('SELECT do_not_contact,marketing_opt_in FROM contacts WHERE tenant_id=$1 AND id=$2',[t,contact]);
 const events=await db.query("SELECT DISTINCT ON(purpose) purpose,decision,policy_version FROM contact_consent_events WHERE tenant_id=$1 AND contact_id=$2 AND purpose IN ('SERVICE','MARKETING') ORDER BY purpose,occurred_at DESC,id DESC",[t,contact]);
 const values:VariableContext={channel};for(const purpose of ['SERVICE','MARKETING'] as const){const e=events.rows.find(r=>r.purpose===purpose),key=purpose==='SERVICE'?'consent_service':'consent_marketing';let decision=e?String(e.decision):'UNKNOWN';if(decision==='GRANT'&&(person.rows[0]?.do_not_contact||purpose==='MARKETING'&&!person.rows[0]?.marketing_opt_in))decision='WITHDRAW';values[key]=decision;values[`${key}_policy`]=typeof e?.policy_version==='string'?e.policy_version.slice(0,80):'';}return values;
}
