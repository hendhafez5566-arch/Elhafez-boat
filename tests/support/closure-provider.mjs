import {createServer} from 'node:http';
export async function closureProvider(){
 const calls=[],accepted=new Map(),modes=new Map();
 const server=createServer(async(req,res)=>{
  let raw='';for await(const b of req)raw+=b;
  const host=req.headers['x-fixture-host'],url=new URL(req.url,'http://fixture');
  const body=(req.headers['content-type']||'').includes('json')&&raw?JSON.parse(raw):Object.fromEntries(new URLSearchParams(raw));
  calls.push({host,path:url.pathname,method:req.method,body,signature:req.headers['x-elhafez-signature'],idempotencyKey:req.headers['idempotency-key']});res.setHeader('content-type','application/json');
  const mode=modes.get(host)||'';
  if(/^\d+$/.test(mode)){res.writeHead(Number(mode)).end('{}');return}
  if(mode==='reset'){req.socket.destroy();return}
  if(url.pathname.endsWith('/oauth/access_token')&&url.searchParams.get('code')==='fixture-denied-code'){res.writeHead(400).end('{}');return}
  let result={};
  if(url.pathname.endsWith('/messages')&&req.method==='POST'){
   const id='wamid.fixture.'+calls.length;accepted.set(body.biz_opaque_callback_data||id,{id,body});
   if(mode==='hold')return;result=host==='graph.facebook.com'&&body.messaging_product?{messages:[{id}]}:{message_id:id};
  }else if(url.pathname.includes('message_templates'))result={data:[{name:'fixture_notice',language:'en',status:'APPROVED',category:'UTILITY',components:[{type:'BODY',text:'Fixture notification'}]}]};
  else if(url.pathname.endsWith('/getMe'))result={ok:true,result:{id:123456,is_bot:true}};
  else if(url.pathname.includes('/setWebhook'))result={ok:true};
  else if(host==='api.telegram.org')result={ok:true,result:{message_id:123}};
  else if(url.pathname.endsWith('/debug_token'))result={data:{is_valid:true,app_id:'9999911111',scopes:['whatsapp_business_management','whatsapp_business_messaging'],granular_scopes:[{scope:'whatsapp_business_management',target_ids:['876543210','6655443322','2233445566']}],expires_at:Math.floor(Date.now()/1000)+3600}};
  else if(url.pathname.endsWith('/smb_app_data'))result={messaging_product:'whatsapp',request_id:'fixture-sync-request'};
  else if(url.pathname.endsWith('/register'))result={success:true};
  else if(url.pathname.includes('token'))result={access_token:'fixture-access-token-rotated',refresh_token:'fixture-refresh-token',expires_in:3600};
  else if(host==='sheets.googleapis.com')result=req.method==='GET'?{values:[]}:{updates:{updatedRange:'Contacts!A2:D2'}};
  else if(host==='api.hubapi.com')result={id:'123',results:[{id:'123'}]};
  else if(host==='fixture.myshopify.com')result={data:{customerSet:{customer:{id:'gid://shopify/Customer/123'},userErrors:[]}}};
  else if(host==='woo.fixture.test')result=req.method==='GET'?[]:{id:123};
  else if(host==='ai.fixture.test')result={choices:[{message:{content:JSON.stringify({sourceId:null})}}]};
  else if(url.pathname.endsWith('/phone_numbers'))result=url.pathname.includes('2233445566')?{data:[{id:'666666666',display_phone_number:'+15550000003',is_on_biz_app:false,platform_type:'CLOUD_API'}]}:url.pathname.includes('6655443322')?{data:[{id:'888888888',display_phone_number:'+15550000001',is_on_biz_app:true,platform_type:'CLOUD_API'},{id:'888888889',display_phone_number:'+15550000002',is_on_biz_app:true,platform_type:'CLOUD_API'}]}:url.pathname.includes('876543210')?{data:[{id:'777777777',display_phone_number:'+15550783881',is_on_biz_app:true,platform_type:'CLOUD_API'}]}:{data:[{id:'123456789'}]};
  else if(url.pathname.endsWith('/subscribed_apps'))result=req.method==='POST'?{success:true}:{data:[{whatsapp_business_api_data:{id:'9999911111'}}]};
  else if(url.pathname.includes('product_catalogs'))result={data:[{id:'777777'}]};
  else if(url.pathname.includes('whatsapp_commerce_settings'))result={data:[{is_catalog_visible:true}]};
  else result={id:url.pathname.split('/').at(-1),display_phone_number:url.pathname.endsWith('/777777777')?'+15550783881':url.pathname.endsWith('/888888888')?'+15550000001':url.pathname.endsWith('/888888889')?'+15550000002':'+10000000000',is_on_biz_app:!url.pathname.endsWith('/666666666'),platform_type:'CLOUD_API'};
  res.end(JSON.stringify(result));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {origin:'http://127.0.0.1:'+server.address().port,calls,accepted,modes,close:()=>new Promise(r=>{server.closeAllConnections();server.close(r)})};
}
