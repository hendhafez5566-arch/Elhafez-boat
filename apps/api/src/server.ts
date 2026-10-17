import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { login, authenticate, logout } from './auth.js';
import { HttpFailure, withTenantTransaction, listPrograms, createProgram, publishProgram, listBookings, createBooking, confirmBooking, type SqlPool, type SqlClient } from './services.js';
const require=createRequire(import.meta.url);
// pg is a runtime dependency loaded after npm install; query access is abstracted for unit tests.
const { Pool } = require('pg') as { Pool: new (options: { connectionString: string; max: number }) => SqlPool & SqlClient & { end(): Promise<void> } };
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:10});
const port=Number(process.env.PORT??4000);
const json=(res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
async function body(req:IncomingMessage):Promise<unknown>{
  if(!req.headers['content-type']?.startsWith('application/json'))throw new HttpFailure(415,'JSON required');
  let text='';for await(const chunk of req){text+=chunk.toString();if(Buffer.byteLength(text)>65536)throw new HttpFailure(413,'Body too large');}
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
    if(req.method==='GET'&&pathname==='/health')return json(res,200,{status:'ok',service:'api',whatsappConnected:false});
    if(req.method==='POST'&&pathname==='/api/v1/auth/login'){
      throttle(req);
      return json(res,200,await login(pool,await body(req)));
    }
    const actor=await authenticate(pool,req.headers.authorization);
    if(req.method==='POST'&&pathname==='/api/v1/auth/logout'){await logout(pool,req.headers.authorization);return json(res,200,{ok:true});}
    if(req.method==='GET'&&pathname==='/api/v1/programs')return json(res,200,await withTenantTransaction(pool,actor,tx=>listPrograms(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/programs'){const input=await body(req);return json(res,201,await withTenantTransaction(pool,actor,tx=>createProgram(tx,actor,input)));}
    const publication=/^\/api\/v1\/programs\/([^/]+)\/publish$/.exec(pathname);
    if(req.method==='PATCH'&&publication)return json(res,200,await withTenantTransaction(pool,actor,tx=>publishProgram(tx,actor,publication[1])));
    if(req.method==='GET'&&pathname==='/api/v1/bookings')return json(res,200,await withTenantTransaction(pool,actor,tx=>listBookings(tx,actor)));
    if(req.method==='POST'&&pathname==='/api/v1/bookings'){const input=await body(req);return json(res,201,await withTenantTransaction(pool,actor,tx=>createBooking(tx,actor,input)));}
    const confirmation=/^\/api\/v1\/bookings\/([^/]+)\/confirm$/.exec(pathname);
    if(req.method==='PATCH'&&confirmation)return json(res,200,await withTenantTransaction(pool,actor,tx=>confirmBooking(tx,actor,confirmation[1])));
    return json(res,404,{error:'Not found'});
  }catch(error){if(error instanceof HttpFailure)return json(res,error.status,{error:error.message});console.error('Request failed',error instanceof Error?error.message:'unknown');return json(res,500,{error:'Internal server error'});}
});
server.requestTimeout=15000;
server.listen(port,()=>console.log(`Elhafez Boat API listening on ${port}`));
process.on('SIGTERM',()=>server.close(()=>void pool.end()));