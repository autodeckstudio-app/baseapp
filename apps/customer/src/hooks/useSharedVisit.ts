import {useForegroundRefresh} from './useForegroundRefresh';
import {useEffect,useState} from 'react';
import type {ServiceJob,VisitRead} from '@autodeck/core';
import {useAuth} from './useAuth';
export function useSharedVisit(job:ServiceJob|null|undefined,changeKey?:string){
 const auth=useAuth(),scope=job?.visitId&&auth.status==='ready'?JSON.stringify([auth.user.uid,auth.customerDocId,auth.claims,job.id,job.visitId,job.updatedAt,changeKey]):null;
 const[tick,setTick]=useState(0);
 useForegroundRefresh(()=>setTick(n=>n+1),scope);
 const[state,setState]=useState<{scope:string|null;data:VisitRead|null;error:boolean}>({scope:null,data:null,error:false});
 useEffect(()=>{let alive=true;setState({scope,data:null,error:false});if(scope)import('../lib/visit-service').then(m=>m.getVisit(job!.id,true)).then(data=>{if(alive)setState({scope,data,error:false})}).catch(()=>{if(alive)setState({scope,data:null,error:true})});return()=>{alive=false}},[scope,tick]);
 if(!job?.visitId)return null;
 return scope&&state.scope===scope?state:{scope,data:null,error:false};
}
