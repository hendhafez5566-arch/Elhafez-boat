/** Additional real PostgreSQL and local ClamAV acceptance. Disposable database only. */
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {withTenantTransaction} from '../.build/apps/api/src/services.js';
import {workspaceSummary,completeWorkspaceSetup} from '../.build/apps/api/src/workspace-setup.js';
import {uploadMedia,privateMedia,publicMedia,deleteMedia} from '../.build/apps/api/src/media.js';
import {processMediaScan,scanBytes} from '../.build/apps/api/src/media-scan.js';
import {setWhatsAppHandoff,replyWhatsApp} from '../.build/apps/api/src/whatsapp.js';
import {botFlow} from '../.build/apps/api/src/bots.js';
import {createIntegration,inspectIntegration,listIntegrations,updateIntegration} from '../.build/apps/api/src/integrations.js';
const url=process.env.MIGRATION_DATABASE_URL;if(!url||!new URL(url).pathname.endsWith('/elhafez_ci'))throw Error('Disposable elhafez_ci required');
const admin=new pg.Client({connectionString:url});await admin.connect();
const role='completion_'+randomBytes(5).toString('hex'),password=randomBytes(24).toString('hex');let pool;
try{
 await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS`);await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
 const runtime=new URL(url);runtime.username=role;runtime.password=password;pool=new pg.Pool({connectionString:runtime.toString()});const actors=[];
 for(let i=0;i<2;i++){const tenantId=randomUUID(),userId=randomUUID();await admin.query('INSERT INTO tenants(id,slug,name) VALUES($1,$2,$3)',[tenantId,'completion-'+tenantId,'Original fixture']);await admin.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[userId,userId+'@example.invalid','not-login']);await admin.query("INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'OWNER')",[tenantId,userId]);actors.push({tenantId,userId,role:'OWNER'})}
 const [a,b]=actors,tx=(actor,fn)=>withTenantTransaction(pool,actor,fn);
 const setup={requestId:randomUUID(),name:'البوت الأول',templateId:'service',setup:{businessName:'شركة تجريبية محلية',greeting:'أهلًا من الشركة',collectPhone:false}};
 const created=await tx(a,db=>completeWorkspaceSetup(db,a,setup));assert.equal((await tx(a,db=>workspaceSummary(db,a))).name,setup.setup.businessName);
 const repeated=await tx(a,db=>completeWorkspaceSetup(db,a,setup));assert.equal(repeated.id,created.id);assert.equal(repeated.replayed,true);assert.equal((await tx(a,db=>workspaceSummary(db,a))).bots,1);
 await assert.rejects(tx({...a,role:'MANAGER'},db=>completeWorkspaceSetup(db,{...a,role:'MANAGER'},setup)),e=>e.status===403);
 assert.equal((await tx(b,db=>workspaceSummary(db,b))).name,'Original fixture');assert.equal((await tx(a,db=>botFlow(db,a,String(created.id),'get'))).published,null);
 await assert.rejects(tx(a,db=>completeWorkspaceSetup(db,a,{...setup,requestId:randomUUID(),setup:{businessName:''}})),e=>e.status===400);assert.equal((await tx(a,db=>workspaceSummary(db,a))).bots,1);
 console.log('PASS atomic workspace setup, retained unpublished draft, retry idempotency, owner guard, invalid rollback and tenant separation');
 if(!process.env.CLAMAV_SOCKET)throw Error('Real local ClamAV is required');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
 assert.equal(await scanBytes(png),'CLEAN');const asset=await tx(a,db=>uploadMedia(db,a,{name:'Fixture.png',base64:png.toString('base64')}));
 await assert.rejects(tx(a,db=>privateMedia(db,a,String(asset.id))),e=>e.status===404);await tx(a,db=>processMediaScan(db,a.tenantId));assert.deepEqual((await tx(a,db=>privateMedia(db,a,String(asset.id)))).content,png);await assert.rejects(tx(b,db=>privateMedia(db,b,String(asset.id))),e=>e.status===404);
 const token=(await admin.query('SELECT public_token FROM chatbot_media WHERE tenant_id=$1 AND id=$2',[a.tenantId,asset.id])).rows[0].public_token;
 const config=await tx(a,db=>botFlow(db,a,String(created.id),'get'));const definition={name:'Protected media',startId:'s',nodes:[{id:'s',type:'START',next:'media'},{id:'media',type:'MEDIA',mediaKind:'image',url:'https://fixture.invalid/api/v1/media/public/'+token,next:'end'},{id:'end',type:'END',text:'انتهى'}]};
 await tx(a,db=>botFlow(db,a,String(created.id),'draft',{...definition,expectedRevision:config.draft.draftRevision}));await tx(a,db=>botFlow(db,a,String(created.id),'publish'));await assert.rejects(tx(a,db=>deleteMedia(db,a,String(asset.id))),e=>e.status===409);
 const spare=await tx(a,db=>uploadMedia(db,a,{name:'Spare.png',base64:png.toString('base64')}));await tx(a,db=>processMediaScan(db,a.tenantId));await tx(a,db=>deleteMedia(db,a,String(spare.id)));await assert.rejects(tx(a,db=>privateMedia(db,a,String(spare.id))),e=>e.status===404);
 const eicar=Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');assert.equal(await scanBytes(eicar),'QUARANTINED');const infected=await tx(a,db=>uploadMedia(db,a,{name:'Fixture.pdf',base64:Buffer.concat([Buffer.from('%PDF-1.0\n'),eicar]).toString('base64')}));await tx(a,db=>processMediaScan(db,a.tenantId));await assert.rejects(tx(a,db=>privateMedia(db,a,String(infected.id))),e=>e.status===404);
 const unavailable=await tx(a,db=>uploadMedia(db,a,{name:'Pending.png',base64:png.toString('base64')}));const socket=process.env.CLAMAV_SOCKET;process.env.CLAMAV_SOCKET='/tmp/boat-no-scanner.sock';await tx(a,db=>processMediaScan(db,a.tenantId));await assert.rejects(tx(a,db=>privateMedia(db,a,String(unavailable.id))),e=>e.status===404);process.env.CLAMAV_SOCKET=socket;await tx(a,db=>processMediaScan(db,a.tenantId));assert.deepEqual((await tx(a,db=>privateMedia(db,a,String(unavailable.id)))).content,png);
 console.log('PASS real ClamAV clean/quarantine/offline/recovery; private preview tenant guards; independent published-bot reference deletion denied; unused deletion succeeds');
 process.env.OUTBOUND_WEBHOOK_HOSTS='webhook.fixture.invalid';process.env.INTEGRATION_SECRET_ENCRYPTION_KEY=randomBytes(32).toString('base64');assert.equal(inspectIntegration(a,{url:'https://webhook.fixture.invalid/hook'}).queued,0);
 assert.throws(()=>inspectIntegration(a,{url:'https://127.0.0.1/private'}));const integration=await tx(a,db=>createIntegration(db,a,{name:'Local setting',url:'https://webhook.fixture.invalid/hook',authMode:'BEARER',secret:'DISPOSABLE-NOT-A-PROVIDER-SECRET'}));const rows=await tx(a,db=>listIntegrations(db,a));assert.equal(JSON.stringify(rows).includes('DISPOSABLE'),false);await tx(a,db=>updateIntegration(db,a,String(integration.id),{enabled:false,secret:'ROTATED-DISPOSABLE-SECRET'}));assert.equal((await tx(a,db=>listIntegrations(db,a)))[0].enabled,false);await assert.rejects(tx(b,db=>updateIntegration(db,b,String(integration.id),{enabled:false})),e=>e.status===404);
 const agents=[];for(let i=0;i<2;i++){const userId=randomUUID();await admin.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[userId,userId+'@example.invalid','not-login']);await admin.query("INSERT INTO memberships(tenant_id,user_id,role) VALUES($1,$2,'AGENT')",[a.tenantId,userId]);agents.push({...a,userId,role:'AGENT'})}
 const contact=(await admin.query("INSERT INTO contacts(tenant_id,full_name,source) VALUES($1,'Local concurrent contact','IMPORT') RETURNING id",[a.tenantId])).rows[0].id;
 const conversation=(await admin.query("INSERT INTO conversations(tenant_id,contact_id,channel) VALUES($1,$2,'WEBSITE') RETURNING id",[a.tenantId,contact])).rows[0].id;
 const takeover=await Promise.allSettled(agents.map(actor=>tx(actor,db=>setWhatsAppHandoff(db,actor,conversation,{status:'HUMAN'}))));assert.equal(takeover.filter(r=>r.status==='fulfilled').length,1);assert.equal(takeover.find(r=>r.status==='rejected').reason.status,409);
 const winning=agents[takeover.findIndex(r=>r.status==='fulfilled')],losing=agents.find(actor=>actor.userId!==winning.userId);
 await assert.rejects(tx(losing,db=>replyWhatsApp(db,losing,conversation,{body:'Denied reply'})),e=>e.status===403);await tx(winning,db=>replyWhatsApp(db,winning,conversation,{body:'Actual assigned website reply'}));
 assert.equal((await admin.query("SELECT count(*)::int AS n FROM conversation_messages WHERE tenant_id=$1 AND conversation_id=$2 AND body='Actual assigned website reply'",[a.tenantId,conversation])).rows[0].n,1);
 await tx(a,db=>setWhatsAppHandoff(db,a,conversation,{status:'CLOSED'}));await assert.rejects(tx(winning,db=>replyWhatsApp(db,winning,conversation,{body:'After close'})),e=>e.status===403);
 console.log('PASS real simultaneous agent takeover, exactly one owner, denied competing/closed reply and stored assigned website reply');
 process.env.PLATFORM_DATABASE_URL=url;const {createTenant,acceptFirstOwner,platformEvents}=await import('../.build/apps/api/src/platform.js');
 const platformOwner=(await admin.query('INSERT INTO platform_owners(email,password_hash) VALUES($1,$2) RETURNING id',['completion-admin-'+randomUUID()+'@example.invalid','not-login'])).rows[0].id;
 const ownerEmail='company-owner-'+randomUUID()+'@example.invalid',newCompany=await createTenant(platformOwner,{name:'شركة تفعيل محلية',slug:'new-'+randomBytes(6).toString('hex'),ownerEmail,planCode:'STARTER'});
 const activated=await acceptFirstOwner({token:newCompany.ownerInviteToken,email:ownerEmail,password:'Disposable-owner-password-1234'});assert.equal(activated.tenantSlug,newCompany.slug);
 await assert.rejects(acceptFirstOwner({token:newCompany.ownerInviteToken,email:ownerEmail,password:'Disposable-owner-password-1234'}),e=>e.status===404);
 const events=await platformEvents(platformOwner);assert.ok(events.some(row=>row.companySlug===newCompany.slug));assert.ok(events.every(row=>Object.keys(row).every(key=>['action','createdAt','companyName','companySlug'].includes(key))));
 console.log('PASS real platform company provision/owner activation/company login hint, single-use invitation and administrative-only audit fields');
 console.log('PASS local integration inspection with zero queued jobs; real secret encryption/rotation without disclosure, disable and tenant denial; no outbound connection');
}finally{await pool?.end();await admin.end()}
