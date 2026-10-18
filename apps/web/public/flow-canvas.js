/** Dependency-free canvas: all graph changes go through the existing draft editor. */
export function createCanvas({host,getFlow,select,changed,notify}){
 const ns='http://www.w3.org/2000/svg';let zoom=1,pan={x:0,y:0},source=null;
 host.classList.add('flow-canvas');host.dir='ltr';
 const stage=document.createElement('div');stage.className='flow-stage';host.append(stage);
 const svg=document.createElementNS(ns,'svg');svg.classList.add('flow-lines');stage.append(svg);
 const transform=()=>{stage.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`};
 const titles={START:'البداية',TEXT:'رسالة نصية',BUTTONS:'أزرار تفاعلية',LIST:'قائمة اختيارات',INPUT:'جمع بيانات',QUESTION:'سؤال',CONDITION:'شرط',CATALOG:'عرض المنتجات',HANDOFF:'تحويل لموظف',MEDIA:'وسائط',END:'النهاية',TAG:'تصنيف',DELAY:'انتظار',AI:'مساعد ذكي',SUBFLOW:'مسار فرعي'};
 const edges=n=>n.choices?n.choices.map((c,i)=>({key:'choice:'+i,to:c.next,label:c.title})):(n.type==='CONDITION'||n.type==='KEYWORD')?[{key:'yes',to:n.yes,label:'نعم'},{key:'no',to:n.no,label:'لا'}]:'next'in n?[{key:'next',to:n.next,label:'التالي'}]:[];
 function draw(){
  const f=getFlow();f.layout=Object.assign(Object.create(null),f.layout||{});stage.querySelectorAll('.canvas-node,.canvas-group').forEach(n=>n.remove());svg.replaceChildren();
  const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');marker.id='flow-arrow';marker.setAttribute('markerWidth','10');marker.setAttribute('markerHeight','10');marker.setAttribute('refX','9');marker.setAttribute('refY','3');marker.setAttribute('orient','auto');const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d','M0,0 L9,3 L0,6');arrow.setAttribute('fill','#087d75');marker.append(arrow);defs.append(marker);svg.append(defs);
  const positions=Object.fromEntries(f.nodes.map((n,i)=>[n.id,f.layout[n.id]||{x:40+(i%3)*290,y:40+Math.floor(i/3)*220}]));
  // Groups are visual only: they never alter execution or touch published customer sessions.
  for(const group of f.groups||[]){
    const nodes=group.nodeIds.map(id=>positions[id]).filter(Boolean);
    if(nodes.length<2)continue;
    const minX=Math.min(...nodes.map(p=>p.x)),minY=Math.min(...nodes.map(p=>p.y));
    const maxX=Math.max(...nodes.map(p=>p.x)),maxY=Math.max(...nodes.map(p=>p.y));
    const box=document.createElement('div');box.className='canvas-group';
    box.style.left=Math.max(0,minX-22)+'px';box.style.top=Math.max(0,minY-38)+'px';
    box.style.width=(maxX-minX+288)+'px';box.style.height=(maxY-minY+222)+'px';
    const heading=document.createElement('div');heading.className='canvas-group-title';heading.textContent=group.title;
    box.append(heading);stage.append(box);
  }
  for(const n of f.nodes){
   const p=positions[n.id],card=document.createElement('article');card.className='canvas-node canvas-'+n.type.toLowerCase();card.dir='rtl';card.style.left=p.x+'px';card.style.top=p.y+'px';
   const title=document.createElement('button');title.type='button';title.className='canvas-title';title.textContent=(titles[n.type]||n.type)+' · '+n.id;title.onclick=event=>select(n.id,event.shiftKey);card.append(title);
   const desc=document.createElement('p');desc.textContent=(n.text||n.field||n.tag||'بداية المحادثة').slice(0,65);card.append(desc);
   const input=document.createElement('button');input.type='button';input.textContent='◉ توصيل هنا';input.onclick=()=>{
    if(!source){notify('اختار مخرج من خطوة أولًا');return}
    const from=f.nodes.find(x=>x.id===source.id);if(source.key.startsWith('choice:'))from.choices[Number(source.key.split(':')[1])].next=n.id;else from[source.key]=n.id;
    source=null;changed();draw();
   };card.append(input);
   for(const e of edges(n)){
    const out=document.createElement('button');out.type='button';out.textContent=e.label+' ↗';out.onclick=()=>{source={id:n.id,key:e.key};notify('اختار «توصيل هنا» في الخطوة المطلوبة')};card.append(out);
    const dest=positions[e.to];if(dest){const line=document.createElementNS(ns,'path');const x=p.x+240,y=p.y+65,dx=dest.x,dy=dest.y+65;line.setAttribute('d',`M${x},${y} C${x+70},${y} ${dx-70},${dy} ${dx},${dy}`);line.setAttribute('marker-end','url(#flow-arrow)');svg.append(line)}
   }
   title.onpointerdown=e=>{if(e.button!==0)return;const start={x:e.clientX,y:e.clientY},original={...p};let moved=false;title.setPointerCapture(e.pointerId);
    title.onpointermove=ev=>{if(Math.abs(ev.clientX-start.x)+Math.abs(ev.clientY-start.y)>4)moved=true;if(!moved)return;f.layout[n.id]={x:Math.max(0,Math.min(9000,original.x+(ev.clientX-start.x)/zoom)),y:Math.max(0,Math.min(9000,original.y+(ev.clientY-start.y)/zoom))};card.style.left=f.layout[n.id].x+'px';card.style.top=f.layout[n.id].y+'px'};
    title.onpointerup=()=>{title.onpointermove=null;title.onpointerup=null;if(moved){changed();draw()}};
   };
   stage.append(card);
  }
  transform();
 }
 host.onwheel=e=>{e.preventDefault();zoom=Math.max(.25,Math.min(2,zoom*(e.deltaY>0?.9:1.1)));transform()};
 host.onpointerdown=e=>{if(e.target!==host&&e.target!==stage&&e.target!==svg)return;const start={x:e.clientX,y:e.clientY},old={...pan};host.setPointerCapture(e.pointerId);host.onpointermove=ev=>{pan={x:old.x+ev.clientX-start.x,y:old.y+ev.clientY-start.y};transform()};host.onpointerup=()=>{host.onpointermove=null;host.onpointerup=null}};
 return {draw,coordinates(clientX,clientY){const r=host.getBoundingClientRect();return {x:Math.max(0,Math.min(9000,Math.round((clientX-r.left-pan.x)/zoom-115))),y:Math.max(0,Math.min(9000,Math.round((clientY-r.top-pan.y)/zoom-35)))}}},reset(){zoom=1;pan={x:0,y:0};transform()}};
}
