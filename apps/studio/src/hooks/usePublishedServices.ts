import {useEffect,useRef,useState,useCallback} from 'react';
import {AppState} from 'react-native';
import {doc,onSnapshot} from 'firebase/firestore';
import type {Service} from '@autodeck/core';
import {db} from '../lib/firebase';
import {getPublishedServices} from '../lib/approval-service';
/** Accepted versions only. Clear stale choices before reading; a cached signal is
 * not evidence of freshness. Epochs prevent old account/version reads winning. */
export function usePublishedServices(owner:string|null,tenantId:string|null,enabled=true){
 const scope=owner&&tenantId?owner+'|'+tenantId:null,current=useRef(scope),validity=useRef(0),enabledRef=useRef(enabled);if(current.current!==scope||enabledRef.current!==enabled)validity.current++;current.current=scope;enabledRef.current=enabled;
 const [tick,setTick]=useState(0),[revision,setRevision]=useState(0);
 const [state,setState]=useState<{scope:string;token:number;rows:Service[];loading:boolean;error:string|null}|null>(null);
 const refresh=useCallback(()=>{validity.current++;setTick(n=>n+1)},[]);
 useEffect(()=>{
  if(!enabled||!scope||!tenantId){setState(null);return;}
  let alive=true,epoch=0,version:string|undefined;
  const load=()=>{const request=++epoch,expected=version,token=++validity.current;setRevision(n=>n+1);setState({scope,token,rows:[],loading:true,error:null});
   void getPublishedServices().then(({services:rows,publishId})=>{if(expected&&publishId!==expected)throw Error('Accepted version not ready');if(alive&&current.current===scope&&request===epoch)setState({scope,token,rows:rows.filter(s=>s.tenantId===tenantId),loading:false,error:null})}).catch(()=>{if(alive&&current.current===scope&&request===epoch)setState({scope,token,rows:[],loading:false,error:'Could not refresh services. Try again before continuing.'})});};
  load();
  const stop=onSnapshot(doc(db,'cataloguePublishedVersions',tenantId),snap=>{
   if(!alive||snap.metadata.fromCache)return;
   const next=snap.exists()?snap.data()['publishId'] as string:undefined;
   if(next===version)return;version=next;load();
  },()=>{if(!alive||current.current!==scope)return;epoch++;const token=++validity.current;setState({scope,token,rows:[],loading:false,error:'Catalogue updates could not be checked. Refresh before continuing.'})});
  const resume=AppState.addEventListener('change',s=>{if(s==='active')refresh()});
  return()=>{alive=false;epoch++;validity.current++;stop();resume?.remove()};
 },[scope,tenantId,enabled,tick]);
 const visible=enabled&&state?.scope===scope&&state.token===validity.current?state:null;
 return {services:visible?.rows??[],loading:enabled&&(visible?.loading??true),error:visible?.error??null,revision,refresh,isCurrent:()=>Boolean(enabledRef.current&&current.current===scope&&visible&&!visible.loading&&!visible.error&&visible.token===validity.current)};
}
