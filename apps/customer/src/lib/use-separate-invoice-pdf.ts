import{useEffect,useRef,useState}from'react';
import{getSeparateInvoicePdf,type SeparatePdf}from'./separate-invoice-pdf';
import{saveSeparateInvoicePdf}from'./save-separate-invoice-pdf';
export function useSeparateInvoicePdf(jobId:string,kind:SeparatePdf['kind'],scope:string|null){
 const key=JSON.stringify([jobId,kind,scope]),live=useRef({key,active:true,busy:false});if(live.current.key!==key)live.current={key,active:true,busy:false};const token=live.current;
 const[state,setState]=useState<{token:typeof token;pdf?:SeparatePdf;at?:number;busy?:boolean;error?:string}>({token}),s=state.token===token?state:{token};
 useEffect(()=>{token.active=true;return()=>{token.active=false}},[token]);
 useEffect(()=>{if(!s.at)return;const t=setTimeout(()=>{if(live.current===token&&token.active)setState({token})},Math.max(0,s.at+9*60000-Date.now()));return()=>clearTimeout(t)},[token,s.at]);
 async function press(){if(!scope||!token.active||live.current!==token||token.busy)return;const valid=()=>token.active&&live.current===token;token.busy=true;const{error:_error,...rest}=s;setState({...rest,token,busy:true});try{if(s.pdf&&s.at!+9*60000>Date.now()){await saveSeparateInvoicePdf(s.pdf,valid);if(valid())setState({token});}else{const pdf=await getSeparateInvoicePdf(jobId,kind);if(valid())setState({token,pdf,at:Date.now()});}}catch{if(valid())setState({token,error:'PDF unavailable'});}finally{token.busy=false;if(valid())setState(p=>p.token===token?{...p,busy:false}:p)}}
 return{press,disabled:!scope||!!s.busy,label:s.busy?'Preparing PDF...':s.pdf?'Save charge PDF':'Download charge PDF',error:s.error};
}
