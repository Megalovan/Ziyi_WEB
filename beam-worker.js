/* Same spherical-wave model as the page, kept off the browser's main thread. */
importScripts('beam-field.js');
self.onmessage = async ({data}) => {
  try {
    const {distance,angle,width,height,bg,peak} = data;
    const field = await self.BeamField.sample(distance,angle,width,height);
    const pixels = self.BeamField.colorize(field.levels,bg,peak);
    self.postMessage({id:data.id,result:{width,height,pixels,computeMs:field.computeMs,cacheHit:field.cacheHit,backend:'worker'}},[pixels.buffer]);
  } catch(error) { self.postMessage({id:data.id,error:error.message}); }
};
