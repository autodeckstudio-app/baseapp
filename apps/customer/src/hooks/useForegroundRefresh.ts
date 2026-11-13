import {useCallback,useRef} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {createForegroundRefresh,PUBLIC_READ_STALE_MS} from '../lib/foreground-refresh';
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
