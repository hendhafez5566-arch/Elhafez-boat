/** Local disposable setup only: creates private random fixture secrets, never cloud resources. */
import {randomBytes} from 'node:crypto';import {writeFile} from 'node:fs/promises';
const hex=()=>randomBytes(24).toString('hex');
const password=hex();
const values={TEST_DB_PASSWORD:hex(),TEST_RUNTIME_PASSWORD:hex(),TEST_ENCRYPTION_KEY:randomBytes(32).toString('base64'),TEST_RATE_LIMIT_SECRET:hex(),BOOTSTRAP_TENANT_SLUG:'local-pilot',BOOTSTRAP_TENANT_NAME:'Local pilot',BOOTSTRAP_EMAIL:'owner@example.invalid',BOOTSTRAP_PASSWORD:password};
try{await writeFile('.env.pilot.local',Object.entries(values).map(([k,v])=>k+'='+v).join('\n')+'\n',{flag:'wx',mode:0o600});console.log('Created private .env.pilot.local. Read your local login there; it is not printed or uploaded.')}catch(e){if(e.code==='EEXIST')throw new Error('Existing .env.pilot.local preserved; refusing to overwrite keys or data');throw e}
console.log('Start: docker compose --env-file .env.pilot.local -p boat-local -f deploy/compose.acceptance.yaml -f deploy/compose.local.yaml up --build -d web worker');
console.log('Create disposable owner once: docker compose --env-file .env.pilot.local -p boat-local -f deploy/compose.acceptance.yaml -f deploy/compose.local.yaml run --rm local-owner');
console.log('Open http://127.0.0.1:3016 . Local backend egress is blocked; no real Meta account can be connected in this profile.');
