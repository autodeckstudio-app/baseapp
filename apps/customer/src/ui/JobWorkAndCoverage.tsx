import React,{useEffect,useState}from'react';
import{useAuth}from'../hooks/useAuth';
import{getJobWorkCoverage,type JobWorkCoverage}from'../lib/work-coverage-service';
import{Button,Pane,T}from'./kit';
import{View}from'react-native';
import{Icon,useExperienceTheme}from'@autodeck/ui/native';
export function WorkRecordState({title,body,action}:{title:string;body:string;action?:React.ReactNode}){const{colors}=useExperienceTheme();return<Pane pad="gap"><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Icon name="shield" size={20} color={colors.textSecondary}/><View style={{flex:1,gap:3}}><T role="bodyStrong">{title}</T><T role="caption" tone="secondary">{body}</T></View>{action}</View></Pane>}
import{WorkAndCoverage}from'./WorkAndCoverage';
// Mounted in the combined candidate booking detail. Keep the existing warranty
// visibility gate OFF until the server/data workflow is reviewed and activated.
export function JobWorkAndCoverage({jobId,vehicle,mode='self'}:{jobId:string;vehicle:string;mode?:'self'|'staff'}){
 const auth=useAuth();const ready=auth.status==='ready';
 const allowed=mode==='self'||(ready&&['studio','admin','superadmin'].includes(auth.claims.role));
 const scope=ready&&allowed?JSON.stringify([auth.user.uid,auth.customerDocId,auth.claims.tenantId,auth.claims.role,auth.claims.studioId,jobId,mode]):null;
 const[state,setState]=useState<{scope:string|null;data:JobWorkCoverage|null;error:boolean}>({scope:null,data:null,error:false});const[attempt,setAttempt]=useState(0);
 useEffect(()=>{let alive=true;setState({scope,data:null,error:false});if(!scope)return;
  getJobWorkCoverage(jobId,mode).then(data=>{if(alive)setState({scope,data,error:false})}).catch(()=>{if(alive)setState({scope,data:null,error:true})});return()=>{alive=false};
 },[scope,attempt]);
 if(!allowed)return<WorkRecordState title="Work unavailable" body="Studio or admin access required."/>;
 if(!ready)return<WorkRecordState title="Sign in to view work" body="Use your account."/>;
 if(state.scope!==scope||(!state.data&&!state.error))return<T tone="secondary">Checking the work record…</T>;
 if(state.error)return<WorkRecordState title="Work unavailable" body="Coverage not confirmed." action={<Button kind="quiet" label="Retry" onPress={()=>setAttempt(n=>n+1)}/>}/>;
 const data=state.data!;if(data.status==='not_recorded')return<WorkRecordState title="Work not recorded" body="Coverage not confirmed."/>;
 if(data.status==='needs_review')return<WorkRecordState title="Work needs review" body="Studio check needed · coverage not confirmed."/>;
 const audience=mode==='self'?'customer':auth.claims.role==='studio'?'studio':'admin';
 return<WorkAndCoverage vehicle={vehicle} items={data.items} audience={audience}/>;
}
