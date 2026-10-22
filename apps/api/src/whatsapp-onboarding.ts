/** Tenant-owned official Embedded Signup. No production simulation switch. */
import {randomBytes,createHash} from 'node:crypto';
import {allow,HttpFailure,isUuid,withTenantTransaction,type Actor,type SqlClient,type SqlPool} from './services.js';
import {connectWhatsApp,decryptAccessToken,encryptAccessToken,diagnoseWhatsApp} from './whatsapp.js';
const obj=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
const digits=(v:unknown):v is string=>typeof v==='string'&&/^\d{5,30}$/.test(v);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function onboardingConfiguration(){
 const appId=process.env.META_APP_ID||'',cloud=process.env.META_EMBEDDED_CONFIG_ID||'',coexist=process.env.META_COEXISTENCE_CONFIG_ID||'';
 const version=process.env.META_GRAPH_VERSION||'';
 const origin=process.env.APP_PUBLIC_ORIGIN||'';let https=false;try{const u=new URL(origin);https=u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash}catch{}
 const base=process.env.META_EMBEDDED_SIGNUP_ENABLED==='true'&&process.env.META_ONBOARDING_REVIEWED==='true'&&digits(appId)&&/^v\d{1,2}\.\d{1,2}$/.test(version)&&https&&!!process.env.META_APP_SECRET&&!!process.env.META_WEBHOOK_VERIFY_TOKEN&&Buffer.from(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY||'','base64').length===32;
 return {appId,version,cloudAvailable:!!(base&&digits(cloud)),coexistenceAvailable:!!(base&&digits(coexist)&&process.env.META_COEXISTENCE_ENABLED==='true'),reason:base?'CONFIG_OR_ELIGIBILITY_REQUIRED':'PLATFORM_SETUP_REQUIRED'};
}
export function requireSignupOrigin(origin:unknown){
 if(typeof origin!=='string'||origin!==process.env.APP_PUBLIC_ORIGIN)throw new HttpFailure(403,'افتح الربط من نطاق المنصة المعتمد');
}
export async function beginWhatsAppSignup(db:SqlClient,actor:Actor,input:unknown){
 allow(actor,['OWNER']);const d=obj(input),cfg=onboardingConfiguration(),mode=d.mode;
 if(!['CLOUD','COEXISTENCE'].includes(mode))throw new HttpFailure(400,'اختر نوع الرقم');
 if(!(mode==='CLOUD'?cfg.cloudAvailable:cfg.coexistenceAvailable))throw new HttpFailure(503,'الربط الرسمي ينتظر إعداد واعتماد تطبيق المنصة لدى Meta؛ لا تحتاج إلى إدخال رموز يدوياً');
 // One active attempt per owner; prior attempts cannot finish after a new popup starts.
 await db.query("UPDATE whatsapp_onboarding_attempts SET status='CANCELLED',error_code='SUPERSEDED',token_encrypted=NULL,phone_choices=NULL WHERE tenant_id=$1 AND user_id=$2 AND status IN ('PENDING','SELECT_PHONE')",[actor.tenantId,actor.userId]);
 const nonce=randomBytes(32).toString('base64url');
 const r=await db.query(`INSERT INTO whatsapp_onboarding_attempts(tenant_id,user_id,nonce_hash,mode) VALUES($1,$2,$3,$4) RETURNING id,expires_at`,[actor.tenantId,actor.userId,hash(nonce),mode]);
 return {attemptId:r.rows[0].id,nonce,expiresAt:r.rows[0].expires_at,appId:cfg.appId,version:cfg.version,configId:mode==='CLOUD'?process.env.META_EMBEDDED_CONFIG_ID:process.env.META_COEXISTENCE_CONFIG_ID,mode};
}
/** Server-selected Graph paths, bounded body/time, no redirects or upstream error text. */
export async function signupGraph(path:string,token:string,method='GET',body?:Record<string,unknown>){
 const version=process.env.META_GRAPH_VERSION||'';if(!/^v\d{1,2}\.\d{1,2}$/.test(version))throw new HttpFailure(503,'META_VERSION_MISSING');
 try{
  const response=await fetch('https://graph.facebook.com/'+version+'/'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('provider');
  const reader=response.body?.getReader();if(!reader)throw new Error('empty');let size=0;const chunks:Uint8Array[]=[];
  try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>262144)throw new Error('large');chunks.push(r.value)}}finally{await reader.cancel().catch(()=>{})}
  return obj(JSON.parse(Buffer.concat(chunks).toString()));
 }catch{throw new HttpFailure(502,'تعذر إكمال التحقق الرسمي؛ أعد التفويض. لم يتم إرسال أي رسالة');}
}
export function checkTokenDebug(data:unknown,waba:string){
 const d=obj(obj(data).data);const scopes=Array.isArray(d.scopes)?d.scopes:[];
 if(d.is_valid!==true||d.app_id!==process.env.META_APP_ID||!scopes.includes('whatsapp_business_management')||!scopes.includes('whatsapp_business_messaging'))throw new HttpFailure(400,'التفويض لا يخص تطبيق المنصة أو تنقصه صلاحيات واتساب');
 if(Number(d.expires_at)>0&&Number(d.expires_at)*1000<=Date.now())throw new HttpFailure(400,'انتهت صلاحية التفويض');
 const targets=(Array.isArray(d.granular_scopes)?d.granular_scopes:[]).filter((s:any)=>s.scope==='whatsapp_business_management').flatMap((s:any)=>Array.isArray(s.target_ids)?s.target_ids:[]);
 if(!targets.includes(waba))throw new HttpFailure(400,'حساب واتساب غير موجود ضمن الأصول المفوضة؛ أعد اختيار حساب الشركة');
 return Number(d.expires_at)>0?new Date(Number(d.expires_at)*1000).toISOString():null;
}
export async function cancelWhatsAppSignup(db:SqlClient,actor:Actor,id:string,nonce:string){
 allow(actor,['OWNER']);if(!isUuid(id))throw new HttpFailure(400,'INVALID_ATTEMPT');
 const r=await db.query("UPDATE whatsapp_onboarding_attempts SET status='CANCELLED',error_code='USER_CANCELLED',token_encrypted=NULL,phone_choices=NULL WHERE tenant_id=$1 AND id=$2 AND user_id=$3 AND nonce_hash=$4 AND status IN ('PENDING','SELECT_PHONE') RETURNING id",[actor.tenantId,id,actor.userId,hash(nonce)]);
 return {cancelled:r.rowCount===1};
}
export async function finishWhatsAppSignup(pool:SqlPool,actor:Actor,input:unknown,nonce:string){
 allow(actor,['OWNER']);const d=obj(input);if(!isUuid(d.attemptId)||!digits(d.wabaId)||(d.phoneNumberId!==undefined&&!digits(d.phoneNumberId))||(!d.code&&!digits(d.phoneNumberId))||(d.code&&(typeof d.code!=='string'||d.code.length<8||d.code.length>4096))||!/^[-\w]{43}$/.test(nonce))throw new HttpFailure(400,'نتيجة الربط غير مكتملة؛ أعد المحاولة');
 const attempt=await withTenantTransaction(pool,actor,async db=>{
  const r=await db.query(`UPDATE whatsapp_onboarding_attempts SET status='PROCESSING' WHERE tenant_id=$1 AND id=$2 AND user_id=$3 AND nonce_hash=$4 AND status=$5 AND expires_at>now() RETURNING mode,token_encrypted,authorized_waba,phone_choices`,[actor.tenantId,d.attemptId,actor.userId,hash(nonce),d.code?'PENDING':'SELECT_PHONE']);
  if(r.rowCount!==1)throw new HttpFailure(409,'انتهت جلسة الربط أو استُخدمت؛ ابدأ عملية جديدة');return r.rows[0];
 });
 const cfg=onboardingConfiguration();
 if(!(attempt.mode==='CLOUD'?cfg.cloudAvailable:cfg.coexistenceAvailable))throw new HttpFailure(503,'الربط غير مفعّل على المنصة');
 try{
  const appSecret=process.env.META_APP_SECRET||'';
  let token:string,expires:string|null;
  if(d.code){
   const tokenReply=await signupGraph('oauth/access_token?'+new URLSearchParams({client_id:cfg.appId,client_secret:appSecret,code:d.code}),cfg.appId+'|'+appSecret);
   token=tokenReply.access_token;if(typeof token!=='string'||token.length<20||token.length>2048)throw new HttpFailure(502,'لم يُرجع Meta تفويضًا صالحًا');
   expires=checkTokenDebug(await signupGraph('debug_token?'+new URLSearchParams({input_token:token}),cfg.appId+'|'+appSecret),d.wabaId);
   const list=await signupGraph(d.wabaId+'/phone_numbers?fields=id,display_phone_number,is_on_biz_app,platform_type&limit=100',token);
   const phones=(Array.isArray(list.data)?list.data:[]).filter((p:any)=>digits(p.id)&&(attempt.mode==='COEXISTENCE'?p.is_on_biz_app===true:p.is_on_biz_app!==true));
   if(d.phoneNumberId&&!phones.some((p:any)=>p.id===d.phoneNumberId))throw new HttpFailure(400,'الرقم المختار لا ينتمي إلى الحساب المفوض');
   if(!d.phoneNumberId&&phones.length===1)d.phoneNumberId=phones[0].id;
   if(!d.phoneNumberId){
    if(!phones.length)throw new HttpFailure(400,'لم يُرجع Meta رقمًا مؤهلًا؛ راجع أهلية الحساب داخل Meta');
    await withTenantTransaction(pool,actor,db=>db.query("UPDATE whatsapp_onboarding_attempts SET status='SELECT_PHONE',token_encrypted=$3,authorized_waba=$4,phone_choices=$5::jsonb WHERE tenant_id=$1 AND id=$2",[actor.tenantId,d.attemptId,encryptAccessToken(token),d.wabaId,JSON.stringify(phones.map((p:any)=>({id:p.id,displayPhone:p.display_phone_number})))]));
    return {requiresSelection:true,attemptId:d.attemptId,wabaId:d.wabaId,phones:phones.map((p:any)=>({id:p.id,displayPhone:p.display_phone_number}))};
   }
  }else{
   if(attempt.authorized_waba!==d.wabaId||!Array.isArray(attempt.phone_choices)||!attempt.phone_choices.some((p:any)=>p.id===d.phoneNumberId))throw new HttpFailure(400,'اختيار الرقم غير صالح');
   token=decryptAccessToken(String(attempt.token_encrypted));
   expires=checkTokenDebug(await signupGraph('debug_token?'+new URLSearchParams({input_token:token}),cfg.appId+'|'+appSecret),d.wabaId);
  }
  const phone=await signupGraph(d.phoneNumberId+'?fields=id,is_on_biz_app,platform_type',token);
  if(phone.id!==d.phoneNumberId||attempt.mode==='COEXISTENCE'&&phone.is_on_biz_app!==true)throw new HttpFailure(400,'لم يؤكد Meta أن الرقم مؤهل للتعايش مع تطبيق بيزنس');
  if(attempt.mode==='CLOUD'&&phone.is_on_biz_app===true)throw new HttpFailure(400,'هذا الرقم يستخدم تطبيق Business؛ اختر مسار واتساب بيزنس الحالي');
  // Claim tenant ownership before any subscription writes; connection validates WABA membership.
  const account=await withTenantTransaction(pool,actor,async db=>{
   const current=await db.query("SELECT id FROM whatsapp_onboarding_attempts WHERE tenant_id=$1 AND id=$2 AND status='PROCESSING' AND expires_at>now() FOR UPDATE",[actor.tenantId,d.attemptId]);if(current.rowCount!==1)throw new HttpFailure(409,'ألغيت عملية الربط أو انتهت صلاحيتها');
   const account=await connectWhatsApp(db,actor,{phoneNumberId:d.phoneNumberId,wabaId:d.wabaId,accessToken:token});
   await db.query(`UPDATE whatsapp_accounts SET connection_mode=$3,authorization_status='VERIFIED',token_expires_at=$4,history_consent=$5,contacts_consent=$6,subscription_verified_at=NULL,phone_platform=$7,phone_verified_at=now() WHERE tenant_id=$1 AND id=$2`,[actor.tenantId,account.id,attempt.mode,expires,attempt.mode==='COEXISTENCE'&&d.historyConsent===true,attempt.mode==='COEXISTENCE'&&d.contactsConsent===true,phone.platform_type||null]);
   return account;
  });
  let subscribed=false;
  try{
   const result=await signupGraph(d.wabaId+'/subscribed_apps',token,'POST',{});
   if(result.success!==true)throw new Error('not subscribed');
   const list=await signupGraph(d.wabaId+'/subscribed_apps?limit=100',token);
   subscribed=Array.isArray(list.data)&&list.data.some((s:any)=>obj(s.whatsapp_business_api_data).id===cfg.appId);
  }catch{/* Saved ownership is preserved; UI reports partial activation. No blind code replay. */}
  await withTenantTransaction(pool,actor,async db=>{
   await db.query(`UPDATE whatsapp_accounts SET subscription_verified_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE tenant_id=$1 AND id=$2`,[actor.tenantId,account.id,subscribed]);
   await db.query("UPDATE whatsapp_onboarding_attempts SET status='COMPLETE',completed_at=now(),account_id=$3,token_encrypted=NULL,phone_choices=NULL WHERE tenant_id=$1 AND id=$2",[actor.tenantId,d.attemptId,account.id]);
  });
  return {accountId:account.id,authorized:true,subscribed,receivingVerified:false,mode:attempt.mode,registration:'CHECK_PHONE_IN_META',history:'NOT_REQUESTED'};
 }catch(e){
  await withTenantTransaction(pool,actor,db=>db.query("UPDATE whatsapp_onboarding_attempts SET status='FAILED',error_code='AUTHORIZATION_FAILED',token_encrypted=NULL,phone_choices=NULL WHERE tenant_id=$1 AND id=$2",[actor.tenantId,d.attemptId])).catch(()=>{});
  if(e instanceof HttpFailure)throw e;throw new HttpFailure(502,'تعذر إكمال الربط؛ ابدأ تفويضًا جديدًا');
 }
}
export async function selfServiceAccounts(db:SqlClient,actor:Actor){
 allow(actor,['OWNER','MANAGER']);return (await db.query(`SELECT a.id,a.phone_number_id AS "phoneNumberId",a.display_phone AS "displayPhone",a.status,a.phone_platform AS "phonePlatform",a.phone_verified_at AS "phoneVerifiedAt",a.connection_mode AS mode,CASE WHEN a.token_expires_at<=now() THEN 'REAUTH_REQUIRED' ELSE a.authorization_status END AS authorization,a.subscription_verified_at AS "subscriptionVerifiedAt",a.last_inbound_at AS "lastInboundAt",a.last_echo_at AS "lastEchoAt",a.token_expires_at AS "expiresAt",a.sync_status AS "syncStatus",
 (SELECT max(last_seen_at) FROM chatbot_worker_health WHERE tenant_id=$1) AS "workerSeenAt",
 coalesce((SELECT jsonb_agg(jsonb_build_object('operation',o.operation,'status',o.status,'createdAt',o.created_at)) FROM whatsapp_signup_operations o WHERE o.tenant_id=a.tenant_id AND o.account_id=a.id),'[]'::jsonb) AS operations,
 (SELECT count(*)::int FROM whatsapp_outbox j WHERE j.tenant_id=a.tenant_id AND j.account_id=a.id AND j.status='UNCERTAIN') AS uncertain
 FROM whatsapp_accounts a WHERE a.tenant_id=$1 ORDER BY a.created_at DESC`,[actor.tenantId])).rows;
}

