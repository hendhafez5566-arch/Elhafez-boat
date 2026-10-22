import {createHmac} from 'node:crypto';
import {HttpFailure,type SqlClient} from './services.js';
/** Atomic PostgreSQL windows shared by every API replica. No raw IP/token is stored. */
export async function distributedLimit(db:SqlClient,identity:string,limit:number,seconds:number){
 const secret=process.env.RATE_LIMIT_SECRET||process.env.INTEGRATION_SECRET_ENCRYPTION_KEY;
 if(!secret)throw new HttpFailure(503,'RATE_LIMIT_SECRET is required');
 const bucket=createHmac('sha256',secret).update(identity).digest('hex');
 const r=await db.query(`INSERT INTO chatbot_rate_buckets(bucket,window_at,hits) VALUES($1,to_timestamp(floor(extract(epoch FROM now())/$2)*$2),1)
 ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN chatbot_rate_buckets.window_at=EXCLUDED.window_at THEN chatbot_rate_buckets.hits+1 ELSE 1 END,window_at=EXCLUDED.window_at RETURNING hits`,[bucket,seconds]);
 if(Number(r.rows[0].hits)>limit)throw new HttpFailure(429,'Rate limit exceeded; retry after the current window');
}
