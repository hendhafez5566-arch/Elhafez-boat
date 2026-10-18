import {createConnection} from 'node:net';
import type {SqlClient} from './services.js';
/** clamd INSTREAM over a local Unix socket. Nothing becomes public on scanner failure. */
export async function scanBytes(data:Buffer):Promise<'CLEAN'|'QUARANTINED'>{
 const path=process.env.CLAMAV_SOCKET;if(!path||!path.startsWith('/'))throw new Error('CLAMAV_SOCKET unavailable');
 return new Promise((resolve,reject)=>{const socket=createConnection({path});let response='';socket.setTimeout(20000);socket.on('connect',()=>{socket.write('zINSTREAM\0');for(let i=0;i<data.length;i+=65536){const b=data.subarray(i,i+65536),size=Buffer.alloc(4);size.writeUInt32BE(b.length);socket.write(size);socket.write(b)}socket.write(Buffer.alloc(4))});socket.on('data',b=>{response+=b.toString();if(response.length>1024)socket.destroy(new Error('Invalid scanner response'));if(response.includes('\0')){socket.end();if(/^stream: OK\0$/.test(response))resolve('CLEAN');else if(/ FOUND\0$/.test(response))resolve('QUARANTINED');else reject(new Error('Scanner rejected stream'))}});socket.on('timeout',()=>socket.destroy(new Error('Scanner timeout')));socket.on('error',reject);socket.on('end',()=>{if(!response.includes('\0'))reject(new Error('Scanner disconnected'))});});
}
export async function processMediaScan(db:SqlClient,t:string){
 if(!process.env.CLAMAV_SOCKET)return;
 const r=await db.query("SELECT id,content FROM chatbot_media WHERE tenant_id=$1 AND status='ACTIVE' AND scan_status='PENDING' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED",[t]);if(!r.rowCount)return;
 try{const status=await scanBytes(r.rows[0].content as Buffer);await db.query('UPDATE chatbot_media SET scan_status=$3,scanned_at=now(),scan_result=$4 WHERE tenant_id=$1 AND id=$2',[t,r.rows[0].id,status,status==='CLEAN'?'ClamAV clean':'Malware detected']);await db.query(`INSERT INTO audit_events(tenant_id,action,entity_type,entity_id) VALUES($1,$2,'media',$3)`,[t,'MEDIA_SCAN_'+status,r.rows[0].id]);}catch{await db.query("UPDATE chatbot_media SET scan_result='Scanner unavailable; asset remains private' WHERE tenant_id=$1 AND id=$2",[t,r.rows[0].id])}
}
