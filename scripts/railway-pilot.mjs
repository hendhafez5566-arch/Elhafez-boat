/**
 * Manual Railway pilot only — run web, API and durable worker in one container to
 * avoid three always-on application services for a short, low-cost test.
 *
 * Does NOT initialize a database, connect a provider or execute a paid AI agent.
 * This process is NOT a production HA/supervisor architecture.
 */
import {spawn} from 'node:child_process';

const required=['DATABASE_URL','WHATSAPP_TOKEN_ENCRYPTION_KEY','RATE_LIMIT_SECRET'];
for(const key of required){
 if(!process.env[key])throw new Error('Pilot startup requires '+key+'; configure privately before manual deploy');
}
if(process.env.AI_API_KEY||process.env.AI_BASE_URL||process.env.AI_MODEL){
 throw new Error('Paid/external AI configuration is forbidden in this manual pilot');
}
if(process.env.DATABASE_URL===process.env.MIGRATION_DATABASE_URL){
 throw new Error('Pilot runtime must NOT use the migration/admin database role');
}
const key=Buffer.from(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY,'base64');
if(key.length!==32)throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY must contain exactly 32 bytes of base64');
const apiPort=Number(process.env.BOAT_API_PORT||4000);
const webPort=Number(process.env.PORT||3000);
if(!Number.isInteger(apiPort)||!Number.isInteger(webPort)||apiPort<1024||webPort<1024||apiPort===webPort){
 throw new Error('BOAT_API_PORT / PORT must be distinct unprivileged port numbers');
}
const common={...process.env,AI_API_KEY:'',AI_BASE_URL:'',AI_MODEL:''};
const processes=[
 {name:'api',entry:'.build/apps/api/src/server.js',env:{...common,PORT:String(apiPort)}},
 {name:'worker',entry:'.build/apps/worker/main.js',env:{...common}},
 {name:'web',entry:'apps/web/server.mjs',env:{...common,WEB_PORT:String(webPort),API_INTERNAL_ORIGIN:'http://127.0.0.1:'+apiPort}}
];
const active=new Map();
let stopping=false;
function terminate(code=0){
 if(stopping)return;
 stopping=true;
 for(const child of active.values())if(child.exitCode===null)child.kill('SIGTERM');
 // Child processes receive SIGTERM; do not leave a zombie worker if the web dies.
 const wait=setTimeout(()=>{
  for(const child of active.values())if(child.exitCode===null)child.kill('SIGKILL');
  process.exit(code);
 },5000);
 wait.unref();
 if(!active.size)process.exit(code);
}
for(const {name,entry,env} of processes){
 const child=spawn(process.execPath,[entry],{env,stdio:'inherit',windowsHide:true});
 active.set(name,child);
 child.on('error',error=>{console.error('Pilot '+name+' failed to start:',error.code||'SPAWN_ERROR');terminate(1)});
 child.on('exit',(code,signal)=>{
  active.delete(name);
  if(stopping){if(!active.size)process.exit(0);return}
  console.error('Pilot '+name+' exited unexpectedly ('+(code??signal)+'); stopping sibling processes');
  terminate(1);
 });
}
process.on('SIGTERM',()=>terminate(0));
process.on('SIGINT',()=>terminate(0));
