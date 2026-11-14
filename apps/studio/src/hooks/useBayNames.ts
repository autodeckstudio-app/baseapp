import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { db } from "../lib/firebase";
import { getActiveServices } from "../lib/approval-service";

/** Bays stream from their source. Catalogue keeps the callable's visibility boundary,
 * refreshing at most once per foreground minute and immediately on resume. */
export function useJobLabels(studioId:string|null,owner:string|null,tenantId:string|null):{bays:Record<string,string>;services:Record<string,string>} {
  const scope=`${owner}:${studioId}`;
  const current=useRef(scope);current.current=scope;
  const [source,setSource]=useState<{scope:string;bays:Record<string,string>;services:Record<string,string>}|null>(null);
  useEffect(()=>{
    setSource(null);
    if(!studioId||!owner||!tenantId)return;
    let active=true,bays:Record<string,string>={},services:Record<string,string>={},generation=0;
    const publish=()=>{if(active&&current.current===scope)setSource({scope,bays:{...bays},services:{...services}})};
    const stop=onSnapshot(doc(db,COLLECTIONS.studioConfig(),studioId),snap=>{
      if(!active||current.current!==scope)return;
      const config=snap.exists()?snap.data():null;
      bays=config?.tenantId===tenantId?Object.fromEntries((config.bays??[]).map((b:{id:string;name:string})=>[b.id,b.name])):{};
      publish();
    },()=>{bays={};publish()});
    const refresh=()=>{
      if(AppState.currentState!==null&&AppState.currentState!=='active')return;
      const request=++generation;
      void getActiveServices({catalogueOnly:false}).then(list=>{if(active&&current.current===scope&&request===generation){services=Object.fromEntries(list.filter(s=>s.tenantId===tenantId).map(s=>[s.id,s.name]));publish()}}).catch(()=>{if(active&&current.current===scope&&request===generation){services={};publish()}});
    };
    refresh();
    const timer=setInterval(refresh,60_000);
    const resume=AppState.addEventListener('change',state=>{if(state==='active')refresh()});
    return()=>{active=false;generation++;stop();clearInterval(timer);resume.remove()};
  },[scope,studioId,owner,tenantId]);
  return source?.scope===scope?source:{bays:{},services:{}};
}
