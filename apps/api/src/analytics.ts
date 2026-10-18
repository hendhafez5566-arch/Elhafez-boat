/** Tenant-scoped operational analytics. These are contact/lead metrics, not sales receipts. */
import {allow,type Actor,type SqlClient} from './services.js';

export async function analyticsOverview(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 const tenant=actor.tenantId;
 const [conversations,leads,channels,days,followups,campaigns]=await Promise.all([
  db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='HUMAN')::int AS human,count(*) FILTER(WHERE status='CLOSED')::int AS closed FROM conversations WHERE tenant_id=$1 AND created_at>=now()-interval '30 days'",[tenant]),
  db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE stage='READY_FOR_AGENT')::int AS ready,count(*) FILTER(WHERE stage='CONTACTED')::int AS contacted,count(*) FILTER(WHERE stage='CLOSED')::int AS closed FROM chatbot_leads WHERE tenant_id=$1 AND created_at>=now()-interval '30 days'",[tenant]),
  db.query("SELECT channel,count(*)::int AS total FROM conversations WHERE tenant_id=$1 AND created_at>=now()-interval '30 days' GROUP BY channel ORDER BY total DESC",[tenant]),
  db.query("SELECT date_trunc('day',created_at)::date::text AS day,count(*)::int AS conversations FROM conversations WHERE tenant_id=$1 AND created_at>=now()-interval '30 days' GROUP BY 1 ORDER BY 1",[tenant]),
  db.query("SELECT count(*) FILTER(WHERE status='OPEN')::int AS open,count(*) FILTER(WHERE status='OPEN' AND due_at<now())::int AS overdue,count(*) FILTER(WHERE status='DONE')::int AS done FROM chatbot_lead_tasks WHERE tenant_id=$1",[tenant]),
  db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='ACTIVE')::int AS active,count(*) FILTER(WHERE status='COMPLETED')::int AS completed FROM chatbot_campaigns WHERE tenant_id=$1 AND created_at>=now()-interval '30 days'",[tenant])
 ]);
 const c=conversations.rows[0],l=leads.rows[0];
 const all=Number(c.total||0),qualified=Number(l.total||0);
 return {
  periodDays:30,
  conversations:all,leads:qualified,leadCapturePct:all?Math.round(qualified*10000/all)/100:0,
  handedToStaff:Number(c.human||0),closedConversations:Number(c.closed||0),
  ready:Number(l.ready||0),contacted:Number(l.contacted||0),closedLeads:Number(l.closed||0),
  tasks:followups.rows[0]||{open:0,overdue:0,done:0},
  campaigns:campaigns.rows[0]||{total:0,active:0,completed:0},
  channels:channels.rows,daily:days.rows
 };
}
