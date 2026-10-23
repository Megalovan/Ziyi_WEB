/* Optional aggregate reading metrics. No replay, query text, pointer coordinates, or visitor IDs. */
(() => {
  'use strict';
  const config=window.SITE_CONFIG?.analytics;
  if (!config?.endpoint || config.engagement!==true) return;
  const endpoint=config.endpoint.replace(/\/$/,'')+'/engagement';
  const permitted=()=>{
    try { if(localStorage.getItem('zx-no-analytics')==='1') return false; } catch { /* Storage is optional. */ }
    return navigator.doNotTrack!=='1' && window.doNotTrack!=='1' && navigator.globalPrivacyControl!==true;
  };
  let last=performance.now(), interaction=last, lastFlush=last, sending=false, first=true, off=false;
  let queue=[], reached=new Set(), paperReached=new Set(), depthReached=new Set();
  const fresh=()=>({event_id:crypto.randomUUID(),session_start:0,active_ms:0,section_ms:{},sections_seen:[],paper_ms:{},papers_seen:[],paper_clicks:{},citation_clicks:{},scroll_reached:[]});
  let packet=fresh();
  const add=(object,id,amount)=>{object[id]=Math.min(60000,(object[id]||0)+amount);};
  function visibleElements(selector) {
    return Array.from(document.querySelectorAll(selector)).map(el=>{
      const r=el.getBoundingClientRect();
      return {el,visible:Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(60,r.top)),height:r.height};
    }).filter(v=>v.visible>=Math.min(100,v.height/3)).sort((a,b)=>b.visible-a.visible);
  }
  function reset() {queue=[];packet=fresh();first=true;reached.clear();paperReached.clear();depthReached.clear();}
  function sample() {
    const now=performance.now(), elapsed=Math.max(0,Math.min(2000,Math.round(now-last)));last=now;
    if (!permitted()) {if(!off)reset();off=true;return;}
    off=false;
    if (document.visibilityState!=='visible' || !document.hasFocus() || now-interaction>60000 || packet.active_ms>=60000) return;
    const step=Math.min(elapsed,60000-packet.active_ms), sections=visibleElements('main section[id]');
    if (!sections.length) return;
    packet.active_ms+=step;add(packet.section_ms,sections[0].el.id,step);
    sections.forEach(({el})=>{if(!reached.has(el.id)){reached.add(el.id);packet.sections_seen.push(el.id);}});
    const papers=visibleElements('.paper[data-paper-id]');
    if (sections[0].el.id==='publications' && papers.length) add(packet.paper_ms,papers[0].el.dataset.paperId,step);
    papers.forEach(({el})=>{const id=el.dataset.paperId;if(!paperReached.has(id)){paperReached.add(id);packet.papers_seen.push(id);}});
    const depth=(scrollY+innerHeight)/Math.max(innerHeight,document.documentElement.scrollHeight)*100;
    [25,50,75,100].forEach(n=>{if(depth>=n-(n===100?.3:0)&&!depthReached.has(n)){depthReached.add(n);packet.scroll_reached.push(n);}});
  }
  async function send() {
    if(sending || !queue.length || !permitted())return;
    sending=true;const payload=queue[0];
    try {
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,signal:AbortSignal.timeout(10000)});
      if(response.ok && queue[0]?.event_id===payload.event_id)queue.shift();
      else if(response.status>=400&&response.status<500&&response.status!==429)queue=[];
    } catch { /* Best effort: retry on the next flush, with the same deduplication ID. */ }
    finally {sending=false;}
  }
  function flush() {
    if(!permitted()){reset();return;}
    if(queue.length<4 && (packet.active_ms || packet.sections_seen.length || Object.keys(packet.paper_clicks).length || Object.keys(packet.citation_clicks).length)) {
      packet.session_start=Number(first);first=false;queue.push(packet);packet=fresh();
    }
    lastFlush=performance.now();send();
  }
  ['pointerdown','keydown','scroll','touchstart'].forEach(type=>addEventListener(type,()=>{interaction=performance.now();},{passive:true}));
  addEventListener('focus',()=>{interaction=performance.now();last=interaction;});
  document.addEventListener('click',event=>{
    if(!permitted()){reset();return;}
    const action=event.target.closest('.paper h3 a,.paper-actions a,.paper-actions [data-cite]'), paper=action?.closest('[data-paper-id]');
    if(!paper)return;
    const target=action.hasAttribute('data-cite')?packet.citation_clicks:packet.paper_clicks, id=paper.dataset.paperId;
    target[id]=Math.min(50,(target[id]||0)+1);
  });
  document.addEventListener('visibilitychange',()=>{sample();if(document.visibilityState==='hidden')flush();last=performance.now();});
  addEventListener('pagehide',()=>{sample();flush();});
  setInterval(()=>{sample();if(performance.now()-lastFlush>=15000)flush();},1000);
})();
