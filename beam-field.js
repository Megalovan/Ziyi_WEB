/* Phase-only spherical-wave ULA model. All lengths are normalized by wavelength. */
((root) => {
  const antennaCount = 64;
  const view = Object.freeze({
    xMin: 0, xMax: 320, yMin: -100, yMax: 100,
    xTicks: [0, 80, 160, 240, 320], yTicks: [-100, -50, 0, 50, 100],
  });
  function createModel(distance, angleDegrees, count = antennaCount) {
    const angle = angleDegrees * Math.PI / 180;
    const source = {x: -distance * Math.cos(angle), y: -distance * Math.sin(angle)};
    const elements = Array.from({length: count}, (_, n) => (n - (count - 1) / 2) * 0.5);
    const phases = elements.map(y => Math.hypot(source.x, source.y - y));
    return {
      source, elements,
      powerAt(x, y) {
        let re = 0, im = 0;
        const xSquared = x*x;
        for (let n = 0; n < count; n++) {
          // Positive source phase gives a diverging wave, rather than a forward focus.
          const dy = y - elements[n];
          const phase = 2 * Math.PI * (Math.sqrt(xSquared + dy*dy) + phases[n]);
          re += Math.cos(phase); im += Math.sin(phase);
        }
        return (re * re + im * im) / (count * count);
      },
    };
  }

  const dimensions = Object.freeze({fast:[320,200], normal:[640,400], export:[1280,800]});
  const fields = new Map();
  async function sample(distance, angle, width, height, {yieldControl, isCancelled = () => false} = {}) {
    const key = [distance,angle,width,height].join(':');
    if(fields.has(key)) {
      const result = fields.get(key); fields.delete(key); fields.set(key,result);
      return {...result,cacheHit:true};
    }
    const start = performance.now();
    const model = createModel(distance,angle);
    const values = new Float32Array(width*height);
    let maximum = 0;
    for(let py=0;py<height;py++) {
      if(yieldControl && py%8===0) { await yieldControl(); if(isCancelled()) return null; }
      const y = view.yMax-py/(height-1)*(view.yMax-view.yMin);
      for(let px=0;px<width;px++) {
        const power = model.powerAt(view.xMin+px/(width-1)*(view.xMax-view.xMin),y);
        values[py*width+px] = power; maximum = Math.max(maximum,power);
      }
    }
    const levels = new Uint8Array(values.length);
    for(let i=0;i<values.length;i++) {
      const db = 10*Math.log10(Math.max(values[i]/Math.max(maximum,1e-12),1e-3));
      levels[i] = Math.round(Math.pow(Math.max(0,Math.min(1,(db+24)/24)),1.8)*.85*255);
    }
    const result = {levels,width,height,computeMs:performance.now()-start,cacheHit:false};
    // Keep a small cache for slider backtracking and palette/language changes.
    if(width<=640) { fields.set(key,result); if(fields.size>6) fields.delete(fields.keys().next().value); }
    return result;
  }
  function colorize(levels,bg,peak) {
    const rgba = new Uint8ClampedArray(levels.length*4);
    for(let i=0;i<levels.length;i++) {
      const level = levels[i]/255;
      for(let c=0;c<3;c++) rgba[i*4+c] = bg[c]+(peak[c]-bg[c])*level;
      rgba[i*4+3] = 255;
    }
    return rgba;
  }
  root.BeamField = {antennaCount,view,dimensions,createModel,sample,colorize};
})(typeof self==='object'?self:window);
