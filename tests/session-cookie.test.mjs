import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionCookie,sessionBearer,requireCookieCsrf} from '../.build/apps/api/src/session-cookie.js';
const token='a'.repeat(43);
test('dashboard session cookie is HttpOnly, same-site, scoped and bounded',()=>{
 const cookie=sessionCookie(token);
 for(const part of ['eb_session='+token,'HttpOnly','SameSite=Strict','Secure','Path=/api/v1','Max-Age=43200'])assert.ok(cookie.includes(part));
 assert.match(sessionCookie('',{clear:true}),/Max-Age=0/);
 assert.ok(!sessionCookie(token,{secure:false}).includes('; Secure'));
});
test('bearer auth takes precedence and cookies accept only opaque session tokens',()=>{
 assert.equal(sessionBearer('Bearer '+token,'eb_session='+'b'.repeat(43)),'Bearer '+token);
 assert.equal(sessionBearer(undefined,'other=1; eb_session='+token+'; last=2'),'Bearer '+token);
 assert.equal(sessionBearer(undefined,'eb_session=anything'),undefined);
 assert.equal(sessionBearer(undefined,undefined),undefined);
});
test('cookie-only mutating operations demand custom CSRF header',()=>{
 assert.doesNotThrow(()=>requireCookieCsrf('GET',undefined,true));
 assert.doesNotThrow(()=>requireCookieCsrf('POST','1',true));
 assert.doesNotThrow(()=>requireCookieCsrf('POST',undefined,false));
 assert.throws(()=>requireCookieCsrf('POST',undefined,true),/Session request verification required/);
});
