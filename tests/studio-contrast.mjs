/** Rendered production-CSS contrast and complete component vocabulary. No screenshots from this fixture are delivery evidence. */
import {chromium} from 'playwright-core';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {componentGroups,componentMeta} from '../apps/web/public/flow-presentation.js';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const styles=await Promise.all(['style.css','flow-builder.css','vessel.css'].map(f=>readFile('apps/web/public/'+f,'utf8')));
 await page.setContent('<html lang="ar" dir="rtl"><head><style>'+styles.join('\n')+'</style></head><body><section id="flow-builder"><header class="builder-toolbar studio-header"><label>اسم البوت<input id="builder-name" value="مساعد العملاء"></label><button id="builder-save">حفظ</button><button id="builder-publish">نشر</button></header><main id="samples"></main></section></body></html>');
 const source=await readFile('apps/web/public/flow-presentation.js','utf8');await page.addScriptTag({content:source.replace(/export /g,'')+'\nwindow.icons={componentIcon,componentMeta,componentGroups};'});
 const rows=await page.evaluate(()=>{
  const root=document.getElementById('samples'),paths=[];
  for(const kind of window.icons.componentGroups.flatMap(g=>g[1])){const tone=window.icons.componentMeta(kind).tone,card=document.createElement('article');card.className='canvas-node';card.dataset.tone=tone;card.innerHTML='<header class="canvas-node-head"><span class="canvas-kind-indicator"></span><div><small class="canvas-type-label">نوع الخطوة</small><button class="canvas-title">عنوان واضح</button></div></header><div class="canvas-message"><p class="canvas-message-text">رسالة عربية / English 123</p></div>';const icon=window.icons.componentIcon(kind);paths.push({kind,path:icon.querySelector('path').getAttribute('d')});card.querySelector('.canvas-kind-indicator').append(icon);root.append(card)}
  const rgb=c=>c.match(/[\d.]+/g).map(Number),lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0),ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  const bg=node=>{for(let p=node;p;p=p.parentElement){const value=rgb(getComputedStyle(p).backgroundColor);if(value[3]===undefined||value[3]===1)return value}return [255,255,255]};
  const cases=[...document.querySelectorAll('.canvas-title,.canvas-type-label,.canvas-message-text,.canvas-kind-indicator,#builder-name,#builder-save,#builder-publish')].map(node=>({selector:node.className||node.id,kind:node.closest('[data-tone]')?.dataset.tone,ratio:ratio(rgb(getComputedStyle(node).color),bg(node)),required:4.5}));
  return {cases,paths};
 });
 for(const row of rows.cases)assert.ok(row.ratio>=row.required,JSON.stringify(row));
 assert.equal(new Set(rows.paths.map(p=>p.path)).size,rows.paths.length,'Every supported component has an original distinct SVG');
 for(const kind of componentGroups.flatMap(g=>g[1]))assert.notEqual(componentMeta(kind).description,'إعداد خطوة متقدمة داخل المسار',kind+' requires useful copy');
 const dir=process.env.STUDIO_EVIDENCE_DIR||'docs/product-rebuild/evidence/premium-bold-2026-10-21';await mkdir(dir,{recursive:true});await writeFile(dir+'/contrast.json',JSON.stringify({checks:rows.cases.length,minimum:Math.min(...rows.cases.map(r=>r.ratio)),...rows,note:'Computed production CSS fixture; not an exhaustive WCAG/device certification'},null,2)+'\n');console.log('PASS '+rows.cases.length+' rendered text/icon contrast pairs >=4.5:1; '+rows.paths.length+' distinct component SVGs/descriptions');
}finally{await browser.close()}
