/** Tenant-only operational analytics. These are leads, not booked sales. */
import {allow,type Actor,type SqlClient} from './services.js';
export async function analyticsOverview(db:SqlClient,actor:Actor,periodDays=30){
 allow(actor,['OWNER','MANAGER','AGENT','VIEWER']);
 if(![7,30,90].includes(periodDays))throw new Error('Unsupported reporting period');
 const tenant=actor.tenantId,params=[tenant,periodDays] as const;
 const window="created_at>=(date_trunc('day',now() AT TIME ZONE 'UTC')-($2::int-1)*interval '1 day') AT TIME ZONE 'UTC' AND created_at<(date_trunc('day',now() AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC'";
 const [conversations,leads,channels,days,followups,campaigns,leadChannels,leadDays]=await Promise.all([
  db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='HUMAN')::int AS human,count(*) FILTER(WHERE status='CLOSED')::int AS closed FROM conversations WHERE tenant_id=$1 AND "+window,params),
  db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE stage='READY_FOR_AGENT')::int AS ready,count(*) FILTER(WHERE stage='CONTACTED')::int AS contacted,count(*) FILTER(WHERE stage='CLOSED')::int AS closed FROM chatbot_leads WHERE tenant_id=$1 AND "+window,params),
  db.query("SELECT channel,count(*)::int AS total FROM conversations WHERE tenant_id=$1 AND "+window+" GROUP BY channel ORDER BY total DESC",params),
  db.query("SELECT date_trunc('day',created_at AT TIME ZONE 'UTC')::date::text AS day,count(*)::int AS conversations FROM conversations WHERE tenant_id=$1 AND "+window+" GROUP BY 1 ORDER BY 1",params),
  db.query("SELECT count(*) FILTER(WHERE status='OPEN')::int AS open,count(*) FILTER(WHERE status='OPEN' AND due_at<now())::int AS overdue,count(*) FILTER(WHERE status='DONE')::int AS done FROM chatbot_lead_tasks WHERE tenant_id=$1",[tenant]),
  db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE status='ACTIVE')::int AS active,count(*) FILTER(WHERE status='COMPLETED')::int AS completed FROM chatbot_campaigns WHERE tenant_id=$1 AND "+window,params),
  db.query("SELECT v.channel,count(*)::int AS leads FROM chatbot_leads l JOIN conversations v ON v.tenant_id=l.tenant_id AND v.id=l.conversation_id WHERE l.tenant_id=$1 AND "+window.replaceAll("created_at","l.created_at")+" GROUP BY v.channel ORDER BY leads DESC",params),
  db.query("SELECT date_trunc('day',created_at AT TIME ZONE 'UTC')::date::text AS day,count(*)::int AS leads FROM chatbot_leads WHERE tenant_id=$1 AND "+window+" GROUP BY 1 ORDER BY 1",params)
 ]);
 const c=conversations.rows[0]||{},l=leads.rows[0]||{},all=Number(c.total||0),qualified=Number(l.total||0);
 return {periodDays,conversations:all,leads:qualified,leadCapturePct:all?Math.round(qualified*10000/all)/100:0,
 handedToStaff:Number(c.human||0),closedConversations:Number(c.closed||0),
 ready:Number(l.ready||0),contacted:Number(l.contacted||0),closedLeads:Number(l.closed||0),
 tasks:followups.rows[0]||{open:0,overdue:0,done:0},campaigns:campaigns.rows[0]||{total:0,active:0,completed:0},
 channels:channels.rows,daily:days.rows,leadChannels:leadChannels.rows,leadDaily:leadDays.rows};
}
