import { createRequire } from 'node:module';
import { randomBytes,scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
const require=createRequire(import.meta.url);
const {Pool}=require('pg');
const url=process.env.PLATFORM_DATABASE_URL, email=process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase(),password=process.env.PLATFORM_OWNER_PASSWORD;
if(!url||!email||!password||password.length<16||!email.includes('@'))throw new Error('PLATFORM_DATABASE_URL, PLATFORM_OWNER_EMAIL and secure PLATFORM_OWNER_PASSWORD (>=16 chars) required');
const pool=new Pool({connectionString:url});
try{
 const exists=await pool.query('SELECT 1 FROM platform_owners WHERE lower(email)=$1',[email]);
 if(exists.rowCount)throw new Error('Platform owner already exists. Password not changed.');
 const salt=randomBytes(16).toString('hex');const hash=(await promisify(scryptCallback)(password,salt,64)).toString('hex');
 await pool.query('INSERT INTO platform_owners(email,password_hash) VALUES($1,$2)',[email,'scrypt:'+salt+':'+hash]);
 console.log('Platform owner created. Store credentials securely.');
}finally{await pool.end()}