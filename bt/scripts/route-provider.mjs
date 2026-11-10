export function validRouteInput(value) {
  const point = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat)<=90 && Math.abs(p.lng)<=180;
  return value && ['walk','car','transit','bicycle'].includes(value.mode) && point(value.from) && point(value.to);
}
export function providerRequest(input) {
  if(!validRouteInput(input)) throw new Error('invalid route');
  if(input.mode==='car') {
    const url=new URL('https://apis-navi.kakaomobility.com/v1/directions');
    url.search=new URLSearchParams({origin:`${input.from.lng},${input.from.lat}`,destination:`${input.to.lng},${input.to.lat}`,priority:'TIME',summary:'true'}).toString();return url;
  }
  const endpoint={walk:'walk',bicycle:'bicycle',transit:'publictraffic'}[input.mode];
  const url=new URL(`https://dapi.kakao.com/v2/routing/${endpoint}`);
  url.search=new URLSearchParams({start_x:String(input.from.lng),start_y:String(input.from.lat),end_x:String(input.to.lng),end_y:String(input.to.lat)}).toString();return url;
}
export function normalizeRoute(mode, data) {
  let candidates;
  if(mode==='car') candidates=(data.routes??[]).filter(r=>r.result_code===0).map(r=>({seconds:r.summary?.duration,meters:r.summary?.distance}));
  else if(mode==='transit') candidates=(data.routes??[]).map(r=>({seconds:r.properties?.totalTime,meters:r.properties?.totalDistance,transfers:r.properties?.transfers}));
  else candidates=[{seconds:data.route?.properties?.totalTime,meters:data.route?.properties?.totalDistance}];
  const valid=candidates.filter(r=>Number.isFinite(r.seconds)&&r.seconds>=0&&Number.isFinite(r.meters)&&r.meters>=0).sort((a,b)=>a.seconds-b.seconds);
  if(!valid.length) return null;
  return {...valid[0],mode,checkedAt:new Date().toISOString()};
}
