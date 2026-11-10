import {useEffect,useState} from 'react';
import {AppState,Platform} from 'react-native';
import type {MemoryState} from '../model';
import {cloudStatus,subscribeCloud,syncNow} from '../storage';
export function useCloudSync(userId:string,onState:(state:MemoryState)=>void,canPull:boolean){
 const [status,setStatus]=useState(()=>cloudStatus(userId));
 useEffect(()=>subscribeCloud(userId,(next,state)=>{setStatus(next);if(state)onState(state);}),[userId,onState]);
 useEffect(()=>{
  if(!canPull)return;
  const refresh=()=>{void syncNow(userId).catch(()=>{});};
  const subscription=AppState.addEventListener('change',value=>{if(value==='active')refresh();});
  const timer=setInterval(()=>{if(Platform.OS==='web'?document.visibilityState==='visible':AppState.currentState==='active')refresh();},60000);
  if(Platform.OS==='web')window.addEventListener('online',refresh);
  return()=>{subscription.remove();clearInterval(timer);if(Platform.OS==='web')window.removeEventListener('online',refresh);};
 },[userId,canPull]);
 return {status,refresh:()=>syncNow(userId),resolve:(choice:'local'|'remote')=>syncNow(userId,choice)};
}