/** One durable claim before a provider write: unknown outcomes are never automatically repeated. */
export async function requestSignupOperation(pool:SqlPool,actor:Actor,accountId:string,input:unknown){
 allow(actor,['OWNER']);const d=obj(input),operation=d.operation;
 if(!isUuid(accountId)||!['history','smb_app_state_sync','register'].includes(operation))throw new HttpFailure(400,'عملية غير صالحة');
 const account=await withTenantTransaction(pool,actor,async db=>{
  const r=await db.query(`SELECT a.*,s.id AS attempt_id FROM whatsapp_accounts a JOIN whatsapp_onboarding_attempts s ON s.tenant_id=a.tenant_id AND s.account_id=a.id AND s.status='COMPLETE' WHERE a.tenant_id=$1 AND a.id=$2 AND a.status='CONNECTED' ORDER BY s.completed_at DESC LIMIT 1 FOR UPDATE OF a`,[actor.tenantId,accountId]);const a=r.rows[0];if(!a)throw new HttpFailure(404,'أعد التفويض قبل تهيئة الرقم');
  const cfg=onboardingConfiguration();if(!(a.connection_mode==='COEXISTENCE'?cfg.coexistenceAvailable:cfg.cloudAvailable))throw new HttpFailure(503,'التهيئة غير مفعلة على المنصة');
  if(operation==='register'){if(a.connection_mode!=='CLOUD'||typeof d.pin!=='string'||!/^\d{6}$/.test(d.pin))throw new HttpFailure(400,'تهيئة Cloud فقط: أدخل رمز حماية جديدًا من 6 أرقام، وليس OTP');}
  else if(a.connection_mode!=='COEXISTENCE'||d.consent!==true)throw new HttpFailure(400,'موافقة صريحة مطلوبة قبل المزامنة');
  const claim=await db.query(`INSERT INTO whatsapp_signup_operations(tenant_id,account_id,attempt_id,operation) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING operation`,[actor.tenantId,accountId,a.attempt_id,operation]);if(claim.rowCount!==1)throw new HttpFailure(409,'سبق طلب هذه العملية؛ افحص الحالة ولا تكرر طلبًا مجهول المصير');
  if(operation!=='register')await db.query(`UPDATE whatsapp_accounts SET history_consent=CASE WHEN $3='history' THEN true ELSE history_consent END,contacts_consent=CASE WHEN $3='smb_app_state_sync' THEN true ELSE contacts_consent END WHERE tenant_id=$1 AND id=$2`,[actor.tenantId,accountId,operation]);
  return a;
 });
 let status='UNCERTAIN';try{
  const result=await signupGraph(String(account.phone_number_id)+(operation==='register'?'/register':'/smb_app_data'),decryptAccessToken(String(account.access_token_encrypted)),'POST',operation==='register'?{messaging_product:'whatsapp',pin:d.pin}:{messaging_product:'whatsapp',sync_type:operation});
  if(operation==='register'?result.success===true:typeof result.request_id==='string')status='REQUESTED';
 }catch{/* Do not retry potentially accepted state-changing provider calls. */}
 await withTenantTransaction(pool,actor,db=>db.query('UPDATE whatsapp_signup_operations SET status=$5 WHERE tenant_id=$1 AND account_id=$2 AND attempt_id=$3 AND operation=$4',[actor.tenantId,accountId,account.attempt_id,operation,status]));
 return {status,operation,receivingVerified:false};
}

