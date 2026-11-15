import{useEffect,useRef,useState}from'react';
import{View,Text,Pressable}from'react-native';
import{colors}from'@autodeck/ui/tokens';
import type{ServiceJob,WorkCommandScope,JobWorkCoverage as Snapshot}from'@autodeck/core';
import{onStaffAuthChanged,type StaffAuth}from'../lib/studio-service';
import{JobWorkCoverage}from'./JobWorkCoverage';
import{RecordJobWork}from'./RecordJobWork';
import{listenToWorkExtras,type WorkExtraOption}from'../lib/work-extras-service';
import{listenToWorkTargets,type WorkTargetOption}from'../lib/work-targets-service';
type Job=Pick<ServiceJob,'id'|'tenantId'|'studioId'|'vehicleId'|'customerId'|'status'|'lines'|'serviceId'>;
/** Combined integration candidate. Reader is authoritative for revision. Never
 * record from a guessed zero, stale visit, or a failed/malformed snapshot. */
export function JobWorkSession({job}:{job:Job}){
 const[auth,setAuth]=useState<StaffAuth|null|undefined>();
 const authRef=useRef(auth);const jobRef=useRef(job);jobRef.current=job;
 useEffect(()=>onStaffAuthChanged(a=>{authRef.current=a;setAuth(a)}),[]);
 const keyFor=(a:StaffAuth|null|undefined,j:Job)=>a&&a.uid&&a.tenantId===j.tenantId&&(['admin','superadmin'].includes(a.role??'')||a.role==='studio'&&a.studioId===j.studioId)?JSON.stringify([a.uid,a.tenantId,a.role,a.studioId,j]):null;
 const key=keyFor(auth,job);const[load,setLoad]=useState(0);const[mode,setMode]=useState<'record'|'qc'>('record');
 const[extraState,setExtraState]=useState<{key:string|null;items:WorkExtraOption[];error:boolean}>({key:null,items:[],error:false});
 useEffect(()=>{let alive=true;setExtraState({key,items:[],error:false});if(!key)return;const scope:WorkCommandScope={uid:auth!.uid,tenantId:job.tenantId,role:auth!.role as WorkCommandScope['role'],studioId:job.studioId,jobId:job.id,vehicleId:job.vehicleId,customerId:job.customerId};const stop=listenToWorkExtras(scope,items=>{if(alive)setExtraState({key,items,error:false})},()=>{if(alive)setExtraState({key,items:[],error:true})});return()=>{alive=false;stop()}},[key]);
 const[targetState,setTargetState]=useState<{key:string|null;items:WorkTargetOption[];error:boolean}>({key:null,items:[],error:false});
 useEffect(()=>{let alive=true;setTargetState({key,items:[],error:false});if(!key||!auth)return;const scope:WorkCommandScope={uid:auth.uid,tenantId:job.tenantId,role:auth.role as WorkCommandScope['role'],studioId:job.studioId,jobId:job.id,vehicleId:job.vehicleId,customerId:job.customerId};const stop=listenToWorkTargets(scope,items=>{if(alive)setTargetState({key,items,error:false})},()=>{if(alive)setTargetState({key,items:[],error:true})});return()=>{alive=false;stop()}},[key]);
 const[state,setState]=useState<{key:string;load:number;data:Snapshot}|null>(null);
 const current=()=>!!key&&keyFor(authRef.current,jobRef.current)===key;
 const loaded=(data:Snapshot)=>{if(current()&&data.jobId===job.id)setState({key:key!,load,data})};
 const saved=()=>{if(current()){setState(null);setLoad(n=>n+1)}};
 const ready=!!key&&state?.key===key&&state.load===load&&state.data.status!=='needs_review'&&state.data.workLock==='open';
 return<View style={{gap:16}}><JobWorkCoverage job={job} reloadKey={load} onLoaded={loaded}/>{extraState.key===key&&extraState.error?<Text style={{fontSize:13,color:colors.textSecondary}}>Extra work unavailable</Text>:null}{targetState.key===key&&targetState.error?<Text style={{fontSize:13,color:colors.textSecondary}}>Protection targets unavailable</Text>:null}{ready&&(mode==='qc'||state!.data.items.some(i=>i.workStatus==='Needs QC'))?<View style={{flexDirection:'row',gap:8}}>{(['record','qc']as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:mode===value}} onPress={()=>setMode(value)} style={{minHeight:44,padding:12,borderRadius:22,borderWidth:1,borderColor:mode===value?colors.accent:colors.border}}><Text style={{fontSize:13,color:colors.textPrimary}}>{value==='record'?'Record':'QC'}</Text></Pressable>)}</View>:null}{key?<RecordJobWork key={`${key}-${load}`} job={job} extras={extraState.key===key?extraState.items:[]} targets={targetState.key===key?targetState.items:[]} mode={mode} snapshot={state?.key===key&&state.load===load?state.data:undefined} revision={ready?state!.data.revision??0:null} entryState={state?.key===key&&state.load===load?(state.data.workLock==='locked'?'locked':state.data.workLock==='unknown'||state.data.status==='needs_review'?'review':'checking'):'checking'} onSaved={saved}/>:null}</View>;
}
