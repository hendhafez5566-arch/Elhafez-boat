import {listFlowSnippets,createFlowSnippet,deleteFlowSnippet} from './flow-reuse.js';
import {listCampaigns,createCampaign,launchCampaign,cancelCampaign} from './campaigns.js';
import {notifications,runtimeJobs} from './workspace.js';
import {widgetSettings,saveWidgetSettings,startWebsiteSession,websiteSend,websiteMessages} from './website.js';
import {listMedia,uploadMedia,deleteMedia,publicMedia} from './media.js';
import {listTriggers,createTrigger,deleteTrigger} from './triggers.js';
import {usageSummary} from './usage.js';
import {authenticateAccessKey,listAccessKeys,createAccessKey,revokeAccessKey} from './access-keys.js';
import {listIntegrations,createIntegration,updateIntegration} from './integrations.js';
import {savedReplies,createSavedReply,deleteSavedReply,updateSavedReply,inboxNote} from './inbox.js';
import {aiSettings,saveAiSettings} from './ai.js';
import {executeFlow} from './flow-service.js';
import {validateFlow,initialFlowState} from './flow-engine.js';
import {listCatalog,createCatalog,updateCatalog,changeCatalogStatus} from './catalog.js';
import {getFlowConfig,saveFlowDraft,publishFlowDraft,listFlowVersions,rollbackFlow} from './flow-service.js';
import { listLeads, leadSummary, updateLeadStage } from './chatbot-leads.js';
import { listTemplates, registerApprovedTemplate, recordMarketingConsent, sendApprovedTemplate } from './templates.js';
import { listKnowledge, createKnowledge, publishKnowledge } from './knowledge.js';
import { verifyWebhookSignature, verifyChallenge, handleVerifiedWebhook, connectWhatsApp, whatsappConnection, disconnectWhatsApp, whatsappInbox, whatsappThread, setWhatsAppHandoff, replyWhatsApp, optOutWhatsApp } from './whatsapp.js';
import { createTeamInvite, listTeamInvitations, revokeTeamInvite, updateTeamRole, acceptTeamInvite } from './team.js';
import { platformLogin, platformAuth, platformLogout, platformTenants, platformPlans, platformUsageLimits, createTenant, updateSubscription, acceptFirstOwner } from './platform.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { login, authenticate, logout } from './auth.js';
import { HttpFailure, allow, withTenantTransaction, type SqlPool, type SqlClient } from './services.js';
import { listContacts, addContact, setContactStatus, listContactNotes, addContactNote, getSummary } from './sales.js';
import { teamMembers } from './team-directory.js';
const require=createRequire(import.meta.url);
// pg is a runtime dependency loaded after npm install; query access is abstracted for unit tests.
const { Pool } = require('pg') as { Pool: new (options: { connectionString: string; max: number }) => SqlPool & SqlClient & { end(): Promise<void> } };
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:10});
const port=Number(process.env.PORT??4000);
const json=(res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
async function body(req:IncomingMessage,maxBytes=65536):Promise<unknown>{
  if(!req.headers['content-type']?.startsWith('application/json'))throw new HttpFailure(415,'JSON required');
  let text='';for await(const chunk of req){text+=chunk.toString();if(Buffer.byteLength(text)>maxBytes)throw new HttpFailure(413,'Body too large');}
  try{return JSON.parse(text)}catch{throw new HttpFailure(400,'Invalid JSON')}
}
const failedLogins=new Map<string,{count:number;until:number}>();
function throttle(req:IncomingMessage):void{
  const key=req.socket.remoteAddress??'unknown';const now=Date.now();let item=failedLogins.get(key);
  if(!item||now>item.until){item={count:0,until:now+600000};failedLogins.set(key,item)}
  if(item.count>=10)throw new HttpFailure(429,'Too many login attempts');
  item.count++;
}
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url??'/',`http://localhost:${port}`).pathname;
    if(pathname.startsWith('/api/v1/widget/')&&pathname!=='/api/v1/widget/settings'){
      const origin=typeof req.headers.origin==='string'?req.headers.origin:typeof req.headers['x-widget-origin']==='string'?req.headers['x-widget-origin']:'';
      if(origin){res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin')}
      res.setHeader('access-control-allow-methods','GET, POST, OPTIONS');res.setHeader('access-control-allow-headers','Content-Type, Authorization, X-Widget-Origin');
      if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
      if(req.method==='POST'&&pathname==='/api/v1/widget/start')return json(res,201,await startWebsiteSession(pool,await body(req),origin));
      if(req.method==='POST'&&pathname==='/api/v1/widget/send')return json(res,200,await websiteSend(pool,req.headers.authorization||'',origin,await body(req)));
      if(req.method==='GET'&&pathname==='/api/v1/widget/messages')return json(res,200,await websiteMessages(pool,req.headers.authorization||'',origin));
      throw new HttpFailure(404,'Widget route not found');
    }
    const publicAsset=/^\/api\/v1\/media\/public\/([A-Za-z0-9_-]+)$/.exec(pathname);
    if(req.method==='GET'&&publicAsset){const file=await publicMedia(pool,publicAsset[1]);res.writeHead(200,{'content-type':file.mime,'content-length':file.data.length,'x-content-type-options':'nosniff','cache-control':'no-store','content-security-policy':"default-src 'none'; sandbox",'content-disposition':file.mime==='application/pdf'?'attachment':'inline'});res.end(file.data);return}
    if(req.method==='GET'&&pathname==='/health'){
      try{await pool.query('SELECT 1');return json(res,200,{status:'ok',service:'api',database:'reachable',whatsappConnected:false});}
      catch{return json(res,503,{status:'unavailable',service:'api',database:'unreachable'});}
    }
    if(req.method==='POST'&&pathname==='/api/v1/auth/login'){
      throttle(req);
      return json(res,200,await login(pool,await body(req)));
    }
    // Public Meta webhook: signature validation precedes JSON parsing or database writes.
    if(pathname==='/api/v1/whatsapp/webhook'&&req.method==='GET'){
      const challenge=verifyChallenge(new URL(req.url??'/', 'http://local').searchParams);
      if(!challenge)return json(res,403,{error:'Webhook verification rejected'});
      res.writeHead(200,{'content-type':'text/plain; charset=utf-8'});res.end(challenge);return;
    }
    if(pathname==='/api/v1/whatsapp/webhook'&&req.method==='POST'){
      const chunks:Buffer[]=[];let size=0;
      for await(const chunk of req){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=b.length;if(size>1024*1024)throw new HttpFailure(413,'Webhook too large');chunks.push(b);}
      const raw=Buffer.concat(chunks);
      if(!verifyWebhookSignature(raw,req.headers['x-hub-signature-256'],process.env.META_APP_SECRET??''))throw new HttpFailure(401,'Invalid webhook signature');
      let payload:unknown;try{payload=JSON.parse(raw.toString('utf8'));}catch{throw new HttpFailure(400,'Malformed webhook JSON');}
      await handleVerifiedWebhook(pool,payload);return json(res,200,{received:true});
    }
    if(req.method==='POST'&&pathname==='/api/v1/team/accept'){throttle(req);return json(res,200,await acceptTeamInvite(pool,await body(req)));}
    if(req.method==='POST'&&pathname==='/api/v1/platform/owner/accept'){throttle(req);return json(res,200,await acceptFirstOwner(await body(req)));}
    if(req.method==='POST'&&pathname==='/api/v1/platform/auth/login'){
      throttle(req);return json(res,200,await platformLogin(await body(req)));
    }
    if(pathname.startsWith('/api/v1/platform/')){
      const platformOwnerId=await platformAuth(req.headers.authorization);
      if(req.method==='POST'&&pathname==='/api/v1/platform/auth/logout')return json(res,200,await platformLogout(req.headers.authorization));
      if(req.method==='GET'&&pathname==='/api/v1/platform/tenants')return json(res,200,await platformTenants(platformOwnerId));
      if(req.method==='POST'&&pathname==='/api/v1/platform/tenants')return json(res,201,await createTenant(platformOwnerId,await body(req)));
      if(req.method==='GET'&&pathname==='/api/v1/platform/plans')return json(res,200,await platformPlans(platformOwnerId));
      const limits=/^\/api\/v1\/platform\/tenants\/([^/]+)\/usage-limits$/.exec(pathname);
      if(req.method==='PUT'&&limits)return json(res,200,await platformUsageLimits(platformOwnerId,limits[1],await body(req)));
      const sub=/^\/api\/v1\/platform\/tenants\/([^/]+)\/subscription$/.exec(pathname);
      if(req.method==='PATCH'&&sub)return json(res,200,await updateSubscription(platformOwnerId,sub[1],await body(req)));
      return json(res,404,{error:'Not found'});
    }
    const actor=req.headers.authorization?.startsWith('Bearer ebk_')?await authenticateAccessKey(pool,req.headers.authorization,pathname,req.method||'GET'):await authenticate(pool,req.headers.authorization);
    // Block mutating requests for expired or suspended subscriptions (reads remain available for export/support).
    // This is a business entitlement check, separate from tenant RLS and staff-role authorization.
    if(req.method&& !['GET','HEAD','OPTIONS'].includes(req.method) && pathname!=='/api/v1/auth/logout'){
      const entitlement=await withTenantTransaction(pool,actor,async tx=>{
        const r=await tx.query(`SELECT status,current_period_ends_at FROM tenant_subscriptions WHERE tenant_id=$1`,[actor.tenantId]);
        return r.rows[0]??null;
      });
      if(!entitlement||!['TRIAL','ACTIVE'].includes(String(entitlement.status))||
         new Date(String(entitlement.current_period_ends_at)).getTime()<=Date.now())
        throw new HttpFailure(403,'Company subscription inactive or expired; only read-only access is available');
    }
    if(req.method==='GET'&&pathname==='/api/v1/auth/me')return json(res,200,actor);
    if(req.method==='POST'&&pathname==='/api/v1/auth/logout'){await logout(pool,req.headers.authorization);return json(res,200,{ok:true});}
    if(/^\/api\/v1\/(programs|bookings|departures|offers|bot)(\/|$)/.test(pathname))return json(res,410,{error:'Legacy tourism endpoints retired. Use /catalog and /flows.'});
    // No reservation/room-allocation endpoints. Staff handles actual bookings in their existing systems.
    const run=<T>(task:(tx:SqlClient)=>Promise<T>)=>withTenantTransaction(pool,actor,task);
    const runBody=async<T>(task:(tx:SqlClient,input:unknown)=>Promise<T>):Promise<T>=>{const input=await body(req);return run(tx=>task(tx,input));};
    if(req.method==='GET'&&pathname==='/api/v1/whatsapp/connection')return json(res,200,await run(tx=>whatsappConnection(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/whatsapp/connection')return json(res,201,await runBody((tx,input)=>connectWhatsApp(tx,actor,input)));
    const waDisconnect=/^\/api\/v1\/whatsapp\/connection\/([^/]+)$/.exec(pathname);
    if(req.method==='DELETE'&&waDisconnect)return json(res,200,await run(tx=>disconnectWhatsApp(tx,actor,waDisconnect[1])));
    if(req.method==='GET'&&pathname==='/api/v1/notifications')return json(res,200,await run(tx=>notifications(tx,actor)));
    if(req.method==='GET'&&pathname==='/api/v1/runtime/jobs')return json(res,200,await run(tx=>runtimeJobs(tx,actor)));
    if(req.method==='GET'&&pathname==='/api/v1/campaigns')return json(res,200,await run(tx=>listCampaigns(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/campaigns')return json(res,201,await runBody((tx,input)=>createCampaign(tx,actor,input)));
    const campaignAction=/^\/api\/v1\/campaigns\/([^/]+)\/(launch|cancel)$/.exec(pathname);
    if(req.method==='POST'&&campaignAction)return json(res,200,await run<unknown>(tx=>campaignAction[2]==='launch'?launchCampaign(tx,actor,campaignAction[1]):cancelCampaign(tx,actor,campaignAction[1])));
    if(req.method==='GET'&&pathname==='/api/v1/usage')return json(res,200,await run(tx=>usageSummary(tx,actor)));
    if(req.method==='GET'&&pathname==='/api/v1/widget/settings')return json(res,200,await run(tx=>widgetSettings(tx,actor)));
    if(req.method==='PUT'&&pathname==='/api/v1/widget/settings')return json(res,200,await runBody((tx,input)=>saveWidgetSettings(tx,actor,input)));
    if(req.method==='GET'&&pathname==='/api/v1/triggers')return json(res,200,await run(tx=>listTriggers(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/triggers')return json(res,201,await runBody((tx,input)=>createTrigger(tx,actor,input)));
    const trigger=/^\/api\/v1\/triggers\/([^/]+)$/.exec(pathname);
    if(req.method==='DELETE'&&trigger)return json(res,200,await run(tx=>deleteTrigger(tx,actor,trigger[1])));
    if(req.method==='GET'&&pathname==='/api/v1/media')return json(res,200,await run(tx=>listMedia(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/media'){const input=await body(req,7500000);return json(res,201,await run(tx=>uploadMedia(tx,actor,input)))}
    const asset=/^\/api\/v1\/media\/([^/]+)$/.exec(pathname);
    if(req.method==='DELETE'&&asset)return json(res,200,await run(tx=>deleteMedia(tx,actor,asset[1])));
    if(req.method==='GET'&&pathname==='/api/v1/catalog')return json(res,200,await run(tx=>listCatalog(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/catalog')return json(res,201,await runBody((tx,input)=>createCatalog(tx,actor,input)));
    const itemRoute=/^\/api\/v1\/catalog\/([^/]+)$/.exec(pathname);
    if(req.method==='PUT'&&itemRoute)return json(res,200,await runBody((tx,input)=>updateCatalog(tx,actor,itemRoute[1],input)));
    const publishItem=/^\/api\/v1\/catalog\/([^/]+)\/publish$/.exec(pathname);
    if(req.method==='POST'&&publishItem)return json(res,200,await run(tx=>changeCatalogStatus(tx,actor,publishItem[1],'PUBLISHED')));
    const archiveItem=/^\/api\/v1\/catalog\/([^/]+)\/archive$/.exec(pathname);
    if(req.method==='POST'&&archiveItem)return json(res,200,await run(tx=>changeCatalogStatus(tx,actor,archiveItem[1],'ARCHIVED')));
    if(req.method==='GET'&&pathname==='/api/v1/access-keys')return json(res,200,await run(tx=>listAccessKeys(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/access-keys')return json(res,201,await runBody((tx,input)=>createAccessKey(tx,actor,input)));
    const accessKey=/^\/api\/v1\/access-keys\/([^/]+)$/.exec(pathname);
    if(req.method==='DELETE'&&accessKey)return json(res,200,await run(tx=>revokeAccessKey(tx,actor,accessKey[1])));
    const integration=/^\/api\/v1\/integrations\/([^/]+)$/.exec(pathname);
    if(req.method==='PATCH'&&integration)return json(res,200,await runBody((tx,input)=>updateIntegration(tx,actor,integration[1],input)));
    if(req.method==='GET'&&pathname==='/api/v1/integrations')return json(res,200,await run(tx=>listIntegrations(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/integrations')return json(res,201,await runBody((tx,input)=>createIntegration(tx,actor,input)));
    if(req.method==='GET'&&pathname==='/api/v1/ai/settings')return json(res,200,await run(tx=>aiSettings(tx,actor)));
    if(req.method==='PUT'&&pathname==='/api/v1/ai/settings')return json(res,200,await runBody((tx,input)=>saveAiSettings(tx,actor,input)));
    if(req.method==='POST'&&pathname==='/api/v1/flows/preview')return json(res,200,await runBody(async(tx,input)=>{
      allow(actor,['OWNER','MANAGER']);
      const d=input as Record<string,unknown>;let flow;try{flow=validateFlow(d.definition)}catch(e){throw new HttpFailure(400,e instanceof Error?e.message:'Invalid flow')}
      const state=d.state as ReturnType<typeof initialFlowState>|undefined;
      if(state&&(!Array.isArray(state.tags)||state.tags.length>100||state.tags.some(t=>typeof t!=='string'||t.length>40)||!state.answers||typeof state.answers!=='object'||Array.isArray(state.answers)||Object.keys(state.answers).length>200||Object.values(state.answers).some(v=>typeof v!=='string'||v.length>500)||(state.at!==null&&(typeof state.at!=='string'||state.at.length>180))))throw new HttpFailure(400,'Invalid preview state');
      const incoming=d.input as {kind:'TEXT'|'CHOICE';value:string}|undefined;
      if(incoming&&(!['TEXT','CHOICE'].includes(incoming.kind)||typeof incoming.value!=='string'||incoming.value.length>2000))throw new HttpFailure(400,'Invalid preview input');
      const runtime=d.runtimeNodes;if(runtime!==undefined){try{const parsed=validateFlow({...flow,nodes:runtime},{runtime:true,draft:true});flow={...flow,nodes:[...flow.nodes.map(n=>n.type==='CATALOG'?(parsed.nodes.find(x=>x.id===n.id)||n):n),...parsed.nodes.filter(n=>n.id.startsWith('@catalog:'))]}}catch(e){throw new HttpFailure(400,e instanceof Error?e.message:'Invalid runtime preview')}}
      const r=await executeFlow(tx,actor.tenantId,flow,state||initialFlowState(),incoming,true);return {state:r.state,messages:r.messages,handoff:r.handoff,finished:r.finished,waiting:r.waiting,runtimeNodes:r.flow.nodes};
    }));
    if(req.method==='POST'&&pathname==='/api/v1/flows/validate'){
      allow(actor,['OWNER','MANAGER']);
      const input=await body(req);try{validateFlow(input);return json(res,200,{valid:true})}catch(e){throw new HttpFailure(400,e instanceof Error?e.message:'Invalid flow')}
    }
    if(req.method==='GET'&&pathname==='/api/v1/flows/snippets')
      return json(res,200,await run(tx=>listFlowSnippets(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/flows/snippets')
      return json(res,201,await runBody((tx,input)=>createFlowSnippet(tx,actor,input)));
    const snippet=/^\/api\/v1\/flows\/snippets\/([^/]+)$/.exec(pathname);
    if(req.method==='DELETE'&&snippet)
      return json(res,200,await run(tx=>deleteFlowSnippet(tx,actor,snippet[1])));
    if(req.method==='GET'&&pathname==='/api/v1/flows')return json(res,200,await run(tx=>getFlowConfig(tx,actor)));
    if(req.method==='PUT'&&pathname==='/api/v1/flows/draft')return json(res,200,await runBody((tx,input)=>saveFlowDraft(tx,actor,input)));
    if(req.method==='POST'&&pathname==='/api/v1/flows/publish')return json(res,200,await run(tx=>publishFlowDraft(tx,actor)));
    if(req.method==='GET'&&pathname==='/api/v1/flows/versions')return json(res,200,await run(tx=>listFlowVersions(tx,actor)));
    const rollback=/^\/api\/v1\/flows\/versions\/([0-9]+)\/rollback$/.exec(pathname);
    if(req.method==='POST'&&rollback)return json(res,200,await run(tx=>rollbackFlow(tx,actor,rollback[1])));
    if(req.method==='GET'&&pathname==='/api/v1/leads')return json(res,200,await run(tx=>listLeads(tx,actor)));
    if(req.method==='GET'&&pathname==='/api/v1/leads/summary')return json(res,200,await run(tx=>leadSummary(tx,actor)));
    const leadStage=/^\/api\/v1\/leads\/([^/]+)\/stage$/.exec(pathname);
    if(req.method==='PATCH'&&leadStage)return json(res,200,await runBody((tx,input)=>updateLeadStage(tx,actor,leadStage[1],input)));
    if(req.method==='GET'&&pathname==='/api/v1/saved-replies')return json(res,200,await run(tx=>savedReplies(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/saved-replies')return json(res,201,await runBody((tx,input)=>createSavedReply(tx,actor,input)));
    const savedReply=/^\/api\/v1\/saved-replies\/([^/]+)$/.exec(pathname);
    if(req.method==='PUT'&&savedReply)return json(res,200,await runBody((tx,input)=>updateSavedReply(tx,actor,savedReply[1],input)));
    if(req.method==='DELETE'&&savedReply)return json(res,200,await run(tx=>deleteSavedReply(tx,actor,savedReply[1])));
    const threadNote=/^\/api\/v1\/whatsapp\/inbox\/([^/]+)\/notes$/.exec(pathname);
    if(req.method==='POST'&&threadNote)return json(res,201,await runBody((tx,input)=>inboxNote(tx,actor,threadNote[1],input)));
    if(req.method==='GET'&&pathname==='/api/v1/whatsapp/inbox')return json(res,200,await run(tx=>whatsappInbox(tx,actor)));
    const waMessages=/^\/api\/v1\/whatsapp\/inbox\/([^/]+)\/messages$/.exec(pathname);
    if(req.method==='GET'&&waMessages)return json(res,200,await run(tx=>whatsappThread(tx,actor,waMessages[1])));
    const waHandoff=/^\/api\/v1\/whatsapp\/inbox\/([^/]+)\/handoff$/.exec(pathname);
    if(req.method==='PATCH'&&waHandoff)return json(res,200,await runBody((tx,input)=>setWhatsAppHandoff(tx,actor,waHandoff[1],input)));
    const waReply=/^\/api\/v1\/whatsapp\/inbox\/([^/]+)\/reply$/.exec(pathname);
    if(req.method==='POST'&&waReply)return json(res,202,await runBody((tx,input)=>replyWhatsApp(tx,actor,waReply[1],input)));
    const contactOptout=/^\/api\/v1\/contacts\/([^/]+)\/optout$/.exec(pathname);
    if(req.method==='PATCH'&&contactOptout)return json(res,200,await runBody((tx,input)=>optOutWhatsApp(tx,actor,contactOptout[1],input)));
    if(req.method==='GET'&&pathname==='/api/v1/team/invitations')return json(res,200,await run(tx=>listTeamInvitations(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/team/invitations')return json(res,201,await runBody((tx,input)=>createTeamInvite(tx,actor,input)));
    const inviteRevoke=/^\/api\/v1\/team\/invitations\/([^/]+)\/revoke$/.exec(pathname);
    if(req.method==='POST'&&inviteRevoke)return json(res,200,await run(tx=>revokeTeamInvite(tx,actor,inviteRevoke[1])));
    const teamRole=/^\/api\/v1\/team\/members\/([^/]+)\/role$/.exec(pathname);
    if(req.method==='PATCH'&&teamRole)return json(res,200,await runBody((tx,input)=>updateTeamRole(tx,actor,teamRole[1],input)));
    if(req.method==='GET'&&pathname==='/api/v1/subscription'){
      return json(res,200,await run(async tx=>{
        const r=await tx.query(`SELECT s.plan_code AS "planCode",p.title,s.status,s.current_period_ends_at AS "currentPeriodEndsAt",
          p.max_staff AS "maxStaff",p.max_programs AS "maxCatalogItems" FROM tenant_subscriptions s
          JOIN subscription_plans p ON p.code=s.plan_code WHERE s.tenant_id=$1`,[actor.tenantId]);
        return r.rows[0]??{status:'NOT_CONFIGURED',planCode:null};
      }));
    }
    if(req.method==='GET'&&pathname==='/api/v1/whatsapp/templates')return json(res,200,await run(tx=>listTemplates(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/whatsapp/templates')return json(res,201,await runBody((tx,input)=>registerApprovedTemplate(tx,actor,input)));
    if(req.method==='POST'&&pathname==='/api/v1/whatsapp/templates/send')return json(res,202,await runBody((tx,input)=>sendApprovedTemplate(tx,actor,input)));
    const marketingConsent=/^\/api\/v1\/contacts\/([^/]+)\/marketing-consent$/.exec(pathname);
    if(req.method==='PATCH'&&marketingConsent)return json(res,200,await runBody((tx,input)=>recordMarketingConsent(tx,actor,marketingConsent[1],input)));
    if(req.method==='GET'&&pathname==='/api/v1/knowledge')return json(res,200,await run(tx=>listKnowledge(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/knowledge')return json(res,201,await runBody((tx,input)=>createKnowledge(tx,actor,input)));
    const kbPublish=/^\/api\/v1\/knowledge\/([^/]+)\/publish$/.exec(pathname);
    if(req.method==='PATCH'&&kbPublish)return json(res,200,await run(tx=>publishKnowledge(tx,actor,kbPublish[1])));
    if(req.method==='GET'&&pathname==='/api/v1/summary')return json(res,200,await run(tx=>getSummary(tx,actor)));
    if(req.method==='GET'&&pathname==='/api/v1/contacts')return json(res,200,await run(tx=>listContacts(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/contacts')return json(res,201,await runBody((tx,input)=>addContact(tx,actor,input)));
    const contactStatus=/^\/api\/v1\/contacts\/([^/]+)\/status$/.exec(pathname);
    if(req.method==='PATCH'&&contactStatus)return json(res,200,await runBody((tx,input)=>setContactStatus(tx,actor,contactStatus[1],input)));
    const contactNotes=/^\/api\/v1\/contacts\/([^/]+)\/notes$/.exec(pathname);
    if(req.method==='GET'&&contactNotes)return json(res,200,await run(tx=>listContactNotes(tx,actor,contactNotes[1])));
    if(req.method==='POST'&&contactNotes)return json(res,201,await runBody((tx,input)=>addContactNote(tx,actor,contactNotes[1],input)));
    if(req.method==='GET'&&pathname==='/api/v1/team')return json(res,200,await run(tx=>teamMembers(tx,actor)));
    return json(res,404,{error:'Not found'});
  }catch(error){if(error instanceof HttpFailure)return json(res,error.status,{error:error.message});if((error as {code?:string}).code==='23505')return json(res,409,{error:'This record already exists'});if((error as {code?:string}).code==='23503')return json(res,404,{error:'Linked record not found'});console.error('Request failed',error instanceof Error?error.message:'unknown');return json(res,500,{error:'Internal server error'});}
});
server.requestTimeout=15000;
server.listen(port,()=>console.log(`Elhafez Boat API listening on ${port}`));
process.on('SIGTERM',()=>server.close(()=>void pool.end()));