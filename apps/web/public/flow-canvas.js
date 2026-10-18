import {nodeFootprint,placeWithoutOverlap,graphOutputs,arrangeFlow,NODE_WIDTH} from './flow-geometry.js';
/** Dependency-free, RTL-friendly flow canvas. Graph mutations stay in the existing draft editor. */
export function createCanvas({host,getFlow,select,changed,notify,addAfter}){
  const ns='http://www.w3.org/2000/svg';
  const titles={START:'بداية المحادثة',TEXT:'رسالة',BUTTONS:'أزرار الرد',LIST:'قائمة اختيارات',INPUT:'سؤال العميل',QUESTION:'سؤال',CONDITION:'شرط وتفرع',KEYWORD:'كلمات مفتاحية',CATALOG:'المنتجات والخدمات',HANDOFF:'تحويل لموظف',MEDIA:'صورة أو ملف',END:'نهاية المحادثة',TAG:'تصنيف',DELAY:'انتظار',AI:'المساعد الذكي',SUBFLOW:'مسار فرعي',WEBHOOK:'تكامل',CONNECTOR:'موصل',LINK:'رابط'};
  const edges=graphOutputs;
  let zoom=1,pan={x:36,y:36},source=null,active=null;
  host.classList.add('flow-canvas');host.dir='ltr';host.setAttribute('role','region');
  host.setAttribute('aria-label','مساحة رسم المحادثة؛ اسحب بطاقات الخطوات أو استخدم أزرار التكبير والتحريك');
  const stage=document.createElement('div');stage.className='flow-stage';host.append(stage);
  const svg=document.createElementNS(ns,'svg');svg.classList.add('flow-lines');stage.append(svg);
  const transform=()=>{stage.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`};
  const mk=(tag,text,klass)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(klass)n.className=klass;return n};
  const btn=(text,klass,action)=>{const b=mk('button',text,klass);b.type='button';b.onclick=action;return b};
  const positionsFor=f=>{const missing=f.nodes.some(n=>!f.layout?.[n.id]);const proposed=missing?arrangeFlow(f):null;return Object.fromEntries(f.nodes.map(n=>[n.id,f.layout?.[n.id]||proposed[n.id]]))};
  function highlight(id){active=id;stage.querySelectorAll('.canvas-node').forEach(n=>n.classList.toggle('selected',n.dataset.nodeId===id));
    svg.querySelectorAll('.canvas-edge').forEach(n=>n.classList.toggle('connected',n.dataset.from===id||n.dataset.to===id));
  }
  function draw(){
    const f=getFlow();f.layout=Object.assign(Object.create(null),f.layout||{});
    stage.querySelectorAll('.canvas-node,.canvas-group').forEach(n=>n.remove());svg.replaceChildren();
    const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');
    marker.id='flow-arrow';for(const [k,v] of Object.entries({markerWidth:'9',markerHeight:'9',refX:'8',refY:'3',orient:'auto'}))marker.setAttribute(k,v);
    const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d','M0,0 L8,3 L0,6');arrow.setAttribute('fill','#0d9488');marker.append(arrow);defs.append(marker);svg.append(defs);
    const positions=positionsFor(f),width=NODE_WIDTH,linkRequests=[],cards=new Map();
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
      const connectTo=target=>{
        const from=f.nodes.find(x=>x.id===source?.id);
        if(!from){notify('اختار مخرج الخطوة أولًا','error');return}
        if(source.key.startsWith('choice:')){
          const choice=from.choices?.[Number(source.key.split(':')[1])];
          if(!choice)return notify('تعذر تحديد الاختيار','error');choice.next=target;
        }else from[source.key]=target;
        source=null;changed();draw();highlight(target);
      };
      const input=btn(source?'اضغط لتوصيل المسار':'مدخل','canvas-input',()=>connectTo(n.id));
      input.setAttribute('aria-label','توصيل المسار إلى '+(titles[n.type]||'الخطوة'));
      ports.append(input);
      for(const e of edges(n)){
        const port=mk('div',undefined,'canvas-port');
        const out=btn(e.label+' ↗','canvas-output',()=>{if(out.dataset.dragged==='true'){delete out.dataset.dragged;return}
          source={id:n.id,key:e.key};notify('حدد مدخل الخطوة التالية أو اسحب هذا المخرج فوقها')});
        out.setAttribute('aria-label','مخرج '+e.label+' — اسحبه إلى خطوة أو اضغط ثم اختر مدخلها');
        out.onpointerdown=ev=>{
          if(ev.button!==0)return;const start={x:ev.clientX,y:ev.clientY};
          let dragged=false;out.setPointerCapture?.(ev.pointerId);
          const move=event=>{if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>12)dragged=true;out.classList.toggle('connecting',dragged)};
          const stop=event=>{
            out.removeEventListener('pointermove',move);out.removeEventListener('pointerup',stop);out.removeEventListener('pointercancel',stop);
            out.classList.remove('connecting');
            if(!dragged)return;
            out.dataset.dragged='true';const found=document.elementFromPoint(event.clientX,event.clientY)?.closest('.canvas-node');
            source={id:n.id,key:e.key};
            if(found?.dataset.nodeId)connectTo(found.dataset.nodeId);
            else notify('اسحب المخرج فوق بطاقة الخطوة المطلوبة، أو اضغط المخرج ثم المدخل');
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
        const start={x:e.clientX,y:e.clientY},original={...p};let moved=false;drag.setPointerCapture?.(e.pointerId);
        drag.onpointermove=ev=>{
          if(Math.abs(ev.clientX-start.x)+Math.abs(ev.clientY-start.y)>5)moved=true;
          if(!moved)return;
          const others=f.nodes.filter(other=>other.id!==n.id).map(other=>{
            const element=cards.get(other.id);return {
              ...positions[other.id],
              width:Math.max(NODE_WIDTH,element?.offsetWidth||nodeFootprint(other).width),
              height:Math.max(element?.offsetHeight||0,nodeFootprint(other).height)
            };
          });
          const size={width:Math.max(NODE_WIDTH,card.offsetWidth||0),
            height:Math.max(card.offsetHeight||0,nodeFootprint(n).height)};
          const safe=placeWithoutOverlap({
            x:original.x+(ev.clientX-start.x)/zoom,y:original.y+(ev.clientY-start.y)/zoom
          },n,others,28,size);
          f.layout[n.id]=safe;card.style.left=safe.x+'px';card.style.top=safe.y+'px';
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
      }else{
        const lane=Math.max(25,Math.min(from.y,to.y)-75-slot*15-count*18);
        const excursion=Math.max(startX+55,endX+65);
        data=`M${startX},${startY} C${excursion},${startY} ${excursion},${lane} ${excursion},${lane} L${endX-56},${lane} C${endX-30},${lane} ${endX-30},${endY} ${endX},${endY}`;
      }
      line.setAttribute('d',data);line.setAttribute('marker-end','url(#flow-arrow)');
      line.classList.add('canvas-edge');line.dataset.from=edge.from;line.dataset.to=edge.to;
      svg.append(line);
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
  function autoLayout(){const f=getFlow();f.layout=Object.assign(Object.create(null),arrangeFlow(f));changed();draw();fit()}
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
