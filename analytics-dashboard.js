(() => {
  const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names={home:'Abstract & interactive figure',about:'Introduction',research:'Research directions',publications:'Publications',journey:'Background',visitors:'Visitors & locations',contact:'Contact'};
  const papers=new Map((window.PUBLICATIONS||[]).map(p=>[p.id,p.title]));
  let secret='';
  const duration=ms=>{const seconds=Math.round(Math.max(0,ms)/1000);return seconds<60?`${seconds}s`:`${Math.floor(seconds/60)}m ${seconds%60}s`;};
  const row=(label,value,note,width)=>`<div class="metric-row"><div class="metric-label"><span>${esc(label)}</span><small>${esc(value)} · ${esc(note)}</small></div><div class="metric-track"><span class="metric-fill" style="width:${Math.max(0,Math.min(100,width))}%"></span></div></div>`;
  $('#analytics-endpoint').value=window.SITE_CONFIG?.analytics?.endpoint||'';
  $('#preview-note').hidden=!['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  $('#analytics-forget').addEventListener('click',()=>{secret='';$('#analytics-token').value='';$('#analytics-connect').classList.remove('connected');$('#analytics-report').hidden=true;['section-chart','scroll-chart','paper-metrics'].forEach(id=>$('#'+id).replaceChildren());['metric-sessions','metric-average','metric-total'].forEach(id=>$('#'+id).textContent='—');$('#analytics-range').textContent='';$('#analytics-status').textContent='Report and token cleared.';});
  $('#analytics-connect').addEventListener('submit',async event=>{
    event.preventDefault();const button=$('button[type="submit"]');
    try {
      const base=new URL($('#analytics-endpoint').value);
      if ((base.protocol!=='https:'&&!(base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname))) || base.username || base.password || base.search || base.hash) throw new Error('Use an HTTPS service URL without credentials or query parameters.');
      secret=$('#analytics-token').value||secret;$('#analytics-token').value='';
      if(secret.length<32)throw new Error('Enter the private ADMIN_TOKEN configured on your Worker.');
      button.disabled=true;$('#analytics-report').hidden=true;$('#analytics-status').textContent='Loading private aggregate report…';
      const response=await fetch(base.href.replace(/\/$/,'')+'/engagement/stats?days='+$('#analytics-period').value,{headers:{Authorization:'Bearer '+secret},credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(response.status===401?'The reporting token was not accepted.':`The service could not load this report (HTTP ${response.status}).`);
      const data=await response.json();
      if(!Number.isFinite(data.sessions)||!Number.isFinite(data.active_ms)||!Array.isArray(data.sections)||!Array.isArray(data.papers)||!Array.isArray(data.scroll))throw new Error('The service returned an incompatible report.');
      $('#metric-sessions').textContent=data.sessions.toLocaleString();$('#metric-average').textContent=duration(data.sessions?data.active_ms/data.sessions:0);$('#metric-total').textContent=duration(data.active_ms);
      $('#analytics-range').textContent=`${data.start} to ${data.end} · UTC · rolling aggregates`;
      const sections=data.sections.map(s=>({...s,average:s.views?s.active_ms/s.views:0})), max=Math.max(1,...sections.map(s=>s.average));
      $('#section-chart').innerHTML=sections.length?sections.map(s=>row(names[s.id]||s.id,duration(s.average),`${s.views} sessions reached`,s.average/max*100)).join(''):'No section observations in this period.';
      const scroll=new Map(data.scroll.map(s=>[s.depth,s.reached]));
      $('#scroll-chart').innerHTML=[25,50,75,100].map(n=>{const count=scroll.get(n)||0,percent=data.sessions?Math.min(100,count/data.sessions*100):0;return row(`${n}% page depth`,`${percent.toFixed(0)}%`,`${count} sessions`,percent);}).join('');
      $('#paper-metrics').innerHTML=data.papers.length?data.papers.map(p=>`<tr><td>${esc(papers.get(p.id)||p.id)}</td><td>${esc(p.views)}</td><td>${duration(p.views?p.active_ms/p.views:0)}</td><td>${esc(p.opens)}</td><td>${esc(p.citations)}</td></tr>`).join(''):'<tr><td colspan="5">No publication observations in this period.</td></tr>';
      $('#analytics-report').hidden=false;$('#analytics-connect').classList.add('connected');$('#analytics-status').textContent=data.sessions?'Connected. Shared aggregate data is shown below.':'Connected. No sessions have been recorded in this period.';scrollTo({top:0,behavior:'smooth'});
    } catch(error) {$('#analytics-connect').classList.remove('connected');$('#analytics-status').textContent=error.message||'Could not load the private report.';}
    finally {button.disabled=false;}
  });
})();
