import test from 'node:test';
import assert from 'node:assert/strict';
import {activityDays,activityCsv} from '../apps/web/public/analytics-export.js';
test('daily export follows server UTC window and includes leap-day zero activity',()=>{
 const data={periodDays:7,range:{endDay:'2024-03-01'},daily:[{day:'2024-02-29',conversations:3}],leadDaily:[{day:'2024-02-29',leads:1}]};
 assert.deepEqual(activityDays(data),['2024-02-24','2024-02-25','2024-02-26','2024-02-27','2024-02-28','2024-02-29','2024-03-01']);
 const csv=activityCsv(data);assert.ok(csv.startsWith('\uFEFF'));const rows=csv.trim().split('\r\n');assert.equal(rows.length,8);assert.ok(rows.includes('2024-02-29,3,1'));assert.ok(rows.includes('2024-03-01,0,0'));
});
test('90-day report crosses year boundaries and exports no contact payload',()=>{
 const data={periodDays:90,range:{endDay:'2026-01-02'},daily:[],leadDaily:[],contacts:[{name:'NEVER_EXPORT_ME'}]};
 const days=activityDays(data);assert.equal(days.length,90);assert.equal(days.at(-1),'2026-01-02');assert.equal(activityCsv(data).includes('NEVER_EXPORT_ME'),false);
});
test('CSV numeric conversion prevents raw count strings becoming spreadsheet formulas',()=>{
 const csv=activityCsv({periodDays:7,range:{endDay:'2026-10-20'},daily:[{day:'2026-10-20',conversations:'=HYPERLINK("bad")'}],leadDaily:[]});assert.ok(csv.includes('2026-10-20,0,0'));assert.equal(csv.includes('HYPERLINK'),false);
});
