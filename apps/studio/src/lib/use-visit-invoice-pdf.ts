import {useEffect,useRef,useState} from 'react';
import {Linking} from 'react-native';
import {getVisitInvoicePdf} from './visit-invoice-service';
/** Private URL kept only in memory, never persisted or opened by a late response. */
export function useVisitInvoicePdf(invoiceId:string,scope:string|null){
 const key=JSON.stringify([invoiceId,scope]);
 const live=useRef({key,active:true,busy:false});
 if(live.current.key!==key)live.current={key,active:true,busy:false};
 const token=live.current;
 const [state,setState]=useState<{token:typeof token;url?:string;expiresAt?:number;busy?:boolean;error?:string}>({token});
 const current=state.token===token?state:{token};
 useEffect(()=>{token.active=true;return()=>{token.active=false}},[token]);
 useEffect(()=>{if(!current.expiresAt)return;const timer=setTimeout(()=>{if(live.current===token&&token.active)setState({token})},Math.max(0,current.expiresAt-Date.now()));return()=>clearTimeout(timer)},[token,current.expiresAt]);
 async function press(){
  if(!scope||!token.active||live.current!==token||token.busy)return;
  token.busy=true;
  const valid=()=>token.active&&live.current===token;
  if(current.url&&current.expiresAt!>Date.now()){
   const url=current.url;setState({token,url,expiresAt:current.expiresAt!,busy:true});
   try{if(valid())await Linking.openURL(url)}catch{if(valid())setState({...current,busy:false,error:'PDF could not open'})}finally{token.busy=false;if(valid())setState(s=>s.token===token?{...s,busy:false}:s)}
   return;
  }
  setState({token,busy:true});
  try{const url=await getVisitInvoicePdf(invoiceId);if(valid())setState({token,url,expiresAt:Date.now()+9*60000})}
  catch{if(valid())setState({token,error:'PDF unavailable'})}
  finally{token.busy=false;if(valid())setState(s=>s.token===token?{...s,busy:false}:s)}
 }
 return {disabled:!scope||!!current.busy,label:current.busy?'Preparing PDF...':current.url&&current.expiresAt!>Date.now()?'Open PDF':'Download PDF',error:current.error,press};
}
