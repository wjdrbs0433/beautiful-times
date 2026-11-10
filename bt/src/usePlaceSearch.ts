import { useCallback, useRef, useState } from 'react';
import type { Place } from './components/KakaoMap.types';

type Search = { stopId:string; query:string; requestId:string; results:Place[]; error:string; busy:boolean };
const emptySearch:Search = { stopId:'',query:'',requestId:'',results:[],error:'',busy:false };

export function usePlaceSearch(dismissKeyboard:()=>void) {
  const [search,setSearch] = useState<Search>(emptySearch);
  const [inputRevisions,setInputRevisions] = useState<Record<string,number>>({});
  const sequence = useRef(0);
  const activeRequest = useRef<string|null>(null);
  const clearSearch = useCallback(()=>{
    activeRequest.current = null;
    setSearch(emptySearch);
  },[]);
  const startSearch = useCallback((stopId:string,query:string,enabled:boolean)=>{
    const requestId = `${stopId}:${++sequence.current}`;
    activeRequest.current = requestId;
    setSearch({stopId,query,requestId,results:[],error:'',busy:enabled&&query.trim().length>=2});
  },[]);
  const receiveResults = useCallback((requestId:string,query:string,results:Place[],error?:string)=>{
    if (activeRequest.current !== requestId) return;
    setSearch(previous => previous.requestId===requestId && previous.query.trim()===query
      ? {...previous,results,error:error??'',busy:false} : previous);
  },[]);
  const choosePlace = useCallback((stopId:string,applySelection:()=>void)=>{
    // Blur can synchronously finish an IME edit. Commit that first, then make
    // the chosen place authoritative and retire the old input/event stream.
    dismissKeyboard();
    clearSearch();
    setInputRevisions(previous=>({...previous,[stopId]:(previous[stopId]??0)+1}));
    applySelection();
  },[dismissKeyboard,clearSearch]);
  return {search,inputRevisions,startSearch,receiveResults,choosePlace,clearSearch};
}
