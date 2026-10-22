import test from 'node:test';import assert from 'node:assert/strict';import {conversionSummary} from '../.build/apps/api/src/flow-experiments.js';
test('conversion denominators have no invented zero rate and Wilson bounds stay meaningful',()=>{
 assert.deepEqual(conversionSummary(0,0),{rate:null,lower:null,upper:null});const half=conversionSummary(100,50);assert.equal(half.rate,.5);assert.ok(half.lower>.4&&half.upper<.6);const none=conversionSummary(10,0),all=conversionSummary(10,10);assert.ok(none.upper>0);assert.ok(all.lower<1);assert.equal(none.lower,0);assert.equal(all.upper,1);for(const input of [[1,2],[-1,0],[1.5,1]])assert.throws(()=>conversionSummary(...input));
});
