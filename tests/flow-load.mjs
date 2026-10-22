/** Real engine microbenchmark, deliberately NOT a database/API capacity claim. */
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {advanceFlow,initialFlowState,validateFlow} from '../.build/apps/api/src/flow-engine.js';
if(!isMainThread){
 const samples=[];const cpu=process.cpuUsage();const start=performance.now();
 for(let tenant=0;tenant<4;tenant++){
  const flow=validateFlow({name:'Tenant '+tenant,startId:'s',nodes:[{id:'s',type:'START',next:'ask'},{id:'ask',type:'INPUT',field:'need',text:'What do you need?',next:'reply'},{id:'reply',type:'TEXT',text:'Tenant '+tenant,next:'end'},{id:'end',type:'END',text:'Thanks'}]});
  for(let user=0;user<100;user++)for(let turn=0;turn<100;turn++){
   const begin=performance.now();const prompt=advanceFlow(flow,initialFlowState());
   const value=`${workerData}-${tenant}-${user}-${turn}`;
   const reply=advanceFlow(flow,prompt.state,{kind:'TEXT',value});
   assert.equal(reply.state.answers.need,value);assert.equal(reply.messages[0].text,'Tenant '+tenant);assert.equal(reply.finished,true);
   samples.push(performance.now()-begin);
  }
 }
 parentPort.postMessage({samples,elapsedMs:performance.now()-start,cpu:process.cpuUsage(cpu),rssBytes:process.memoryUsage().rss});
}else{
 const cpu=process.cpuUsage(),started=performance.now();
 const results=await Promise.all(Array.from({length:4},(_,i)=>new Promise((resolve,reject)=>{const worker=new Worker(new URL(import.meta.url),{workerData:i});worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code)reject(new Error('Load worker exit '+code))})})));
 const elapsedMs=performance.now()-started,samples=results.flatMap(x=>x.samples).sort((a,b)=>a-b),p=q=>samples[Math.min(samples.length-1,Math.floor(q*samples.length))];
 const result={kind:'engine-only; excludes DB, queues, HTTP and providers',threads:4,logicalTenants:16,logicalClients:1600,conversations:samples.length,engineAdvances:samples.length*2,elapsedMs,conversationsPerSecond:samples.length/(elapsedMs/1000),p50Ms:p(.5),p95Ms:p(.95),p99Ms:p(.99),cpuMicroseconds:process.cpuUsage(cpu),peakSampledProcessRssBytes:Math.max(...results.map(x=>x.rssBytes))};
 await mkdir('acceptance-evidence',{recursive:true});await writeFile('acceptance-evidence/engine-load.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
