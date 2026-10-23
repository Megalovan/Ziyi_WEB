(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const cfg = window.SITE_CONFIG;
  const papers = window.PUBLICATIONS;
  const topics = window.RESEARCH_TOPICS;
  const safeStore = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* Preferences are optional. */ } },
  };
  const locales = window.SITE_LOCALES;
  const savedLanguage = safeStore.get('zx-language');
  let lang = Object.hasOwn(locales.languages, savedLanguage) ? savedLanguage : 'en';
  let selectedTopic = 'nearfield';
  let filter = 'all';
  let showAll = false;
  let readingMode = 'plain';
  let selectedPlace = 'hongkong';
  let currentCitation = '';
  let toastTimer;
  let ownRegion = null;
  let analyticsState = 'loading';
  let aggregateData = null;
  let analyticsStarted = false;
  const isLocal = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
  const english = Object.fromEntries($$('[data-i18n]').map(el => [el.dataset.i18n, el.innerHTML]));
  const copy = {en: english, ...locales.copy};
  const words = locales.words;
  const c = key => copy[lang][key] ?? english[key];
  const t = key => words[lang][key] ?? words.en[key] ?? key;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  function applyLanguage() {
    document.documentElement.lang = locales.languages[lang].htmlLang;
    document.title = t('pageTitle');
    $('meta[name="description"]').content = t('pageDescription');
    $('meta[property="og:title"]').content = t('pageTitle');
    $('meta[property="og:description"]').content = t('pageDescription');
    $$('[data-i18n]').forEach(el => { el.innerHTML = c(el.dataset.i18n); });
    $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $$('[data-i18n-alt]').forEach(el => el.alt = t(el.dataset.i18nAlt));
    $('#language-select').value = lang;
    $('#paper-search').placeholder = t('searchPlaceholder');
    $('#paper-search').setAttribute('aria-label', t('searchLabel'));
    $$('.close-dialog').forEach(button => button.setAttribute('aria-label', t('close')));
    $('#menu-toggle').setAttribute('aria-label', t($('#menu-toggle').getAttribute('aria-expanded') === 'true' ? 'navClose' : 'navOpen'));
    updateThemeLabel(); scheduleField(); renderResearch(); renderPapers(); selectPlace(selectedPlace, false); renderResearchMap(); renderAnalyticsStatus(); renderPrivacyState(); updateGeoText(); scheduleReadingProgress();
    if (aggregateData) renderAggregate(aggregateData);
  }
  $('#language-select').addEventListener('change', event => {
    const next = event.target.value;
    if (!Object.hasOwn(locales.languages, next)) return;
    lang = next; safeStore.set('zx-language', lang); applyLanguage();
  });
  function updateThemeLabel() {
    const dark = document.documentElement.dataset.theme === 'dark';
    $('#theme-toggle').setAttribute('aria-label', t(dark ? 'themeLight' : 'themeDark'));
    $('#theme-toggle').innerHTML = icon(dark ? 'sun' : 'moon');
    $('meta[name="theme-color"]').content = dark ? '#131b27' : '#ffffff';
  }
  $('#theme-toggle').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; safeStore.set('zx-theme', theme); updateThemeLabel(); scheduleField(); });
  $('#menu-toggle').addEventListener('click', () => { const open = $('#menu-toggle').getAttribute('aria-expanded') !== 'true'; $('#main-nav').classList.toggle('open', open); $('#menu-toggle').setAttribute('aria-expanded', String(open)); $('#menu-toggle').setAttribute('aria-label', t(open ? 'navClose' : 'navOpen')); });
  $$('#main-nav a').forEach(link => link.addEventListener('click', () => { $('#main-nav').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded', 'false'); $('#menu-toggle').setAttribute('aria-label', t('navOpen')); }));

  function renderResearch() {
    const topic = topics[selectedTopic];
    $('#research-detail-label').textContent = `${topic.number} / ${topic.label[lang].toUpperCase()}`;
    $('#research-detail-title').textContent = topic.title[lang];
    $('#research-detail-text').textContent = topic.text[lang];
    $('#research-keywords').innerHTML = topic.keywords[lang].map(keyword => `<span>${esc(keyword)}</span>`).join('');
    $$('.research-node').forEach(node => { const active = node.dataset.topic === selectedTopic; node.classList.toggle('active', active); node.setAttribute('aria-pressed', String(active)); });
  }
  $$('.research-node').forEach(node => node.addEventListener('click', () => { selectedTopic = node.dataset.topic; renderResearch(); }));
  $('#related-papers').addEventListener('click', () => { filter = selectedTopic; showAll = true; $('#paper-search').value = ''; renderPapers(); });
  function paperLink(paper) {
    return paper.doi ? `https://doi.org/${paper.doi}` : (paper.url || `https://scholar.google.com/scholar?q=${encodeURIComponent('"' + paper.title + '"')}`);
  }
  function renderPapers() {
    const query = $('#paper-search').value.trim().toLocaleLowerCase();
    const filtered = papers.filter(paper => (filter === 'all' || filter === paper.topic) && (!query || `${paper.title} ${paper.authors} ${paper.venue} ${paper.year} ${paper.plain[lang]}`.toLocaleLowerCase().includes(query)));
    const selectedOnly = !showAll && filter === 'all' && !query;
    const visible = selectedOnly ? filtered.filter(p => p.featured) : filtered;
    $('#paper-count').textContent = `${String(visible.length).padStart(2, '0')} ${t(selectedOnly ? 'selected' : 'results')}`;
    $$('.filter').forEach(button => { const active = button.dataset.filter === filter; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    $('#paper-list').innerHTML = visible.length ? visible.map(paper => `<article class="paper" id="publication-${esc(paper.id)}" data-paper-id="${esc(paper.id)}">
      <span class="paper-number">[${papers.indexOf(paper) + 1}]</span>
      <div class="paper-main"><div class="paper-meta"><span>${paper.year} / ${t(paper.type)}</span>${paper.award ? `<span class="award-label">✳ ${t('award')}</span>` : ''}${paper.accepted ? `<span class="accepted-label">${t('accepted')}</span>` : ''}</div>
      <h3><a href="${esc(paperLink(paper))}" target="_blank" rel="noopener noreferrer">${esc(paper.title)}</a></h3>
      <p class="paper-authors">${esc(paper.authors).replace(/Ziyi Xu/g, '<strong>Ziyi Xu</strong>')}</p>
      <p class="paper-venue"><em>${esc(paper.venue)}</em> · ${esc(paper.detail)}</p>
      <p class="paper-summary">${esc(paper[readingMode][lang])}</p></div>
      <div class="paper-actions"><a href="${esc(paperLink(paper))}" target="_blank" rel="noopener noreferrer">${t(paper.doi || paper.url ? 'paper' : 'findPaper')} ${icon('arrow')}</a><button data-cite="${esc(paper.id)}" aria-label="${esc(t('cite') + ': ' + paper.title)}">${t('cite')} ${icon('copy')}</button></div></article>`).join('') : `<p class="empty-papers">${t('noResults')}</p>`;
    $('#show-all').innerHTML = `<span>${t(showAll || filter !== 'all' || query ? 'showSelected' : 'allPapers')}</span><span aria-hidden="true">${selectedOnly ? '↓' : '↑'}</span>`;
  }
  $$('.filter').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; showAll = filter !== 'all'; renderPapers(); }));
  $$('[data-paper-topic]').forEach(link => link.addEventListener('click', () => { selectedTopic=link.dataset.paperTopic;filter=selectedTopic;showAll=true;$('#paper-search').value='';renderResearch();renderPapers(); }));
  $('#paper-search').addEventListener('input', renderPapers);
  $('#show-all').addEventListener('click', () => { if (showAll || filter !== 'all' || $('#paper-search').value.trim()) { showAll = false; filter = 'all'; $('#paper-search').value = ''; } else showAll = true; renderPapers(); });
  ['plain', 'technical'].forEach(mode => $(`#mode-${mode}`).addEventListener('click', () => { readingMode = mode; ['plain', 'technical'].forEach(m => { $(`#mode-${m}`).classList.toggle('active', m === mode); $(`#mode-${m}`).setAttribute('aria-pressed', String(m === mode)); }); renderPapers(); }));
  function bibtex(paper) {
    const authors = paper.authors.replace(/[†*]/g, '').split(', ').join(' and ');
    const fields = [`  title = {${paper.title}}`, `  author = {${authors}}`, `  ${paper.type === 'journal' ? 'journal' : 'booktitle'} = {${paper.venue}}`, `  year = {${paper.year}}`];
    if (paper.doi) fields.push(`  doi = {${paper.doi}}`);
    const volume = paper.detail.match(/Vol\. (\d+)/); if (volume) fields.push(`  volume = {${volume[1]}}`);
    const number = paper.detail.match(/no\. (\d+)/); if (number) fields.push(`  number = {${number[1]}}`);
    const pageRange = paper.detail.match(/pp\. (\d+)[–-](\d+)/); if (pageRange) fields.push(`  pages = {${pageRange[1]}--${pageRange[2]}}`);
    const article = paper.detail.match(/article (\d+)/); if (article) fields.push(`  pages = {${article[1]}}`);
    if (paper.accepted) fields.push('  note = {Accepted}');
    return `@${paper.type === 'journal' ? 'article' : 'inproceedings'}{${paper.id},\n${fields.join(',\n')}\n}`;
  }
  $('#paper-list').addEventListener('click', event => { const button = event.target.closest('[data-cite]'); if (!button) return; const paper = papers.find(p => p.id === button.dataset.cite); currentCitation = bibtex(paper); $('#citation-content').textContent = currentCitation; $('#citation-dialog').showModal(); });
  function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('show'); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500); }
  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); toast(t('copied')); }
    catch { const textarea = document.createElement('textarea'); textarea.value = value; textarea.style.position = 'fixed'; textarea.style.opacity = '0'; const parent = $('dialog[open]') || document.body; parent.append(textarea); textarea.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { /* Text remains selectable in the citation dialog. */ } textarea.remove(); toast(t(ok ? 'copied' : 'copyFailed')); }
  }
  $('#copy-citation').addEventListener('click', () => copyText(currentCitation));
  $('#copy-email').addEventListener('click', () => copyText(cfg.email));
  $$('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); }));

  const placeNotes = locales.places;
  function selectPlace(place, highlight = true) {
    selectedPlace = place;
    $$('.place').forEach(button => { const active = button.dataset.place === place; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    $('#place-note').textContent = placeNotes[place][lang];
    if (highlight) $$('.timeline li').forEach(item => { item.classList.toggle('highlight', item.dataset.location === place); item.classList.toggle('dimmed', item.dataset.location !== place); });
  }
  $$('.place').forEach(button => button.addEventListener('click', () => selectPlace(button.dataset.place)));

  // Phase-only spherical-wave ULA response with a virtual source behind the aperture.
  // Interactive schematic, not a reproduction of a paper experiment.
  const canvas = $('#field-canvas');
  let fieldVisible = !('IntersectionObserver' in window), fieldFrame, fieldSettle;
  function updateFieldControls() {
    const distance = Number($('#focus-range').value), angle = Number($('#focus-angle').value);
    $$('.field-lab .math-symbol[data-latex]:not(output)').forEach(el => window.MathNotation.typeset(el,el.dataset.latex,el.getAttribute('aria-label')));
    window.MathNotation.typeset($('#range-value'), `${distance}\\,\\lambda`, `${distance} ${t('wavelengths')}`);
    window.MathNotation.typeset($('#angle-value'), `${angle}^{\\circ}`, `${angle} ${t('degrees')}`);
    $('#focus-range').setAttribute('aria-valuetext', `${distance} ${t('wavelengths')}`);
    $('#focus-angle').setAttribute('aria-valuetext', `${angle} ${t('degrees')}`);
    return {distance,angle};
  }
  function scheduleField(quality='normal') {
    const {distance,angle}=updateFieldControls();
    cancelAnimationFrame(fieldFrame);
    if(fieldVisible) fieldFrame=requestAnimationFrame(()=>window.DivergingBeam.render(canvas,distance,angle,{quality}));
  }
  if('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      fieldVisible=entries[0].isIntersecting;
      if(fieldVisible) scheduleField(); else cancelAnimationFrame(fieldFrame);
    },{rootMargin:'120px 0px'});
    observer.observe($('.field-lab'));
  }
  if('ResizeObserver' in window) new ResizeObserver(()=>scheduleField()).observe($('.field-canvas-wrap'));
  ['#focus-range','#focus-angle'].forEach(selector=>{
    $(selector).addEventListener('input',()=>{
      clearTimeout(fieldSettle);scheduleField('fast');
      fieldSettle=setTimeout(()=>scheduleField(),180);
    });
    $(selector).addEventListener('change',()=>{clearTimeout(fieldSettle);scheduleField();});
  });
  $('#save-field').addEventListener('click',async()=>{
    const button=$('#save-field');button.disabled=true;
    const {distance,angle}=updateFieldControls();
    try {
      const output=document.createElement('canvas');
      await window.DivergingBeam.render(output,distance,angle,{quality:'export',labelWidth:canvas.clientWidth});
      const a=document.createElement('a');
      a.download=`ziyi-xu-${window.DivergingBeam.antennaCount}-antenna-diverging-beam-${distance}lambda-${angle}deg.png`;
      a.href=output.toDataURL('image/png');a.click();toast(t('saved'));
    } finally {button.disabled=false;}
  });

  // The map is equirectangular. Research points and visitor points are separate layers.
  const NS='http://www.w3.org/2000/svg';
  const project = (lat,lon) => [((lon+180)/360)*800,25+((90-lat)/180)*400];
  function marker(group,lat,lon,css,label,r=5){const [x,y]=project(lat,lon);const circle=document.createElementNS(NS,'circle');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',r);circle.setAttribute('class',css);const title=document.createElementNS(NS,'title');title.textContent=label;circle.append(title);group.append(circle);return [x,y];}
  function renderResearchMap() {
    $('#map-research-points').replaceChildren();
    [{lat:45.8,lon:126.5,key:'harbin',dx:11,dy:-9},{lat:22.4,lon:114.2,key:'hongkong',dx:12,dy:19},{lat:58.4,lon:15.6,key:'linkoping',dx:-84,dy:-10}].forEach(place=>{const label=c(place.key);const [x,y]=marker($('#map-research-points'),place.lat,place.lon,'research-point',label,5);const text=document.createElementNS(NS,'text');text.setAttribute('x',x+place.dx);text.setAttribute('y',y+place.dy);text.setAttribute('class','map-point-label');text.textContent=label;$('#map-research-points').append(text);});
  }
  function updateGeoText(){if(ownRegion)$('#geo-status').textContent=t('located')+ownRegion.label+t('locationSuffix');else $('#geo-status').textContent=c('geoNote');renderMapExplanation();}
  function renderMapExplanation(){let text=aggregateData?t('visitorMap'):c('mapExplanation');if(ownRegion)text+=' '+t('mapSelf');$('#map-explanation').textContent=text;}
  async function fetchJSON(url,options={}){const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),9000);try{const response=await fetch(url,{...options,signal:abort.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok){const error=new Error('HTTP '+response.status);error.status=response.status;throw error;}return await response.json();}finally{clearTimeout(timeout);}}
  $('#locate-me').addEventListener('click',async()=>{const button=$('#locate-me');button.disabled=true;$('#geo-status').textContent=t('locating');try{const data=await fetchJSON(cfg.analytics.locationEndpoint);if(data.success!==true||!Number.isFinite(data.latitude)||!Number.isFinite(data.longitude))throw new Error('No location');const label=[data.city,data.region,data.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');ownRegion={label,latitude:data.latitude,longitude:data.longitude};$('#map-self-point').replaceChildren();marker($('#map-self-point'),data.latitude,data.longitude,'self-point',label,7);updateGeoText();}catch(error){$('#geo-status').textContent=error.status===429?t('locationRateLimited'):t('locationFailed');}finally{button.disabled=false;}});
  const noTracking = () => navigator.doNotTrack==='1'||window.doNotTrack==='1'||navigator.globalPrivacyControl===true;
  const optedOut = () => safeStore.get('zx-no-analytics')==='1';
  function renderAnalyticsStatus(){
    const keys={local:'statsLocal',loading:'statsLoading',unavailable:'statsUnavailable',aggregate:'statsAggregate',disabled:'statsDisabled',dnt:'statsDNT'};
    const status=$('#stats-status');
    status.textContent=analyticsState==='ready'?'':t(keys[analyticsState]||'statsUnavailable');
    status.hidden=!status.textContent;
    renderMapExplanation();
  }
  function renderPrivacyState(){$('#disable-analytics').textContent=t(optedOut()?'enable':'disable');$('#privacy-state').textContent=optedOut()?t('statsDisabled'):(noTracking()?t('statsDNT'):'');}
  function renderAggregate(data){
    if(!Number.isFinite(data.total_visitors)||!Number.isFinite(data.total_views)||!Array.isArray(data.regions))throw new Error('Invalid analytics response');
    aggregateData=data;const format=new Intl.NumberFormat(locales.languages[lang].numberLocale);
    $('#visitor-uv').textContent=format.format(data.total_visitors);$('#visitor-pv').textContent=format.format(data.total_views);$('#visitor-regions').textContent=format.format(data.region_count??data.regions.length);
    $('#map-visitor-points').replaceChildren();data.regions.forEach(region=>{if(Number.isFinite(region.latitude)&&Number.isFinite(region.longitude))marker($('#map-visitor-points'),region.latitude,region.longitude,'visitor-point',`${region.country}: ${region.visitors}`,Math.min(15,4+Math.log2(1+region.visitors)*1.5));});
    analyticsState='aggregate';renderAnalyticsStatus();
  }
  async function startAnalytics(){
    if(optedOut()){analyticsState='disabled';renderAnalyticsStatus();return;}
    if(noTracking()){analyticsState='dnt';renderAnalyticsStatus();return;}
    if(isLocal){analyticsState='local';renderAnalyticsStatus();return;}
    if(analyticsStarted)return;analyticsStarted=true;analyticsState='loading';renderAnalyticsStatus();
    if(cfg.analytics.endpoint){
      try{
        let visitor=safeStore.get('zx-visitor');if(!visitor){visitor=crypto.randomUUID();safeStore.set('zx-visitor',visitor);}
        const endpoint=cfg.analytics.endpoint.replace(/\/$/,'');
        const data=await fetchJSON(endpoint+'/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitor})});
        if(!optedOut())renderAggregate(data);
      }catch{analyticsState=optedOut()?'disabled':'unavailable';renderAnalyticsStatus();}
      return;
    }
    if(!cfg.analytics.busuanzi){analyticsState='disabled';renderAnalyticsStatus();return;}
    let resolved=false;
    const observer=new MutationObserver(()=>{
      if(optedOut())return;
      const uv=$('#busuanzi_value_site_uv').textContent.trim(),pv=$('#busuanzi_value_site_pv').textContent.trim();
      if(/^\d+$/.test(uv)&&/^\d+$/.test(pv)){resolved=true;$('#visitor-uv').textContent=new Intl.NumberFormat().format(Number(uv));$('#visitor-pv').textContent=new Intl.NumberFormat().format(Number(pv));analyticsState='ready';renderAnalyticsStatus();observer.disconnect();}
    });
    observer.observe($('.busuanzi-values'),{subtree:true,childList:true,characterData:true});
    const script=document.createElement('script');script.src='https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';script.async=true;script.referrerPolicy='strict-origin-when-cross-origin';
    const fail=()=>{if(!resolved&&!optedOut()){analyticsState='unavailable';renderAnalyticsStatus();}observer.disconnect();};script.onerror=fail;document.head.append(script);setTimeout(fail,12000);
  }
  $('#privacy-button').addEventListener('click',()=>{renderPrivacyState();$('#privacy-dialog').showModal();});
  $('#disable-analytics').addEventListener('click',()=>{const next=!optedOut();safeStore.set('zx-no-analytics',next?'1':'0');if(next){analyticsState='disabled';aggregateData=null;$('#visitor-uv').textContent='—';$('#visitor-pv').textContent='—';$('#visitor-regions').textContent='—';$('#map-visitor-points').replaceChildren();}else{analyticsStarted=false;startAnalytics();}renderPrivacyState();renderAnalyticsStatus();$('#privacy-state').textContent=t(next?'disabledNext':'enabledNext');});

  function updateClock(){$('#hk-clock').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());}
  updateClock();setInterval(updateClock,30000);$('#copyright-year').textContent=new Date().getFullYear();
  $$('.scholar-link').forEach(a=>a.href=cfg.scholar);$$('.linkedin-link').forEach(a=>a.href=cfg.linkedin);
  if(cfg.canonicalUrl){const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=cfg.canonicalUrl;document.head.append(canonical);const meta=document.createElement('meta');meta.setAttribute('property','og:url');meta.content=cfg.canonicalUrl;document.head.append(meta);}
  if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){$$('#main-nav a').forEach(a=>a.classList.toggle('current',a.getAttribute('href')==='#'+entry.target.id));}});},{rootMargin:'-20% 0px -65% 0px'});$$('main section[id]').forEach(section=>observer.observe(section));}
  if(cfg.portrait){$('#portrait-link').href=cfg.portrait;const photo=$('#profile-photo');photo.addEventListener('load',()=>{$('#portrait-frame').hidden=false;});photo.addEventListener('error',()=>{$('#portrait-frame').hidden=true;});photo.src=cfg.portrait;}
  const readingProgress = $('#reading-progress');
  let readingFrame;
  function updateReadingProgress() {
    const extent = document.documentElement.scrollHeight - innerHeight;
    readingProgress.style.width = `${extent > 0 ? Math.min(100, Math.max(0, scrollY / extent * 100)) : 0}%`;
  }
  function scheduleReadingProgress() { cancelAnimationFrame(readingFrame);readingFrame=requestAnimationFrame(updateReadingProgress); }
  addEventListener('scroll',scheduleReadingProgress,{passive:true});
  addEventListener('resize',scheduleReadingProgress);
  applyLanguage();startAnalytics();scheduleReadingProgress();
  window.MathNotation.ready.then(scheduleField);
  document.fonts.ready.then(() => { scheduleField();scheduleReadingProgress(); });
})();
