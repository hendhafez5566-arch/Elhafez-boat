/** Loopback-only contract fixtures. Never selected by production integration code. */
import {createServer} from 'node:http';
export async function providerSimulator(){
 const calls=[],effects=new Map();
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536){res.writeHead(413).end();return}}
  const body=raw?JSON.parse(raw):{};calls.push({path:url.pathname,method:req.method,body,authorization:!!req.headers.authorization});
  const mode=url.searchParams.get('mode');
  res.setHeader('content-type','application/json');
  if(mode==='timeout'){req.socket.destroy();return}
  if(mode==='redirect'){res.writeHead(307,{location:'/unexpected'}).end();return}
  if(mode==='429'){res.writeHead(429,{'retry-after':'1'}).end('{"error":"rate_limited"}');return}
  if(mode==='500'){res.writeHead(500).end('{"error":"server_error"}');return}
  if(mode==='malformed'){res.end('{');return}
  if(mode==='oversized'){res.end(JSON.stringify({data:'x'.repeat(70000)}));return}
  const key=req.headers['idempotency-key'];
  if(key&&effects.has(key)){res.end(JSON.stringify(effects.get(key)));return}
  const id='sim-'+(effects.size+1);let result;
  if(url.pathname.includes('oauth')||url.pathname.includes('token'))result={access_token:'sim-access',refresh_token:'sim-refresh',expires_in:3600,token_type:'Bearer'};
  else if(url.pathname.includes('sheets'))result={spreadsheetId:'sim-sheet',updatedRange:'Contacts!A2:C2',updates:{updatedRows:1}};
  else if(url.pathname.includes('hubspot'))result={id:'123',results:[{id:'123'}]};
  else if(url.pathname.includes('shopify'))result={data:{customerSet:{customer:{id:'gid://shopify/Customer/123'},userErrors:[]}}};
  else if(url.pathname.includes('woocommerce'))result={id:123,email:body.email};
  else if(url.pathname.includes('ai'))result={choices:[{message:{content:'Approved fixture answer'}}]};
  else if(url.pathname.includes('telegram'))result={ok:true,result:{message_id:123}};
  else if(url.pathname.includes('whatsapp'))result={messages:[{id}]};
  else if(url.pathname.includes('messenger')||url.pathname.includes('instagram'))result={message_id:id};
  else {res.writeHead(404).end('{}');return}
  if(key)effects.set(key,result);
  res.end(JSON.stringify(result));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {base:'http://127.0.0.1:'+server.address().port,calls,effects,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)})};
}
