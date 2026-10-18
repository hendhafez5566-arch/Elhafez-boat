/** Test-process-only transport boundary. No production environment bypass exists. */
import https from 'node:https';
import http from 'node:http';
import dns from 'node:dns';
import {syncBuiltinESMExports} from 'node:module';
if(process.env.CI_ACCEPTANCE_DISPOSABLE_DB!=='YES')throw new Error('Offline transport requires disposable acceptance');
const origin=new URL(process.env.OFFLINE_PROVIDER_ORIGIN||'');
if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1')throw new Error('Loopback simulator required');
const allowed=h=>['graph.facebook.com','graph.instagram.com','api.telegram.org','oauth2.googleapis.com','sheets.googleapis.com','www.googleapis.com','api.hubapi.com','fixture.myshopify.com','woo.fixture.test','ai.fixture.test','webhook.fixture.test'].includes(h);
const originalFetch=globalThis.fetch;
globalThis.fetch=(url,options={})=>{
 const target=new URL(url instanceof Request?url.url:String(url));
 if(['127.0.0.1','localhost'].includes(target.hostname))return originalFetch(url,options);
 if(!allowed(target.hostname))throw new Error('Offline test blocked external destination');
 const headers=new Headers(options.headers);headers.set('x-fixture-host',target.hostname);
 return originalFetch(origin.origin+target.pathname+target.search,{...options,headers});
};
const lookup=dns.promises.lookup.bind(dns.promises);
dns.promises.lookup=async(host,...args)=>{if(allowed(host))return args[0]?.all?[{address:'93.184.216.34',family:4}]:{address:'93.184.216.34',family:4};if(host==='localhost'||host==='127.0.0.1')return lookup(host,...args);throw new Error('Offline test blocked DNS')};
https.request=(url,options,callback)=>{
 const target=new URL(url);if(!allowed(target.hostname))throw new Error('Offline test blocked HTTPS');
 // Exercise the production DNS pin callback, then use a loopback-only socket.
 options.lookup?.(target.hostname,{},(err,address)=>{if(err||address!=='93.184.216.34')throw new Error('Unpinned fixture transport')});
 return http.request(origin.origin+target.pathname+target.search,{...options,lookup:undefined,headers:{...options.headers,'x-fixture-host':target.hostname}},callback);
};
syncBuiltinESMExports();
