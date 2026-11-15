import {useEffect,useState} from 'react';
import {visitProgress,type ServiceJob,type VisitRead} from '@autodeck/core';
import {getVisit} from './visit-service';
import {onStaffAuthChanged,type StaffAuth} from './studio-service';
export function useSharedVisit(job:ServiceJob|null|undefined){
 const[auth,setAuth]=useState<StaffAuth|null|undefined>(undefined);useEffect(()=>onStaffAuthChanged(setAuth),[]);const allowed=!!auth&&auth.tenantId===job?.tenantId&&(['admin','superadmin'].includes(auth.role??'')||auth.role==='studio'&&auth.studioId===job?.studioId);const principal=allowed?auth:null;
 const scope=job?.visitId&&allowed?JSON.stringify([principal,job.id,job.visitId,job.updatedAt]):null;
 const[tick,setTick]=useState(0);
 useEffect(()=>{const web=globalThis as unknown as {window?:{addEventListener:(event:string,cb:()=>void)=>void;removeEventListener:(event:string,cb:()=>void)=>void};document?:{visibilityState?:string;addEventListener:(event:string,cb:()=>void)=>void;removeEventListener:(event:string,cb:()=>void)=>void}};const{window,document}=web;if(!scope||!window||!document)return;const refresh=()=>{if(document.visibilityState!=='hidden')setTick(n=>n+1)};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const timer=setInterval(refresh,300000);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);clearInterval(timer)}},[scope]);
 const[state,setState]=useState<{scope:string|null;data:VisitRead|null;error:boolean}>({scope:null,data:null,error:false});
 useEffect(()=>{let alive=true;setState({scope,data:null,error:false});if(scope)getVisit(job!.id).then(data=>{if(alive)setState({scope,data,error:false})}).catch(()=>{if(alive)setState({scope,data:null,error:true})});return()=>{alive=false}},[scope,tick]);
 const result=scope&&state.scope===scope?state:{scope,data:null,error:false};
 return{...result,refresh:()=>{setState({scope,data:null,error:false});setTick(n=>n+1)},progress:result.data?.status==='grouped'?visitProgress(result.data):null};
}
