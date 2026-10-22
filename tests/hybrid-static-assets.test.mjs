import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

test('hybrid module is allowed through the web server asset allowlist and browser modules parse',()=>{
 const server=readFileSync('apps/web/server.mjs','utf8');
 const entry=readFileSync('apps/web/public/flow-builder.js','utf8');
 assert.match(server,/['"]\/flow-basic-builder\.js['"]\s*:\s*\[['"]flow-basic-builder\.js['"]/);
 assert.match(entry,/import\s*\{\s*mountHybridBasicBuilder\s*\}\s*from\s*['"]\.\/flow-basic-builder\.js['"]/);
 for(const file of ['apps/web/public/flow-basic-builder.js','apps/web/public/flow-builder.js','apps/web/server.mjs'])
  assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',file]),'syntax check '+file);
});
