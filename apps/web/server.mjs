import { createServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
const port=Number(process.env.WEB_PORT??3000);
const api=new URL(process.env.API_INTERNAL_ORIGIN??'http://127.0.0.1:4000');
if(api.protocol!=='http:')throw new Error('API_INTERNAL_ORIGIN must be an internal http URL behind trusted network boundaries');
const assets={
 '/bot-setup.js':['bot-setup.js','text/javascript; charset=utf-8'],
 '/bot-manager.js':['bot-manager.js','text/javascript; charset=utf-8'],
 '/':['index.html','text/html; charset=utf-8'],
 '/widget.js':['widget.js','text/javascript; charset=utf-8'],
 '/commerce-ui.js':['commerce-ui.js','text/javascript; charset=utf-8'],
 '/advanced-ui.js':['advanced-ui.js','text/javascript; charset=utf-8'],
 '/campaign-wizard.js':['campaign-wizard.js','text/javascript; charset=utf-8'],
 '/media-ui.js':['media-ui.js','text/javascript; charset=utf-8'],
 '/extensions.js':['extensions.js','text/javascript; charset=utf-8'],
 '/app.js':['app.js','text/javascript; charset=utf-8'],
 '/style.css':['style.css','text/css; charset=utf-8'],
 '/whatsapp-signup.js':['whatsapp-signup.js','text/javascript; charset=utf-8'],
 '/team-ui.js':['team-ui.js','text/javascript; charset=utf-8'],
 '/workspace-ui.js':['workspace-ui.js','text/javascript; charset=utf-8'],
 '/ui-states.js':['ui-states.js','text/javascript; charset=utf-8'],
 '/operations.css':['style.css','text/css; charset=utf-8'],
 '/flow-canvas.js':['flow-canvas.js','text/javascript; charset=utf-8'],
 '/flow-geometry.js':['flow-geometry.js','text/javascript; charset=utf-8'],
 '/flow-merge.js':['flow-merge.js','text/javascript; charset=utf-8'],
 '/flow-builder.js':['flow-builder.js','text/javascript; charset=utf-8'],
 '/flow-onboarding.js':['flow-onboarding.js','text/javascript; charset=utf-8'],
 '/analytics-export.js':['analytics-export.js','text/javascript; charset=utf-8'],
 '/insights-ui.js':['insights-ui.js','text/javascript; charset=utf-8'],
 '/flow-builder.css':['flow-builder.css','text/css; charset=utf-8'],
 '/vessel.css':['vessel.css','text/css; charset=utf-8'],
 '/vessel.js':['vessel.js','text/javascript; charset=utf-8'],
 '/vessel-pages.js':['vessel-pages.js','text/javascript; charset=utf-8'],
 '/platform.html':['platform.html','text/html; charset=utf-8'],
 '/platform.js':['platform.js','text/javascript; charset=utf-8'],
 '/join.html':['join.html','text/html; charset=utf-8'],
 '/join.js':['join.js','text/javascript; charset=utf-8']
};
const server=createServer(async(req,res)=>{
 const path=new URL(req.url??'/',`http://localhost:${port}`).pathname;
 if(path.startsWith('/api/')||path==='/health'){
   // Same-origin backend gateway: forwards authenticated API requests without browser CORS exceptions.
   const upstream=httpRequest({hostname:api.hostname.replace(/^\[|\]$/g,''),port:api.port||80,path:req.url,method:req.method,headers:{...req.headers,host:api.host,'x-forwarded-for':req.socket.remoteAddress||''}},reply=>{res.writeHead(reply.statusCode??502,{'content-type':reply.headers['content-type']??'application/json','cache-control':'no-store',...(reply.headers['set-cookie']?{'set-cookie':reply.headers['set-cookie']}:{}),...(reply.headers['referrer-policy']?{'referrer-policy':reply.headers['referrer-policy']}:{}),...(path.startsWith('/api/v1/widget/')?Object.fromEntries(Object.entries(reply.headers).filter(([k])=>k.startsWith('access-control-')||k==='vary')):{}),...((path.startsWith('/api/v1/media/public/')||/^\/api\/v1\/media\/[a-f0-9-]+\/content$/.test(path))?{'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox",'content-disposition':reply.headers['content-disposition']||'attachment'}:{})});reply.pipe(res)});
   upstream.on('error',()=>{if(!res.headersSent){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({error:'API غير متاح حاليًا'}))}else res.end()});
   req.pipe(upstream);return;
 }
 if(req.method!=='GET'||!(path in assets)){res.writeHead(404);res.end('Not found');return}
 const [filename,type]=assets[path];try{const body=await readFile(new URL('public/'+filename,import.meta.url));res.writeHead(200,{'content-type':type,'x-content-type-options':'nosniff','content-security-policy':path==='/'?"default-src 'self'; script-src 'self' https://connect.facebook.net; connect-src 'self' https://www.facebook.com https://graph.facebook.com; frame-src https://www.facebook.com https://web.facebook.com; style-src 'self'; img-src 'self' https://www.facebook.com data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'":"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",'cache-control':'no-store','referrer-policy':'no-referrer','x-frame-options':'DENY'});res.end(body)}catch{res.writeHead(500);res.end('Asset unavailable')}
});
server.listen(port,()=>console.log('Elhafez Boat dashboard http://127.0.0.1:'+port));