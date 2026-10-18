/** Dependency-free, RTL-friendly flow canvas. Graph mutations stay in the existing draft editor. */
export function createCanvas({host,getFlow,select,changed,notify,addAfter}){
  const ns='http://www.w3.org/2000/svg';
  const titles={START:'بداية المحادثة',TEXT:'رسالة',BUTTONS:'أزرار الرد',LIST:'قائمة اختيارات',INPUT:'سؤال العميل',QUESTION:'سؤال',CONDITION:'شرط وتفرع',KEYWORD:'كلمات مفتاحية',CATALOG:'المنتجات والخدمات',HANDOFF:'تحويل لموظف',MEDIA:'صورة أو ملف',END:'نهاية المحادثة',TAG:'تصنيف',DELAY:'انتظار',AI:'المساعد الذكي',SUBFLOW:'مسار فرعي',WEBHOOK:'تكامل',CONNECTOR:'موصل',LINK:'رابط'};
  const edges=n=>Array.isArray(n.choices)?n.choices.map((c,i)=>({key:'choice:'+i,to:c.next,label:c.title||'اختيار'})):(n.type==='CONDITION'||n.type==='KEYWORD')?[{key:'yes',to:n.yes,label:'نعم'},{key:'no',to:n.no,label:'لا'}]:'next'in n?[{key:'next',to:n.next,label:'التالي'}]:[];
  let zoom=1,pan={x:36,y:36},source=null,active=null;
  host.classList.add('flow-canvas');host.dir='ltr';host.setAttribute('role','region');
  host.setAttribute('aria-label','مساحة رسم المحادثة؛ اسحب بطاقات الخطوات أو استخدم أزرار التكبير والتحريك');
  const stage=document.createElement('div');stage.className='flow-stage';host.append(stage);
  const svg=document.createElementNS(ns,'svg');svg.classList.add('flow-lines');stage.append(svg);
  const transform=()=>{stage.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`};
  const mk=(tag,text,klass)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(klass)n.className=klass;return n};
  const btn=(text,klass,action)=>{const b=mk('button',text,klass);b.type='button';b.onclick=action;return b};
  const positionsFor=f=>Object.fromEntries(f.nodes.map((n,i)=>[n.id,f.layout[n.id]||{x:72+(i%3)*354,y:64+Math.floor(i/3)*286}]));
  function highlight(id){active=id;stage.querySelectorAll('.canvas-node').forEach(n=>n.classList.toggle('selected',n.dataset.nodeId===id));
    svg.querySelectorAll('.canvas-edge').forEach(n=>n.classList.toggle('connected',n.dataset.from===id||n.dataset.to===id));
  }
  function draw(){
    const f=getFlow();f.layout=Object.assign(Object.create(null),f.layout||{});
    stage.querySelectorAll('.canvas-node,.canvas-group').forEach(n=>n.remove());svg.replaceChildren();
    const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');
    marker.id='flow-arrow';for(const [k,v] of Object.entries({markerWidth:'9',markerHeight:'9',refX:'8',refY:'3',orient:'auto'}))marker.setAttribute(k,v);
    const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d','M0,0 L8,3 L0,6');arrow.setAttribute('fill','#0d9488');marker.append(arrow);defs.append(marker);svg.append(defs);
    const positions=positionsFor(f),width=286;
    for(const group of f.groups||[]){
      const points=group.nodeIds.map(id=>positions[id]).filter(Boolean);if(points.length<2)continue;
      const a=Math.min(...points.map(p=>p.x)),b=Math.min(...points.map(p=>p.y));
      const box=mk('div',undefined,'canvas-group');box.style.left=Math.max(0,a-22)+'px';box.style.top=Math.max(0,b-45)+'px';
      box.style.width=Math.max(310,Math.max(...points.map(p=>p.x))-a+340)+'px';
      box.style.height=Math.max(230,Math.max(...points.map(p=>p.y))-b+315)+'px';
      box.append(mk('span',group.title,'canvas-group-title'));stage.append(box);
    }
    for(const n of f.nodes){
      const p=positions[n.id],card=mk('article',undefined,'canvas-node canvas-'+n.type.toLowerCase());
      card.dataset.nodeId=n.id;card.dir='rtl';card.style.left=p.x+'px';card.style.top=p.y+'px';
      const head=mk('div',undefined,'canvas-node-head'),drag=btn(titles[n.type]||'خطوة','canvas-title',e=>{active=n.id;select(n.id,e.shiftKey);highlight(n.id)});
      drag.setAttribute('aria-label','اختيار وتحريك '+(titles[n.type]||'خطوة'));
      head.append(mk('span',undefined,'canvas-kind-indicator'),drag);card.append(head);
      const msg=mk('div',undefined,'canvas-message');
      const text=String(n.text||n.caption||n.tag||(n.type==='START'?'أهلًا بعميلك — هنا تبدأ المحادثة':n.type==='CATALOG'?'عرض المنتجات والخدمات المعتمدة':n.type==='CONDITION'?'تحديد المسار حسب إجابة العميل':n.type==='END'?'انتهت المحادثة':'اضغط لتعديل محتوى هذه الخطوة'));
      msg.append(mk('p',text.slice(0,190),'canvas-message-text'));
      if(n.type==='MEDIA'||n.type==='LINK')msg.append(mk('small',n.mediaKind==='video'?'فيديو':n.mediaKind==='document'?'ملف':'مرفق / رابط','canvas-media-hint'));
      if(Array.isArray(n.choices)){
        const opts=mk('div',undefined,'canvas-card-choices');
        for(const c of n.choices){const option=mk('div',undefined,'canvas-card-choice');option.append(mk('strong',c.title||'اختيار'));
          if(n.type==='LIST'&&c.description)option.append(mk('small',c.description));opts.append(option)}
        if(n.type==='LIST')msg.append(mk('small',n.buttonText||'عرض القائمة','canvas-list-label'));msg.append(opts);
      }
      if(n.type==='CONDITION'||n.type==='KEYWORD')msg.append(mk('small',n.type==='CONDITION'?'قارن إجابة العميل وأكمل على المسار المناسب':'فحص الكلمات المفتاحية','canvas-media-hint'));
      card.append(msg);
      const ports=mk('div',undefined,'canvas-ports');
      const input=btn(source?'اختر للتوصيل':'مدخل','canvas-input',()=>{if(!source){notify('اختار مخرجًا من الخطوة السابقة أولًا');return}
        const from=f.nodes.find(x=>x.id===source.id);if(!from)return;
        if(source.key.startsWith('choice:')){const c=from.choices?.[Number(source.key.split(':')[1])];if(c)c.next=n.id;}
        else from[source.key]=n.id;
        source=null;changed();draw();});
      ports.append(input);
      for(const e of edges(n)){
        const port=mk('div',undefined,'canvas-port');
        port.append(btn(e.label+' ↗','canvas-output',()=>{source={id:n.id,key:e.key};notify('اضغط على مدخل الخطوة التي تريد توصيلها')}));
        port.append(btn('+','canvas-add',()=>addAfter?.({nodeId:n.id,key:e.key})));
        ports.append(port);
        const dest=positions[e.to];if(dest){
          const line=document.createElementNS(ns,'path'),x=p.x+width,y=p.y+102,dx=dest.x,dy=dest.y+92;
          // Routing anchors adapt when a destination is on the left of its source.
          const bend=Math.max(86,Math.abs(dx-x)*.42);
          line.setAttribute('d',`M${x},${y} C${x+bend},${y} ${dx-bend},${dy} ${dx},${dy}`);
          line.setAttribute('marker-end','url(#flow-arrow)');
          line.classList.add('canvas-edge');line.dataset.from=n.id;line.dataset.to=e.to;svg.append(line);
        }
      }
      card.append(ports);
      drag.onpointerdown=e=>{
        if(e.button!==0)return;
        const start={x:e.clientX,y:e.clientY},original={...p};let moved=false;drag.setPointerCapture?.(e.pointerId);
        drag.onpointermove=ev=>{
          if(Math.abs(ev.clientX-start.x)+Math.abs(ev.clientY-start.y)>5)moved=true;
          if(!moved)return;
          f.layout[n.id]={x:Math.max(0,Math.min(9000,Math.round(original.x+(ev.clientX-start.x)/zoom))),y:Math.max(0,Math.min(9000,Math.round(original.y+(ev.clientY-start.y)/zoom)))};
          card.style.left=f.layout[n.id].x+'px';card.style.top=f.layout[n.id].y+'px';
        };
        const stop=()=>{drag.onpointermove=null;drag.onpointerup=null;drag.onpointercancel=null;if(moved){changed();draw()}};
        drag.onpointerup=stop;drag.onpointercancel=stop;
      };
      stage.append(card);
    }
    transform();highlight(active);
  }
  const zoomTo=v=>{zoom=Math.max(.3,Math.min(1.75,v));transform()};
  function fit(){
    const f=getFlow(),points=Object.values(positionsFor(f));
    if(!points.length)return reset();
    const left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),right=Math.max(...points.map(p=>p.x))+320,bottom=Math.max(...points.map(p=>p.y))+275;
    const rect=host.getBoundingClientRect();zoom=Math.max(.3,Math.min(1.2,Math.min((rect.width-70)/(right-left),(rect.height-70)/(bottom-top))));
    pan={x:(rect.width-(right-left)*zoom)/2-left*zoom,y:Math.max(25,(rect.height-(bottom-top)*zoom)/2-top*zoom)};transform();
  }
  function reset(){zoom=1;pan={x:36,y:36};transform()}
  function autoLayout(){
    const f=getFlow(),byId=new Map(f.nodes.map(n=>[n.id,n])),ranks=new Map([[f.startId,0]]),queue=[f.startId];
    for(let i=0;i<queue.length&&i<300;i++){
      const id=queue[i],level=ranks.get(id);
      for(const e of edges(byId.get(id)||{})){if(e.to&&!ranks.has(e.to)&&byId.has(e.to)){ranks.set(e.to,level+1);queue.push(e.to)}}
    }
    let last=Math.max(0,...ranks.values());
    for(const n of f.nodes)if(!ranks.has(n.id))ranks.set(n.id,++last);
    const cols=new Map();
    for(const n of f.nodes){const level=ranks.get(n.id);if(!cols.has(level))cols.set(level,[]);cols.get(level).push(n.id)}
    // Uniform node footprint reserves space for up to three options and prevents visual overlap.
    for(const [level,ids] of cols)ids.forEach((id,index)=>{f.layout[id]={x:64+level*370,y:70+index*315}});
    changed();draw();fit();
  }
  host.addEventListener('wheel',e=>{e.preventDefault();const before=zoom;zoomTo(zoom*(e.deltaY>0?.9:1.1));const r=host.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;pan={x:x-(x-pan.x)*zoom/before,y:y-(y-pan.y)*zoom/before};transform()},{passive:false});
  host.addEventListener('pointerdown',e=>{
    if(e.button!==0||!(e.target===host||e.target===stage||e.target===svg))return;
    const start={x:e.clientX,y:e.clientY},old={...pan};host.setPointerCapture?.(e.pointerId);
    const move=ev=>{pan={x:old.x+ev.clientX-start.x,y:old.y+ev.clientY-start.y};transform()};
    const stop=()=>{host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',stop);host.removeEventListener('pointercancel',stop)};
    host.addEventListener('pointermove',move);host.addEventListener('pointerup',stop);host.addEventListener('pointercancel',stop);
  });
  return {draw,fit,reset,autoLayout,highlight,zoomIn:()=>zoomTo(zoom*1.2),zoomOut:()=>zoomTo(zoom/1.2),
    coordinates(clientX,clientY){const r=host.getBoundingClientRect();return {x:Math.max(0,Math.min(9000,Math.round((clientX-r.left-pan.x)/zoom-130))),y:Math.max(0,Math.min(9000,Math.round((clientY-r.top-pan.y)/zoom-60)))}}};
}
