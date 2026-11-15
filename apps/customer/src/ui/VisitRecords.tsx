import React,{useEffect,useState}from'react';
import{View}from'react-native';
import{useAuth}from'../hooks/useAuth';
import{getJobWorkCoverage,type JobWorkCoverage}from'../lib/work-coverage-service';
import{Pane,Row,T,Button}from'./kit';
import{WorkAndCoverage}from'./WorkAndCoverage';
/** Only mounted after the parent verifies this exact visit's owner and route. */
export function VisitRecords({jobId,vehicle,hasInspection,onInspection}:{jobId:string;vehicle:string;hasInspection:boolean;onInspection:()=>void}){
 const auth=useAuth();const scope=auth.status==='ready'?JSON.stringify([auth.user.uid,auth.customerDocId,auth.claims.tenantId,jobId]):null;
 const[open,setOpen]=useState(false),[workOpen,setWorkOpen]=useState(false),[attempt,setAttempt]=useState(0);
 const[state,setState]=useState<{scope:string|null;data:JobWorkCoverage|null;error:boolean}>({scope:null,data:null,error:false});
 useEffect(()=>{setOpen(false);setWorkOpen(false)},[scope]);
 useEffect(()=>{let alive=true;setState({scope,data:null,error:false});if(scope)void getJobWorkCoverage(jobId,'self').then(data=>{if(alive)setState({scope,data,error:false})}).catch(()=>{if(alive)setState({scope,data:null,error:true})});return()=>{alive=false}},[scope,attempt]);
 if(!scope)return null;
 const current=state.scope===scope,data=current?state.data:null,error=current&&state.error;
 const items=data?.status==='recorded'?data.items.filter(i=>!!i.performedAt&&['QC recorded','Needs QC'].includes(i.workStatus)):[];
 const recorded=items.length>0;
 const pending=!current||(!data&&!error),needsReview=data?.status==='needs_review'||data?.items.some(i=>i.workStatus==='Needs review');
 if(data?.status==='not_recorded'&&!hasInspection)return null;
 if(data?.status==='recorded'&&!recorded&&!needsReview&&!hasInspection)return null;
 const available=[hasInspection?'Inspection':null,recorded?'Performed work':null].filter(Boolean).join(' · ');
 return <Pane pad="gap"><Row title="Visit records" expanded={open} detail={available||(pending?'Checking recorded details…':error?'Records could not be checked':'Studio check needed')} onPress={()=>setOpen(v=>!v)} last={!open}/>{open?<View style={{gap:12}}>
  {hasInspection?<Row title="Inspection" detail="View recorded report" onPress={onInspection} last={!recorded&&!error&&!needsReview}/>:null}
  {recorded?<><Row title="Performed work" expanded={workOpen} detail="Recorded service details" onPress={()=>setWorkOpen(v=>!v)} last/>{workOpen?<WorkAndCoverage vehicle={vehicle} items={items} audience="customer" hideEmptyCoverage/>:null}</>:null}
  {pending?<T role="caption" tone="secondary">Checking recorded details…</T>:null}
  {error?<><T role="caption" tone="secondary">Could not check work details. This does not mean no work was recorded.</T><Button kind="quiet" label="Retry records" onPress={()=>setAttempt(v=>v+1)}/></>:null}
  {needsReview?<T role="caption" tone="secondary">The studio needs to check this work record before its details can be shown.</T>:null}
 </View>:null}</Pane>;
}
