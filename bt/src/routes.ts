import {useEffect,useRef,useState} from 'react';
import type {Stop} from './model';
import {routeKey} from './routeDisplay.ts';
export {durationLabel} from './routeDisplay.ts';
export const ROUTE_BASE=(process.env.EXPO_PUBLIC_ROUTE_BASE_URL||'http://127.0.0.1:8090').replace(/\/$/,'');
export type TravelTime={status:'loading'|'ready'|'missing'|'error';seconds?:number;meters?:number;error?:string;checkedAt?:string;routeKey?:string};
export function distanceLabel(meters:number){return meters>=1000?`${(meters/1000).toFixed(1)}km`:`${Math.round(meters)}m`;}
const cache=new Map<string,{value:TravelTime;until:number}>();
export function useTravelTimes(stops:Stop[],enabled:boolean,refresh:number){
 const [times,setTimes]=useState<Record<string,TravelTime>>({});const lastRefresh=useRef(refresh);
 const signature=JSON.stringify(stops.map(s=>({id:s.id,lat:s.lat,lng:s.lng,mode:s.mode})));
 useEffect(()=>{
  if(!enabled)return;
  const controller=new AbortController();const force=refresh!==lastRefresh.current;lastRefresh.current=refresh;
  const routeStops: Stop[] = JSON.parse(signature);
  const pairs=routeStops.slice(0,-1).map((from,i)=>({from,to:routeStops[i+1]}));
  const hasPoint=(s:Stop)=>Number.isFinite(s.lat)&&Number.isFinite(s.lng);
  const initial:Record<string,TravelTime>={};for(const {from,to}of pairs)initial[from.id]={status:hasPoint(from)&&hasPoint(to)?'loading':'missing',routeKey:routeKey(from,to)};setTimes(initial);
  const timer=setTimeout(async()=>{
   let next=0;
   async function worker(){
    while(next<pairs.length&&!controller.signal.aborted){const {from,to}=pairs[next++];if(!hasPoint(from)||!hasPoint(to))continue;
     const key=routeKey(from,to);const hit=cache.get(key);
     if(!force&&hit&&hit.until>Date.now()){setTimes(t=>({...t,[from.id]:hit.value}));continue;}
     try{
      const response=await fetch(ROUTE_BASE+'/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:from.mode,from:{lat:from.lat,lng:from.lng},to:{lat:to.lat,lng:to.lng}}),signal:controller.signal});
      const payload=await response.json();if(controller.signal.aborted)return;
      if(!response.ok)throw new Error(typeof payload.error==='string'?payload.error:'이동시간을 조회하지 못했어요.');
      if(!Number.isFinite(payload.seconds)||payload.seconds<0||!Number.isFinite(payload.meters)||payload.meters<0)throw new Error('이동시간 응답을 확인하지 못했어요.');
      const value:TravelTime={status:'ready',routeKey:key,seconds:payload.seconds,meters:payload.meters,checkedAt:payload.checkedAt};cache.set(key,{value,until:Date.now()+60000});if(cache.size>100)cache.delete(cache.keys().next().value!);setTimes(t=>({...t,[from.id]:value}));
     }catch(error){if(!controller.signal.aborted)setTimes(t=>({...t,[from.id]:{status:'error',routeKey:key,error:error instanceof TypeError?'이동시간 서버에 연결하지 못했어요. Mac의 연결 설정을 확인해 주세요.':error instanceof Error?error.message:'조회 실패'}}));}
    }
   }
   await Promise.all([worker(),worker(),worker()]);
  },650);
  return()=>{clearTimeout(timer);controller.abort();};
 // signature contains only route inputs; changing a note never consumes an API request.
 },[signature,enabled,refresh]);
 return times;
}
