import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHmac} from 'node:crypto';
import {sealIntegrationSecret,openIntegrationSecret} from '../.build/apps/api/src/integration-secrets.js';
import {verifyWebhookSignature} from '../.build/apps/api/src/whatsapp.js';
import {publicIP,webhookURL} from '../.build/apps/api/src/integrations.js';
import {accessKeyScope} from '../.build/apps/api/src/access-keys.js';
test('raw webhook authentication rejects forged, changed and malformed signatures',()=>{
 const secret=randomBytes(32).toString('hex'),raw=Buffer.from('{"entry":[]}');
 const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(verifyWebhookSignature(raw,signature,secret),true);
 for(const header of [undefined,[],signature.slice(0,-1),'sha256='+'0'.repeat(64),'sha1='+signature.slice(7)])assert.equal(verifyWebhookSignature(raw,header,secret),false);
 assert.equal(verifyWebhookSignature(Buffer.from('{"entry":[1]}'),signature,secret),false);
 assert.equal(verifyWebhookSignature(raw,signature,'wrong-secret'),false);
});
test('encrypted connector credentials detect tampering and require the original key after restore',()=>{
 const original=process.env.INTEGRATION_SECRET_ENCRYPTION_KEY;
 try{
  process.env.INTEGRATION_SECRET_ENCRYPTION_KEY=randomBytes(32).toString('base64');
  const plaintext='fixture-only-not-a-provider-token',sealed=sealIntegrationSecret(plaintext);
  assert.equal(openIntegrationSecret(sealed),plaintext);assert.equal(sealed.includes(plaintext),false);
  const parts=sealed.split('.'),bytes=Buffer.from(parts[3],'base64url');bytes[0]^=1;parts[3]=bytes.toString('base64url');assert.throws(()=>openIntegrationSecret(parts.join('.')));
  process.env.INTEGRATION_SECRET_ENCRYPTION_KEY=randomBytes(32).toString('base64');assert.throws(()=>openIntegrationSecret(sealed));
  delete process.env.INTEGRATION_SECRET_ENCRYPTION_KEY;assert.throws(()=>openIntegrationSecret(sealed));
 }finally{if(original===undefined)delete process.env.INTEGRATION_SECRET_ENCRYPTION_KEY;else process.env.INTEGRATION_SECRET_ENCRYPTION_KEY=original}
});
test('SSRF refuses metadata/private/mapped/reserved IPs and credential/query webhook URLs',()=>{
 for(const ip of ['169.254.169.254','127.0.0.1','0.0.0.0','10.4.1.2','172.16.0.1','192.168.0.1','100.64.1.1','198.18.0.1','::1','::ffff:127.0.0.1','fd00::1','fe80::1','2001:db8::1','2002:7f00:1::'])assert.equal(publicIP(ip),false,ip);
 const old=process.env.OUTBOUND_WEBHOOK_HOSTS;process.env.OUTBOUND_WEBHOOK_HOSTS='approved.example';
 try{for(const url of ['https://approved.example@attacker.example','https://user:secret@approved.example','https://approved.example/?token=secret','https://approved.example:8443','http://approved.example','https://127.0.0.1'])assert.throws(()=>webhookURL(url),undefined,url)}finally{if(old===undefined)delete process.env.OUTBOUND_WEBHOOK_HOSTS;else process.env.OUTBOUND_WEBHOOK_HOSTS=old}
});
test('API scopes do not authorize lookalike paths or privileged owner operations',()=>{
 for(const path of ['/api/v1/catalogue','/api/v1/catalog/../privacy','/api/v1/team','/api/v1/privacy','/api/v1/connectors','/api/v1/platform/tenants'])assert.equal(accessKeyScope(path,'POST'),null,path);
});
