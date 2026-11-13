import {useCallback,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {createForegroundRefresh,PUBLIC_READ_STALE_MS,nextContentBoundary} from '../lib/foreground-refresh';
/** Refresh existing read endpoints on focus/resume and bounded visible staleness.
 * Caller owns response scope/generation guards and truthful error presentation. */
export function useForegroundRefresh(refresh:()=>void,scope:string|null,staleMs=PUBLIC_READ_STALE_MS){
 const latest=useRef(refresh);latest.current=refresh;
 useFocusEffect(useCallback(()=>{
  if(!scope)return;
  const gate=createForegroundRefresh({refresh:()=>latest.current()});
  gate.foreground(AppState.currentState==='active'||AppState.currentState===null);
  gate.focus();
  const sub=AppState.addEventListener('change',state=>gate.foreground(state==='active'));
  const timer=setInterval(()=>gate.stale(),staleMs);
  return()=>{gate.dispose();sub.remove();clearInterval(timer)};
 },[scope,staleMs]));
}

/** Local time-derived UI only: no data requests, no background timer work. */
export function useForegroundNow(scope:string|null,intervalMs=60_000){
 const [now,setNow]=useState(()=>Date.now());
 useForegroundRefresh(()=>setNow(Date.now()),scope,intervalMs);
 return now;
}

/** Exact start/end boundary rerender for offers and ephemeral story trays. */
export function useContentClock(scope:string|null,boundaries:readonly(string|null|undefined)[]){
 const minute=useForegroundNow(scope);
 const [boundary,setBoundary]=useState(0);
 const key=boundaries.join('|');
 useFocusEffect(useCallback(()=>{
  if(!scope)return;
  const next=nextContentBoundary(key.split('|'),Date.now());
  if(next===null)return;
  const timer=setTimeout(()=>{if(AppState.currentState==='active'||AppState.currentState===null)setBoundary(Date.now())},Math.min(2_147_483_647,Math.max(1,next-Date.now())));
  return()=>clearTimeout(timer);
 },[scope,key,minute,boundary]));
 return Math.max(minute,boundary);
}
