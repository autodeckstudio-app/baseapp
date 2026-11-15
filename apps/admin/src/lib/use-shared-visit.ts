import {useEffect,useState} from 'react';
import {visitProgress,type ServiceJob,type VisitRead} from '@autodeck/core';
import {getVisit} from './visit-service';
import {useAdminAuth} from './auth-context';
export function useSharedVisit(job:ServiceJob|null|undefined){
 const{user,claims,loading}=useAdminAuth(),allowed=!loading&&!!user&&!!claims&&['admin','superadmin'].includes(claims.role)&&claims.tenantId===job?.tenantId;const principal=allowed?[user!.uid,claims]:null;
 const scope=job?.visitId&&allowed?JSON.stringify([principal,job.id,job.visitId,job.updatedAt]):null;
 const[tick,setTick]=useState(0);
 useEffect(()=>{if(!scope||typeof window==='undefined'||typeof document==='undefined')return;const refresh=()=>{if(document.visibilityState!=='hidden')setTick(n=>n+1)};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const timer=setInterval(refresh,300000);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);clearInterval(timer)}},[scope]);
 const[state,setState]=useState<{scope:string|null;data:VisitRead|null;error:boolean}>({scope:null,data:null,error:false});
 useEffect(()=>{let alive=true;setState({scope,data:null,error:false});if(scope)getVisit(job!.id).then(data=>{if(alive)setState({scope,data,error:false})}).catch(()=>{if(alive)setState({scope,data:null,error:true})});return()=>{alive=false}},[scope,tick]);
 const result=scope&&state.scope===scope?state:{scope,data:null,error:false};
 return{...result,refresh:()=>{setState({scope,data:null,error:false});setTick(n=>n+1)},progress:result.data?.status==='grouped'?visitProgress(result.data):null};
}