export async function diagnoseSignupAccount(db:SqlClient,actor:Actor,accountId:string){
 allow(actor,['OWNER']);const baseline=await diagnoseWhatsApp(db,actor,accountId);if(!baseline.verified)return baseline;
 const a=(await db.query('SELECT access_token_encrypted,waba_id FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2',[actor.tenantId,accountId])).rows[0];
 const cfg=onboardingConfiguration();if(!cfg.appId||!process.env.META_APP_SECRET)return {...baseline,authorization:'NOT_CHECKED'};
 const token=decryptAccessToken(String(a.access_token_encrypted));
 const result=await signupGraph('debug_token?'+new URLSearchParams({input_token:token}),cfg.appId+'|'+process.env.META_APP_SECRET);
 try{checkTokenDebug(result,String(a.waba_id))}catch{
  await db.query("UPDATE whatsapp_accounts SET status='DISABLED',authorization_status='REAUTH_REQUIRED' WHERE tenant_id=$1 AND id=$2",[actor.tenantId,accountId]);
  await db.query("UPDATE whatsapp_outbox SET status='FAILED',last_error='Meta authorization revoked or expired' WHERE tenant_id=$1 AND account_id=$2 AND status='PENDING'",[actor.tenantId,accountId]);
  return {verified:false,reason:'REAUTH_REQUIRED',liveAcceptance:false};
 }
 await db.query("UPDATE whatsapp_accounts SET authorization_status='VERIFIED',subscription_verified_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE tenant_id=$1 AND id=$2",[actor.tenantId,accountId,baseline.subscribed]);
 return {...baseline,authorization:'VERIFIED'};
}
