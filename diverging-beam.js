/* Canvas annotations stay on the page; numerical sampling runs in a worker. */
(() => {
  const {antennaCount,view,createModel,dimensions} = window.BeamField;
  const workerURL = new URL('beam-worker.js',document.currentScript.src);
  let worker, workerDisabled = false, nextJob = 0, activeJob, pendingPreview, lastField;
  const exportQueue = [], inFlight = new Map();
  const requests = new WeakMap(), painted = new WeakMap();

  function finish(job,result,error) {
    if(activeJob!==job) return;
    activeJob=null;
    if(error) job.reject(error); else job.resolve(result);
    pump();
  }
  async function fallback(job) {
    try {
      const {distance,angle,width,height,bg,peak} = job.input;
      const result = await window.BeamField.sample(distance,angle,width,height,{
        yieldControl:()=>new Promise(resolve=>setTimeout(resolve,0)),
        isCancelled:()=>job.mode!=='export' && Boolean(pendingPreview),
      });
      finish(job,result?{...result,pixels:window.BeamField.colorize(result.levels,bg,peak),backend:'fallback'}:null);
    } catch(error) { finish(job,null,error); }
  }
  function pump() {
    if(activeJob) return;
    const job = exportQueue.shift() || pendingPreview;
    if(!job) return;
    if(job===pendingPreview) pendingPreview=null;
    activeJob=job;
    if(!worker && !workerDisabled) {
      try {
        worker=new Worker(workerURL);
        worker.onmessage=({data})=>{
          const current=activeJob;
          if(!current || data.id!==current.id) return;
          finish(current,data.result,data.error?new Error(data.error):null);
        };
        worker.onerror=event=>{
          event.preventDefault(); if(workerDisabled) return; worker.terminate(); worker=null; workerDisabled=true;
          if(activeJob) fallback(activeJob);
        };
      } catch { workerDisabled=true; }
    }
    if(worker) worker.postMessage({id:job.id,...job.input}); else fallback(job);
  }
  function fieldFor(input,mode) {
    const key=JSON.stringify(input);
    if(mode!=='export' && lastField?.key===key) return Promise.resolve({...lastField.result,cacheHit:true});
    if(inFlight.has(key)) return inFlight.get(key);
    const task = new Promise((resolve,reject)=>{
      const job={id:++nextJob,input,mode,resolve,reject};
      if(mode==='export') exportQueue.push(job);
      else { if(pendingPreview) pendingPreview.resolve(null); pendingPreview=job; }
      pump();
    }).then(result=>{
      inFlight.delete(key);
      if(result && mode!=='export') lastField={key,result};
      return result;
    },error=>{inFlight.delete(key);throw error;});
    inFlight.set(key,task);
    return task;
  }

  async function render(canvas, distance, angle, {quality='normal',labelWidth=canvas.clientWidth} = {}) {
    const request = (requests.get(canvas)||0)+1; requests.set(canvas,request);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const model = createModel(distance, angle);
    const dark = document.documentElement.dataset.theme === 'dark';
    const theme = getComputedStyle(document.documentElement);
    const ink = theme.getPropertyValue('--green').trim();
    const muted = theme.getPropertyValue('--muted').trim();
    const line = theme.getPropertyValue('--line').trim();
    const bg = dark ? [19,27,39] : [250,251,253];
    const peak = dark ? [116,157,208] : [33,70,116];
    const [width,height] = dimensions[quality] || dimensions.normal;
    const signature = [distance,angle,quality,dark,labelWidth,document.documentElement.lang,document.fonts.status].join('|');
    if(painted.get(canvas)===signature) return true;
    const [fieldData,xLabel,yLabel] = await Promise.all([
      fieldFor({distance,angle,width,height,bg,peak},quality),
      window.MathNotation.image('x/\\lambda',muted),
      window.MathNotation.image('y/\\lambda',muted),
    ]);
    if(!fieldData || requests.get(canvas)!==request) return false;
    const size = 900; canvas.width = size; canvas.height = 570;
    const labelSize = 12 * size / Math.max(300, labelWidth);
    const font = (px = 12) => `${Math.max(12, px) / 12 * labelSize}px "STIX Two Text", "Times New Roman", serif`;
    // Use nearly equal wavelength scales and reserve just enough room for the source.
    const plot = {x:152, y:56, w:690, h:428};
    const xSpan = view.xMax - view.xMin, ySpan = view.yMax - view.yMin;
    const X = x => plot.x + (x - view.xMin) / xSpan * plot.w;
    const Y = y => plot.y + (view.yMax - y) / ySpan * plot.h;
    const field = document.createElement('canvas'); field.width=width; field.height=height;
    field.getContext('2d').putImageData(new ImageData(fieldData.pixels,width,height),0,0);
    ctx.fillStyle=`rgb(${bg})`;ctx.fillRect(0,0,900,570);
    ctx.drawImage(field,plot.x,plot.y,plot.w,plot.h);
    ctx.strokeStyle=line;ctx.lineWidth=1;ctx.globalAlpha=.6;
    for(const x of view.xTicks){ctx.beginPath();ctx.moveTo(X(x),plot.y);ctx.lineTo(X(x),plot.y+plot.h);ctx.stroke();}
    for(const y of view.yTicks){ctx.beginPath();ctx.moveTo(plot.x,Y(y));ctx.lineTo(plot.x+plot.w,Y(y));ctx.stroke();}
    ctx.globalAlpha=1;
    ctx.save();ctx.beginPath();ctx.rect(plot.x,plot.y,plot.w,plot.h);ctx.clip();
    ctx.strokeStyle=ink;ctx.globalAlpha=.24;ctx.lineWidth=1.4;
    const halfAperture = model.elements[model.elements.length - 1];
    for(const ey of [-halfAperture,-halfAperture/2,0,halfAperture/2,halfAperture]){
      const rightY=ey+(ey-model.source.y)/(-model.source.x)*view.xMax;
      ctx.beginPath();ctx.moveTo(X(0),Y(ey));ctx.lineTo(X(view.xMax),Y(rightY));ctx.stroke();
    }
    ctx.restore();
    ctx.save();ctx.setLineDash([7,8]);ctx.strokeStyle=ink;ctx.globalAlpha=.5;ctx.lineWidth=1.5;
    for(const ey of [-halfAperture,0,halfAperture]){ctx.beginPath();ctx.moveTo(X(model.source.x),Y(model.source.y));ctx.lineTo(X(0),Y(ey));ctx.stroke();}
    ctx.restore();
    ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(X(0),Y(-halfAperture-.5));ctx.lineTo(X(0),Y(halfAperture+.5));ctx.stroke();
    const elementHeight = Math.min(2.8, .5 / ySpan * plot.h * .6);
    model.elements.forEach(ey=>ctx.fillRect(X(0)-6,Y(ey)-elementHeight/2,12,elementHeight));
    const sx=X(model.source.x),sy=Y(model.source.y);
    const sourceRadius = Math.min(7, (X(0)-sx)*.35);
    ctx.fillStyle=theme.getPropertyValue('--gold').trim();ctx.beginPath();ctx.arc(sx,sy,sourceRadius,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=theme.getPropertyValue('--gold').trim();ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(sx,sy,sourceRadius*2,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=muted;ctx.font=font();ctx.textAlign='center';
    for(const x of view.xTicks)ctx.fillText(String(x),X(x),plot.y+plot.h+35);
    // On phones, label the vertical limits and leave intermediate grid lines unnumbered.
    const yLabels = view.yTicks.filter(y=>y!==0 && (labelWidth>=360 || Math.abs(y)===view.yMax));
    ctx.textAlign='right';for(const y of yLabels)ctx.fillText(String(y),plot.x-22,Y(y)+8);
    ctx.font=font(11);ctx.textAlign='left';ctx.fillStyle=ink;
    const language=document.documentElement.lang==='zh-Hans'?'zh':document.documentElement.lang;
    const labels=window.SITE_LOCALES.words[language]||window.SITE_LOCALES.words.en;
    // Wrap long translated labels within the source margin at phone sizes.
    const sourceLines = [];
    for(const word of labels.source.split(' ')) {
      const last = sourceLines.length - 1;
      if(last >= 0 && ctx.measureText(`${sourceLines[last]} ${word}`).width < plot.x - 24) sourceLines[last] += ` ${word}`;
      else sourceLines.push(word);
    }
    sourceLines.forEach((text,i)=>ctx.fillText(text,12,sy-34-(sourceLines.length-1-i)*labelSize*1.15));
    ctx.fillText(labels.array,plot.x-24,plot.y+plot.h+78);
    window.MathNotation.draw(ctx,yLabel,plot.x-20,29,labelSize);
    window.MathNotation.draw(ctx,xLabel,plot.x+plot.w,plot.y+plot.h+78,labelSize,'right');
    const gx=660,gy=14;for(let i=0;i<100;i++){const a=i/100*.85;ctx.fillStyle=`rgb(${bg.map((v,c)=>v+(peak[c]-v)*a)})`;ctx.fillRect(gx+i,gy,1,10);}
    ctx.fillStyle=muted;ctx.font=font(9);ctx.textAlign='right';ctx.fillText('−24',gx-10,gy+12);ctx.textAlign='left';ctx.fillText('0 dB',gx+110,gy+12);
    painted.set(canvas,signature);
    canvas.dataset.quality=quality;
    canvas.dataset.samples=String(width*height);
    canvas.dataset.computeMs=String(Math.round(fieldData.computeMs));
    canvas.dataset.backend=fieldData.backend;
    canvas.dataset.cacheHit=String(fieldData.cacheHit);
    canvas.dataset.distance=String(distance); canvas.dataset.angle=String(angle);
    return true;
  }
  window.DivergingBeam = {antennaCount,view,createModel,render};
})();
