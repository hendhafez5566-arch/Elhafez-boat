import {nodeFootprint,placeWithoutOverlap,graphOutputs,arrangeFlow,NODE_WIDTH} from './flow-geometry.js';
/** Dependency-free, RTL-friendly flow canvas. Graph mutations stay in the existing draft editor. */
export function createCanvas({host,getFlow,select,changed,notify,addAfter,getSelection=()=>new Set(),selectMany=()=>{}}){
  const ns='http://www.w3.org/2000/svg';
  const titles={SET_FIELD:'تعيين قيمة حقل',RANDOMIZER:'توزيع عشوائي A/B',START:'بداية المحادثة',TEXT:'رسالة',BUTTONS:'أزرار الرد',LIST:'قائمة اختيارات',INPUT:'سؤال العميل',QUESTION:'سؤال',CONDITION:'شرط وتفرع',KEYWORD:'كلمات مفتاحية',CATALOG:'المنتجات والخدمات',HANDOFF:'تحويل لموظف',MEDIA:'صورة أو ملف',END:'نهاية المحادثة',TAG:'تصنيف',DELAY:'انتظار',AI:'المساعد الذكي',SUBFLOW:'مسار فرعي',WEBHOOK:'تكامل',CONNECTOR:'موصل',LINK:'رابط'};
  const edges=graphOutputs;
  let zoom=1,pan={x:36,y:36},source=null,active=null,selectedEdge=null,space=false,connectionGeneration=0;
  host.tabIndex=0;
  host.classList.add('flow-canvas');host.dir='ltr';host.setAttribute('role','region');
  host.setAttribute('aria-label','مساحة رسم المحادثة؛ Alt مع الأسهم لتحريك الخطوة المحددة؛ Shift يزيد المسافة. استخدم Tab لاختيار المخارج');
  const stage=document.createElement('div');stage.className='flow-stage';host.append(stage);
  const svg=document.createElementNS(ns,'svg');svg.classList.add('flow-lines');stage.append(svg);
  const transform=()=>{stage.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;zoomLabel.textContent=Math.round(zoom*100)+'%';paintMap()};
  const mk=(tag,text,klass)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(klass)n.className=klass;return n};
  const btn=(text,klass,action)=>{const b=mk('button',text,klass);b.type='button';b.onclick=action;return b};
  const nav=mk('div',undefined,'canvas-navigation');
  const zoomLabel=btn('100%','canvas-zoom',()=>zoomTo(1));zoomLabel.setAttribute('aria-label','إعادة التكبير إلى 100%');
  nav.append(btn('−','',()=>zoomTo(zoom/1.2)),zoomLabel,btn('+','',()=>zoomTo(zoom*1.2)),btn('ملاءمة','',()=>fit()));host.append(nav);
  const map=document.createElementNS(ns,'svg');map.classList.add('canvas-minimap');map.setAttribute('viewBox','0 0 180 112');map.setAttribute('aria-label','خريطة المخطط؛ اضغط للانتقال');map.setAttribute('role','img');host.append(map);
  let mapBounds={x:0,y:0,scale:1};
  function paintMap(){
    const f=getFlow(),positions=f.layout||{},pts=f.nodes.map(n=>positions[n.id]).filter(Boolean);if(!pts.length)return;
    const left=Math.min(0,...pts.map(p=>p.x)),top=Math.min(0,...pts.map(p=>p.y));
    const w=Math.max(800,...pts.map(p=>p.x+NODE_WIDTH))-left,h=Math.max(600,...pts.map(p=>p.y+300))-top,k=Math.min(170/w,102/h);
    mapBounds={x:left,y:top,scale:k};map.replaceChildren();
    const rect=(x,y,width,height,cls)=>{const r=document.createElementNS(ns,'rect');for(const [key,val]of Object.entries({x:5+(x-left)*k,y:5+(y-top)*k,width:Math.max(2,width*k),height:Math.max(2,height*k)}))r.setAttribute(key,val);r.setAttribute('class',cls);map.append(r)};
    for(const n of f.nodes){const p=positions[n.id];if(p)rect(p.x,p.y,NODE_WIDTH,220,getSelection().has(n.id)?'map-node selected':'map-node')}
    rect(-pan.x/zoom,-pan.y/zoom,host.clientWidth/zoom,host.clientHeight/zoom,'map-viewport');
  }
  map.onpointerdown=e=>{e.stopPropagation();const r=map.getBoundingClientRect(),b=mapBounds;const x=((e.clientX-r.left)*180/r.width-5)/b.scale+b.x,y=((e.clientY-r.top)*112/r.height-5)/b.scale+b.y;pan={x:host.clientWidth/2-x*zoom,y:host.clientHeight/2-y*zoom};transform()};
  const edgeTools=mk('div',undefined,'canvas-edge-tools');edgeTools.hidden=true;host.append(edgeTools);
  const setDestination=(edge,value)=>{const n=getFlow().nodes.find(n=>n.id===edge.from);if(!n)return;if(edge.key.startsWith('choice:')){const c=n.choices?.find(c=>c.id===edge.key.slice(7));if(c)c.next=value}else n[edge.key]=value};
  const disconnect=()=>{if(!selectedEdge)return;setDestination(selectedEdge,'');selectedEdge=null;edgeTools.hidden=true;changed();draw()};
  function chooseEdge(edge){selectedEdge=edge;edgeTools.replaceChildren(mk('strong','وصلة محددة'),btn('تغيير الوجهة','',()=>{source={id:edge.from,key:edge.key};notify('اختر مدخل الوجهة الجديدة؛ Escape للإلغاء')}),btn('فصل الوصلة','danger',disconnect));edgeTools.hidden=false;svg.querySelectorAll('.canvas-edge').forEach(p=>p.classList.toggle('edge-selected',p.dataset.from===edge.from&&p.dataset.key===edge.key))}
  host.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select'))return;if(e.key==='Escape'){connectionGeneration++;source=null;selectedEdge=null;edgeTools.hidden=true;svg.querySelector('.canvas-ghost')?.remove()}if((e.key==='Delete'||e.key==='Backspace')&&selectedEdge){e.preventDefault();disconnect()}});
  const positionsFor=f=>{
    const proposed=arrangeFlow(f),placed=[],positions=Object.create(null);
    for(const n of f.nodes){
      const point=f.layout?.[n.id]||proposed[n.id];
      // Recover visually from colliding older layouts without overwriting a user's saved draft.
      const safe=f.layout?.[n.id]?{...point}:placeWithoutOverlap(point,n,placed,56);
      positions[n.id]=safe;placed.push({...safe,...nodeFootprint(n)});
    }
    return positions;
  };
  function highlight(id){active=id;stage.querySelectorAll('.canvas-node').forEach(n=>n.classList.toggle('selected',getSelection().has(n.dataset.nodeId)||n.dataset.nodeId===id));
    svg.querySelectorAll('.canvas-edge').forEach(n=>n.classList.toggle('connected',n.dataset.from===id||n.dataset.to===id));
  }
  function draw(){
    const f=getFlow();f.layout=Object.assign(Object.create(null),f.layout||{});
    stage.querySelectorAll('.canvas-node,.canvas-group').forEach(n=>n.remove());svg.replaceChildren();
    const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');
    marker.id='flow-arrow';for(const [k,v] of Object.entries({markerWidth:'9',markerHeight:'9',refX:'8',refY:'3',orient:'auto'}))marker.setAttribute(k,v);
    const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d','M0,0 L8,3 L0,6');arrow.setAttribute('fill','#8272c9');marker.append(arrow);defs.append(marker);svg.append(defs);
    const positions=positionsFor(f);for(const [id,p]of Object.entries(positions))if(!f.layout[id])f.layout[id]=p;const width=NODE_WIDTH,linkRequests=[],cards=new Map();
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
      card.tabIndex=0;card.setAttribute('aria-label','خطوة '+(titles[n.type]||'محادثة'));
      const chooseCard=(event={})=>{active=n.id;select(n.id,event.shiftKey);highlight(n.id)};
      card.addEventListener('click',event=>{if(!event.target.closest('button'))chooseCard(event)});
      card.addEventListener('keydown',event=>{
        if(event.target===card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();chooseCard(event)}
        if(event.altKey&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&!event.target.matches('input,textarea,select')){
          event.preventDefault();const distance=event.shiftKey?80:20,delta={ArrowLeft:[-distance,0],ArrowRight:[distance,0],ArrowUp:[0,-distance],ArrowDown:[0,distance]}[event.key];
          f.layout[n.id]={x:Math.max(0,Math.min(9600,p.x+delta[0])),y:Math.max(0,Math.min(9600,p.y+delta[1]))};active=n.id;changed();draw();highlight(n.id);stage.querySelector('[data-node-id="'+n.id+'"]')?.focus({preventScroll:true});
        }
      });
      const head=mk('div',undefined,'canvas-node-head'),drag=btn(n.label||titles[n.type]||'خطوة','canvas-title',e=>{active=n.id;select(n.id,e.shiftKey);highlight(n.id)});
      drag.setAttribute('aria-label','اختيار وتحريك '+(titles[n.type]||'خطوة'));
      const icon=mk('span',undefined,'canvas-kind-indicator');const symbol=document.createElementNS(ns,'svg');symbol.setAttribute('viewBox','0 0 24 24');symbol.setAttribute('aria-hidden','true');const iconPath=document.createElementNS(ns,'path');iconPath.setAttribute('d',({START:'M8 4l12 8-12 8z',TEXT:'M4 5h16v12H9l-5 4z M8 9h8 M8 13h5',INPUT:'M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h3',CONDITION:'M12 3l9 9-9 9-9-9z M9 12h6',HANDOFF:'M4 14v-3a8 8 0 0 1 16 0v3 M4 11H2v7h4v-7z M20 11h2v7h-4v-7z',BUTTONS:'M4 4h16v7H4z M4 15h7v5H4z M15 15h5v5h-5z',MEDIA:'M3 4h18v16H3z M3 16l6-6 6 6 3-3 3 3',DELAY:'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'})[n.type]||'M5 4h14v16H5z M8 9h8 M8 14h8');symbol.append(iconPath);icon.append(symbol);head.append(icon,drag);card.append(head);
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
      const connectTo=target=>{
        const from=f.nodes.find(x=>x.id===source?.id);
        if(!from){notify('اختار مخرج الخطوة أولًا','error');return}
        if(target===from.id){notify('لا يمكن توصيل الخطوة بنفسها','error');return}
        if(source.key.startsWith('choice:')){
          const choice=from.choices?.find(c=>c.id===source.key.slice(7));
          if(!choice)return notify('تعذر تحديد الاختيار','error');choice.next=target;
        }else from[source.key]=target;
        source=null;changed();draw();highlight(target);
      };
      const input=btn(source?'اضغط لتوصيل المسار':'مدخل','canvas-input',()=>connectTo(n.id));
      input.setAttribute('aria-label','توصيل المسار إلى '+(titles[n.type]||'الخطوة'));
      ports.append(input);
      for(const e of edges(n)){
        const port=mk('div',undefined,'canvas-port');
        const out=btn(e.label+' →','canvas-output',()=>{if(out.dataset.dragged==='true'){delete out.dataset.dragged;return}
          source={id:n.id,key:e.key};notify('حدد مدخل الخطوة التالية أو اسحب هذا المخرج فوقها')});
        out.setAttribute('aria-label','مخرج '+e.label+' — اسحبه إلى خطوة أو اضغط ثم اختر مدخلها');
        out.onpointerdown=ev=>{
          if(ev.button!==0)return;const start={x:ev.clientX,y:ev.clientY};
          const generation=connectionGeneration;let dragged=false;let ghost=null;out.setPointerCapture?.(ev.pointerId);
          const move=event=>{if(generation!==connectionGeneration)return;if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>12)dragged=true;out.classList.toggle('connecting',dragged);if(dragged){if(!ghost){ghost=document.createElementNS(ns,'path');ghost.classList.add('canvas-ghost');svg.append(ghost)}const r=host.getBoundingClientRect(),a=out.getBoundingClientRect(),x=(a.right-r.left-pan.x)/zoom,y=(a.top+a.height/2-r.top-pan.y)/zoom,tx=(event.clientX-r.left-pan.x)/zoom,ty=(event.clientY-r.top-pan.y)/zoom;ghost.setAttribute('d',`M${x},${y} C${x+100},${y} ${tx-100},${ty} ${tx},${ty}`)}};
          const stop=event=>{
            out.removeEventListener('pointermove',move);out.removeEventListener('pointerup',stop);out.removeEventListener('pointercancel',stop);
            out.classList.remove('connecting');ghost?.remove();if(event.type==='pointercancel'||generation!==connectionGeneration)return;
            if(!dragged)return;
            out.dataset.dragged='true';const hit=document.elementFromPoint(event.clientX,event.clientY);if(hit?.closest('.canvas-output,.canvas-add')){notify('اختر مدخل الخطوة للربط','error');return}const found=hit?.closest('.canvas-node');
            source={id:n.id,key:e.key};
            if(found?.dataset.nodeId)connectTo(found.dataset.nodeId);
            else {source=null;addAfter?.({nodeId:n.id,key:e.key})}
          };
          out.addEventListener('pointermove',move);out.addEventListener('pointerup',stop);out.addEventListener('pointercancel',stop);
        };
        port.append(out);
        port.append(btn('+','canvas-add',()=>addAfter?.({nodeId:n.id,key:e.key})));
        ports.append(port);
        if(positions[e.to])linkRequests.push({from:n.id,to:e.to,key:e.key,port});
      }
      card.append(ports);
      drag.onpointerdown=e=>{
        if(e.button!==0)return;
        const start={x:e.clientX,y:e.clientY};let moved=false;drag.setPointerCapture?.(e.pointerId);
        drag.onpointermove=ev=>{
          if(Math.abs(ev.clientX-start.x)+Math.abs(ev.clientY-start.y)>5)moved=true;
          if(!moved)return;
          const ids=getSelection().has(n.id)?getSelection():new Set([n.id]);
          const members=[...ids].filter(id=>positions[id]&&cards.has(id));const left=Math.min(...members.map(id=>positions[id].x)),top=Math.min(...members.map(id=>positions[id].y));
          const size={width:Math.max(...members.map(id=>positions[id].x+cards.get(id).offsetWidth))-left,height:Math.max(...members.map(id=>positions[id].y+cards.get(id).offsetHeight))-top};
          const others=f.nodes.filter(node=>!ids.has(node.id)).map(node=>({...positions[node.id],width:cards.get(node.id)?.offsetWidth||NODE_WIDTH,height:cards.get(node.id)?.offsetHeight||nodeFootprint(node).height}));
          const point=placeWithoutOverlap({x:Math.round((left+(ev.clientX-start.x)/zoom)/10)*10,y:Math.round((top+(ev.clientY-start.y)/zoom)/10)*10},n,others,28,size);
          const dx=point.x-left,dy=point.y-top;
          for(const id of members){const pos=positions[id],c=cards.get(id),at={x:pos.x+dx,y:pos.y+dy};f.layout[id]=at;c.style.left=at.x+'px';c.style.top=at.y+'px'}
          for(const path of svg.querySelectorAll('.canvas-edge,.canvas-edge-hit')){const a=cards.get(path.dataset.from),b=cards.get(path.dataset.to);if(!a||!b)continue;const x=parseFloat(a.style.left)+NODE_WIDTH,y=parseFloat(a.style.top)+a.offsetHeight-25,tx=parseFloat(b.style.left),ty=parseFloat(b.style.top)+b.offsetHeight-55;path.setAttribute('d',`M${x},${y} C${x+80},${y} ${tx-80},${ty} ${tx},${ty}`)}paintMap();

        };
        const stop=()=>{drag.onpointermove=null;drag.onpointerup=null;drag.onpointercancel=null;if(moved){changed();draw()}};
        drag.onpointerup=stop;drag.onpointercancel=stop;
      };
      stage.append(card);cards.set(n.id,card);
    }
    // Compute connector ports from measured rendered cards, not hard-coded centerlines.
    // These routes remain behind all cards and use elevated lanes for backwards/cyclic paths.
    const incoming=new Map();
    for(const edge of linkRequests){
      const from=positions[edge.from],to=positions[edge.to],origin=cards.get(edge.from),target=cards.get(edge.to);
      if(!origin||!target)continue;
      const options=[...origin.querySelectorAll('.canvas-port')];
      const slot=Math.max(0,options.indexOf(edge.port));
      const startY=from.y+(edge.port.offsetTop||170)+(edge.port.offsetHeight||35)/2+
        (origin.querySelector('.canvas-ports')?.offsetTop||0);
      const endY=to.y+(target.querySelector('.canvas-input')?.offsetTop||0)+
        (target.querySelector('.canvas-ports')?.offsetTop||0)+14;
      const startX=from.x+width,endX=to.x;
      const line=document.createElementNS(ns,'path');
      const key=edge.from+'~'+edge.to;
      const count=incoming.get(key)||0;incoming.set(key,count+1);
      let data;
      if(endX-startX>=100){
        const mid=startX+(endX-startX)/2+Math.min(20,count*10);
        data=`M${startX},${startY} C${mid},${startY} ${mid},${endY} ${endX},${endY}`;
      }else if(to.y>from.y+origin.offsetHeight+15){
        // Forward vertical edges use the gap below their card, rather than looping above Start.
        const lane=(from.y+origin.offsetHeight+to.y)/2;
        const right=startX+45+slot*14,left=endX-35-count*12;
        data=`M${startX},${startY} C${right},${startY} ${right},${lane} ${right},${lane} L${left},${lane} C${left},${lane} ${left},${endY} ${endX},${endY}`;
      }else{
        const lane=Math.max(25,Math.min(from.y,to.y)-75-slot*15-count*18);
        const excursion=Math.max(startX+55,endX+65);
        data=`M${startX},${startY} C${excursion},${startY} ${excursion},${lane} ${excursion},${lane} L${endX-56},${lane} C${endX-30},${lane} ${endX-30},${endY} ${endX},${endY}`;
      }
      line.setAttribute('d',data);line.setAttribute('marker-end','url(#flow-arrow)');
      line.classList.add('canvas-edge');line.dataset.from=edge.from;line.dataset.to=edge.to;line.dataset.key=edge.key;
      const hit=line.cloneNode();hit.removeAttribute('marker-end');hit.setAttribute('class','canvas-edge-hit');hit.setAttribute('tabindex','0');hit.setAttribute('role','button');hit.setAttribute('aria-label','تحديد وصلة '+edge.from+' إلى '+edge.to);hit.onclick=e=>{e.stopPropagation();chooseEdge(edge)};hit.onkeydown=e=>{if(e.key==='Enter')chooseEdge(edge)};
      svg.append(line,hit);
    }
    transform();highlight(active);
  }
  const zoomTo=(v,x=host.clientWidth/2,y=host.clientHeight/2)=>{const old=zoom;zoom=Math.max(.1,Math.min(2,v));pan={x:x-(x-pan.x)*zoom/old,y:y-(y-pan.y)*zoom/old};transform()};
  function fit(){
    const f=getFlow(),points=Object.values(positionsFor(f));
    if(!points.length)return reset();
    const nodes=f.nodes,positions=positionsFor(f);
    const rendered=new Map([...stage.querySelectorAll('.canvas-node')].map(card=>[card.dataset.nodeId,card]));
    const left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),right=Math.max(...nodes.map(n=>positions[n.id].x+Math.max(rendered.get(n.id)?.offsetWidth||0,nodeFootprint(n).width))),bottom=Math.max(...nodes.map(n=>positions[n.id].y+Math.max(rendered.get(n.id)?.offsetHeight||0,nodeFootprint(n).height)));
    const rect=host.getBoundingClientRect();zoom=Math.max(.1,Math.min(1.2,Math.min((rect.width-70)/(right-left),(rect.height-70)/(bottom-top))));
    pan={x:(rect.width-(right-left)*zoom)/2-left*zoom,y:Math.max(25,(rect.height-(bottom-top)*zoom)/2-top*zoom)};transform();
  }
  function reset(){zoom=1;pan={x:36,y:36};transform()}
  function autoLayout(){const f=getFlow();f.layout=Object.assign(Object.create(null),arrangeFlow(f));changed();draw()}
  host.addEventListener('wheel',e=>{if(e.target.closest('.canvas-navigation,.canvas-minimap'))return;e.preventDefault();const r=host.getBoundingClientRect();if(e.ctrlKey||e.metaKey){zoomTo(zoom*Math.exp(-e.deltaY*.002),e.clientX-r.left,e.clientY-r.top)}else{pan.x-=e.deltaX;pan.y-=e.deltaY;transform()}},{passive:false});
  host.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.target.closest('input,textarea,select')){space=true;e.preventDefault()}});host.addEventListener('keyup',e=>{if(e.code==='Space')space=false});host.addEventListener('blur',()=>{space=false});
  host.addEventListener('pointerdown',e=>{
    if(!space&&e.button!==1)return;e.preventDefault();e.stopImmediatePropagation();const start={x:e.clientX,y:e.clientY},old={...pan};host.setPointerCapture?.(e.pointerId);
    const move=ev=>{pan={x:old.x+ev.clientX-start.x,y:old.y+ev.clientY-start.y};transform()};const stop=()=>{host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',stop);host.removeEventListener('pointercancel',stop)};host.addEventListener('pointermove',move);host.addEventListener('pointerup',stop);host.addEventListener('pointercancel',stop);
  },true);
  host.addEventListener('pointerdown',e=>{
    if(e.button!==0||!(e.target===host||e.target===stage||e.target===svg))return;
    const start={x:e.clientX,y:e.clientY},old={...pan};let box=null;
    if(e.shiftKey){box=mk('div',undefined,'canvas-selection-box');host.append(box)}host.setPointerCapture?.(e.pointerId);
    const move=ev=>{if(box){const r=host.getBoundingClientRect();Object.assign(box.style,{left:Math.min(start.x,ev.clientX)-r.left+'px',top:Math.min(start.y,ev.clientY)-r.top+'px',width:Math.abs(ev.clientX-start.x)+'px',height:Math.abs(ev.clientY-start.y)+'px'})}else{pan={x:old.x+ev.clientX-start.x,y:old.y+ev.clientY-start.y};transform()}};
    const stop=()=>{if(box){const r=box.getBoundingClientRect();const ids=[...stage.querySelectorAll('.canvas-node')].filter(c=>{const b=c.getBoundingClientRect();return b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top}).map(c=>c.dataset.nodeId);box.remove();selectMany(ids);highlight(ids[0])}host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',stop);host.removeEventListener('pointercancel',stop)};
    host.addEventListener('pointermove',move);host.addEventListener('pointerup',stop);host.addEventListener('pointercancel',stop);
  });
  const resize=new ResizeObserver(()=>paintMap());resize.observe(host);
  function focus(id){
    const p=positionsFor(getFlow())[id];if(!p)return fit();
    const area=host.getBoundingClientRect();zoom=1;
    pan={x:Math.round(area.width/2-(p.x+NODE_WIDTH/2)),y:Math.round(area.height/2-(p.y+155))};transform();
  }
  return {draw,fit,focus,reset,autoLayout,highlight,zoomIn:()=>zoomTo(zoom*1.2),zoomOut:()=>zoomTo(zoom/1.2),
    coordinates(clientX,clientY){const r=host.getBoundingClientRect();return {x:Math.max(0,Math.min(9000,Math.round((clientX-r.left-pan.x)/zoom-130))),y:Math.max(0,Math.min(9000,Math.round((clientY-r.top-pan.y)/zoom-60)))}}};
}
